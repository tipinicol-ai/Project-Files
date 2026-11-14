const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { existsSync, createReadStream } = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const { randomBytes } = require('node:crypto')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const run = promisify(execFile)
const cancelledCopyJobs = new Set()
let shareServer = null
let shareState = null

const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.txt': 'text/plain', '.md': 'text/markdown', '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' }
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]))
const lanAddress = () => Object.values(os.networkInterfaces()).flat().find((entry) => entry && entry.family === 'IPv4' && !entry.internal)?.address ?? '127.0.0.1'

function sharePage(title, entries, relativePath, token) {
  const encodedBase = `/share/${token}/`
  const parent = relativePath ? `${encodedBase}${relativePath.split('/').slice(0, -1).map(encodeURIComponent).join('/')}` : encodedBase
  const rows = entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name)).map((entry) => {
    const href = `${encodedBase}${[relativePath, entry.name].filter(Boolean).map(encodeURIComponent).join('/')}`
    const icon = entry.isDirectory() ? '▣' : '◈'
    return `<a class="row" href="${href}"><span class="icon">${icon}</span><span>${escapeHtml(entry.name)}</span><span class="kind">${entry.isDirectory() ? 'Carpeta' : 'Archivo'}</span></a>`
  }).join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Project Files</title><style>body{margin:0;background:#0b1422;color:#dbe8f6;font:14px Segoe UI,Arial}main{max-width:980px;margin:36px auto;padding:0 20px}.brand{display:flex;align-items:center;gap:12px;margin-bottom:25px}.mark{width:40px;height:40px;display:grid;place-items:center;border-radius:11px;background:#1b89ae;color:#a5f2ff;font-size:23px}.brand strong{font-size:19px}.brand small{display:block;color:#7893ad;margin-top:3px}.card{overflow:hidden;border:1px solid #29445f;border-radius:12px;background:#111f31;box-shadow:0 18px 50px #050b13}.head{padding:18px 20px;border-bottom:1px solid #253a52}.head h1{margin:0;font-size:18px}.head p{margin:6px 0 0;color:#8da7c0;font-size:12px}.row{display:grid;grid-template-columns:30px 1fr 100px;gap:10px;align-items:center;padding:13px 20px;border-bottom:1px solid #1e3248;color:#dbe8f6;text-decoration:none}.row:hover{background:#1b3b57}.icon{color:#68d9ed;font-size:18px}.kind{color:#7894ad;text-align:right;font-size:11px}.back{display:inline-block;margin-bottom:15px;color:#7be0f1;text-decoration:none}@media(max-width:600px){main{margin:20px auto}.row{grid-template-columns:25px 1fr}.kind{display:none}}</style></head><body><main><div class="brand"><div class="mark">▣</div><div><strong>Project Files</strong><small>Compartido en tu red local · solo lectura</small></div></div>${relativePath ? `<a class="back" href="${parent}">← Volver</a>` : ''}<section class="card"><div class="head"><h1>${escapeHtml(title)}</h1><p>Abre carpetas, reproduce imágenes y vídeos o descarga archivos autorizados.</p></div>${rows || '<div class="head"><p>Esta carpeta está vacía.</p></div>'}</section></main></body></html>`
}

async function startShareServer(root) {
  if (shareServer) await stopShareServer()
  await fs.access(root)
  const token = randomBytes(10).toString('hex')
  shareState = { root: path.resolve(root), token }
  shareServer = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost')
      const prefix = `/share/${token}/`
      if (!requestUrl.pathname.startsWith(prefix)) { response.writeHead(404); response.end('Not found'); return }
      const relative = decodeURIComponent(requestUrl.pathname.slice(prefix.length)).replaceAll('/', path.sep)
      const target = safeChild(shareState.root, relative)
      const stat = await fs.stat(target)
      if (stat.isDirectory()) {
        const entries = await fs.readdir(target, { withFileTypes: true })
        const relativeUrl = path.relative(shareState.root, target).split(path.sep).filter(Boolean).join('/')
        const html = sharePage(path.basename(target) || target, entries, relativeUrl, token)
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(html); return
      }
      const extension = path.extname(target).toLowerCase()
      response.writeHead(200, { 'Content-Type': mimeTypes[extension] ?? 'application/octet-stream', 'Content-Length': stat.size, 'Content-Disposition': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.pdf', '.txt', '.md'].includes(extension) ? 'inline' : `attachment; filename="${encodeURIComponent(path.basename(target))}"` })
      createReadStream(target).pipe(response)
    } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 403); response.end(error.code === 'ENOENT' ? 'Not found' : 'Access denied') }
  })
  await new Promise((resolve, reject) => { shareServer.once('error', reject); shareServer.listen(0, '0.0.0.0', resolve) })
  const port = shareServer.address().port
  return { root: shareState.root, port, url: `http://${lanAddress()}:${port}/share/${token}/`, localUrl: `http://127.0.0.1:${port}/share/${token}/` }
}

function stopShareServer() {
  if (!shareServer) return Promise.resolve()
  const current = shareServer
  shareServer = null; shareState = null
  return new Promise((resolve) => current.close(() => resolve()))
}

async function listWindowsDrives() {
  const drives = []
  if (process.platform === 'win32') {
    for (let code = 65; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`
      try {
        await fs.access(drive)
        const stats = await fs.statfs(drive)
        const total = Number(stats.blocks) * Number(stats.bsize)
        const free = Number(stats.bavail) * Number(stats.bsize)
        drives.push({ name: `Disco local (${String.fromCharCode(code)}:)`, path: drive, kind: 'folder', size: total, free, created: '', modified: '', type: 'Unidad', extension: '' })
      } catch { /* unidad no disponible */ }
    }
  } else {
    const stats = await fs.statfs('/')
    drives.push({ name: 'Sistema de archivos', path: '/', kind: 'folder', size: Number(stats.blocks) * Number(stats.bsize), free: Number(stats.bavail) * Number(stats.bsize), created: '', modified: '', type: 'Unidad', extension: '' })
  }
  return drives
}

const isInside = (root, candidate) => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const safeChild = (root, child) => {
  const candidate = path.resolve(root, child)
  if (!isInside(root, candidate)) throw new Error('La ruta queda fuera de la carpeta elegida')
  return candidate
}

async function listDirectory(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    try {
      const fullPath = path.join(folderPath, entry.name)
      const stat = await fs.stat(fullPath)
      const extension = path.extname(entry.name).toLowerCase()
      result.push({ name: entry.name, path: fullPath, kind: entry.isDirectory() ? 'folder' : 'file', size: stat.size, created: stat.birthtime.toISOString(), modified: stat.mtime.toISOString(), type: entry.isDirectory() ? 'Carpeta' : extension || 'Archivo', extension })
    } catch { /* una entrada protegida no debe impedir leer las demás */ }
  }
  return result
}

function createWindow() {
  const win = new BrowserWindow({ show: false, frame: false, width: 1440, height: 860, minWidth: 960, minHeight: 640, title: 'Project Files', backgroundColor: '#101a2a', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false } })
  win.removeMenu()
  const entry = path.join(app.getAppPath(), 'dist', 'index.html')
  const showLoadError = (details) => {
    const safeDetails = String(details).replace(/[&<>\"]/g, (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[value]))
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;background:#101a2a;color:#e7edf7;font:14px Segoe UI,Arial;padding:48px"><h2>Project Files no pudo iniciar</h2><p>El programa no pudo cargar sus recursos. Cierra esta ventana y vuelve a instalar la versión más reciente.</p><pre style="color:#9aaac1;white-space:pre-wrap">${safeDetails}</pre></body></html>`)}`)
  }
  win.webContents.once('did-finish-load', () => win.show())
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => showLoadError(`${errorCode}: ${errorDescription}\n${validatedURL}`))
  win.webContents.on('render-process-gone', (_event, details) => showLoadError(`Renderer: ${details.reason}`))
  if (!existsSync(entry)) showLoadError(`No se encontró ${entry}`)
  else win.loadFile(entry)
  win.once('ready-to-show', () => win.maximize())
}

ipcMain.handle('get-home-path', () => app.getPath('home'))
ipcMain.handle('get-drives', () => listWindowsDrives())
ipcMain.on('window-minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
ipcMain.on('window-toggle-maximize', (event) => { const win = BrowserWindow.fromWebContents(event.sender); if (win?.isMaximized()) win.unmaximize(); else win?.maximize() })
ipcMain.on('window-close', (event) => BrowserWindow.fromWebContents(event.sender)?.close())
ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('choose-files', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
  return result.canceled ? [] : result.filePaths
})
ipcMain.handle('share-start', (_event, folderPath) => startShareServer(folderPath))
ipcMain.handle('share-stop', () => stopShareServer())
ipcMain.handle('share-status', () => shareState && shareServer ? { root: shareState.root, port: shareServer.address().port, url: `http://${lanAddress()}:${shareServer.address().port}/share/${shareState.token}/`, localUrl: `http://127.0.0.1:${shareServer.address().port}/share/${shareState.token}/` } : null)
ipcMain.handle('list-directory', (_event, folderPath) => listDirectory(folderPath))
ipcMain.handle('open-default', (_event, filePath) => shell.openPath(filePath))
ipcMain.handle('read-text', async (_event, filePath) => {
  const stat = await fs.stat(filePath)
  if (stat.size > 5 * 1024 * 1024) throw new Error('El archivo supera el límite de 5 MB del editor')
  return fs.readFile(filePath, 'utf8')
})
ipcMain.handle('write-text', async (_event, filePath, content) => fs.writeFile(filePath, String(content), 'utf8'))
ipcMain.handle('show-in-folder', (_event, filePath) => shell.showItemInFolder(filePath))
ipcMain.handle('create-folder', async (_event, parentPath, name) => fs.mkdir(safeChild(parentPath, name), { recursive: false }))
ipcMain.handle('copy', async (_event, sourcePaths, destinationPath, jobId = '') => {
  for (const source of sourcePaths) {
    if (jobId && cancelledCopyJobs.has(jobId)) { cancelledCopyJobs.delete(jobId); throw new Error('COPY_CANCELLED') }
    await fs.cp(source, safeChild(destinationPath, path.basename(source)), { recursive: true, errorOnExist: false })
  }
  if (jobId) cancelledCopyJobs.delete(jobId)
})
ipcMain.handle('copy-cancel', (_event, jobId) => { if (jobId) cancelledCopyJobs.add(jobId); return true })
ipcMain.handle('move', async (_event, sourcePaths, destinationPath) => Promise.all(sourcePaths.map(async (source) => {
  const target = safeChild(destinationPath, path.basename(source))
  try { await fs.rename(source, target) } catch (error) {
    if (error.code !== 'EXDEV') throw error
    await fs.cp(source, target, { recursive: true, errorOnExist: false })
    await fs.rm(source, { recursive: true, force: true })
  }
})))
ipcMain.handle('trash', async (_event, filePath) => shell.trashItem(filePath))
ipcMain.handle('rename', async (_event, filePath, name) => { const destination = safeChild(path.dirname(filePath), name); await fs.rename(filePath, destination); return destination })
ipcMain.handle('read-metadata', async (_event, filePath) => { const stat = await fs.stat(filePath); return { size: stat.size, created: stat.birthtime.toISOString(), modified: stat.mtime.toISOString() } })
ipcMain.handle('load-state', async () => { try { return JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'project-files-state.json'), 'utf8')) } catch { return null } })
ipcMain.handle('save-state', async (_event, state) => { const statePath = path.join(app.getPath('userData'), 'project-files-state.json'); await fs.mkdir(path.dirname(statePath), { recursive: true }); await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8') })
ipcMain.handle('github-list', async (_event, username, token = '') => {
  const target = username ? `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated` : 'https://api.github.com/user/repos?per_page=100&sort=updated'
  const response = await fetch(target, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Project-Files', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  if (!response.ok) throw new Error(`GitHub respondió ${response.status}`)
  return response.json()
})
ipcMain.handle('github-clone', async (_event, cloneUrl, destinationPath) => {
  if (!/^https:\/\/github\.com\//i.test(cloneUrl)) throw new Error('URL de GitHub no válida')
  await run('git', ['clone', '--depth', '1', cloneUrl, destinationPath], { windowsHide: true })
})
ipcMain.handle('youtube-download', async (_event, url, quality, mode, destinationPath) => {
  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) throw new Error('Introduce una URL válida de YouTube')
  const bundled = path.join(process.resourcesPath, 'vendor', 'yt-dlp.exe')
  const executable = existsSync(bundled) ? bundled : path.join(__dirname, '..', 'vendor', 'yt-dlp.exe')
  if (!existsSync(executable)) throw new Error('No se encontró el motor yt-dlp incluido')
  const format = mode === 'audio' ? 'bestaudio/best' : quality === 'best' ? 'bestvideo*+bestaudio/best' : `bestvideo[height<=${Number(quality)}]+bestaudio/best`
  const args = ['--no-playlist', '-f', format, ...(mode === 'video' ? ['--merge-output-format', 'mp4'] : []), '-o', path.join(destinationPath, '%(title)s.%(ext)s'), url]
  await run(executable, args, { windowsHide: true, maxBuffer: 1024 * 1024 * 4 })
})
ipcMain.handle('compress', async (_event, sourcePaths, destinationZip) => {
  if (!Array.isArray(sourcePaths) || !sourcePaths.length || path.extname(destinationZip).toLowerCase() !== '.zip') throw new Error('Solo se admite crear archivos ZIP')
  const script = "$destination=$args[-1]; $sources=$args[0..($args.Length-2)]; Compress-Archive -LiteralPath $sources -DestinationPath $destination -Force"
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script, '--', ...sourcePaths, destinationZip])
})
ipcMain.handle('extract', async (_event, archivePath, destinationPath) => {
  if (path.extname(archivePath).toLowerCase() !== '.zip') throw new Error('Solo se admite extraer archivos ZIP')
  await fs.mkdir(destinationPath, { recursive: true })
  const script = "$archive=[IO.Compression.ZipFile]::OpenRead($args[0]); $root=[IO.Path]::GetFullPath($args[1] + [IO.Path]::DirectorySeparatorChar); foreach($entry in $archive.Entries){ $target=[IO.Path]::GetFullPath((Join-Path $root $entry.FullName)); if(-not $target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)){ $archive.Dispose(); throw 'ZIP rechazado: ruta fuera del destino' } }; $archive.Dispose(); Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force"
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' + script, '--', archivePath, destinationPath])
})

app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) })
app.on('before-quit', () => { void stopShareServer() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

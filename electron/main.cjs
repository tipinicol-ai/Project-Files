const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { existsSync, createReadStream } = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const { randomBytes } = require('node:crypto')
const { scryptSync, timingSafeEqual } = require('node:crypto')
const Busboy = require('busboy')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const run = promisify(execFile)
const cancelledCopyJobs = new Set()
let shareServer = null
let shareState = null
const shareSessions = new Map()

const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.txt': 'text/plain', '.md': 'text/markdown', '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' }
const inlineTypes = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.pdf', '.txt', '.md'])
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]))
const lanAddress = () => Object.values(os.networkInterfaces()).flat().find((entry) => entry && entry.family === 'IPv4' && !entry.internal)?.address ?? '127.0.0.1'
const shareDataDir = () => path.join(app.getPath('userData'), 'local-share')
const usersPath = () => path.join(shareDataDir(), 'users.json')
const socialPath = () => path.join(shareDataDir(), 'social.json')
const passwordHash = (password, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
const passwordMatches = (password, stored) => { try { const [salt, digest] = stored.split(':'); return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(digest, 'hex')) } catch { return false } }
async function readUsers() { try { return JSON.parse(await fs.readFile(usersPath(), 'utf8')) } catch { return {} } }
async function writeUsers(users) { await fs.mkdir(shareDataDir(), { recursive: true }); await fs.writeFile(usersPath(), JSON.stringify(users, null, 2), 'utf8') }
async function readSocial() { try { return JSON.parse(await fs.readFile(socialPath(), 'utf8')) } catch { return {} } }
async function writeSocial(social) { await fs.mkdir(shareDataDir(), { recursive: true }); await fs.writeFile(socialPath(), JSON.stringify(social, null, 2), 'utf8') }
function cookieValue(request, name) { return (request.headers.cookie ?? '').split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1] }
function sessionUser(request) { return shareSessions.get(cookieValue(request, 'pf_session')) }
function redirect(response, location, cookie) { response.writeHead(302, { Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) }); response.end() }
const pageStyles = `<style>*{box-sizing:border-box}body{margin:0;background:#081321;color:#e7f0fb;font:14px Segoe UI,Arial,sans-serif}.hero{height:201px;background:linear-gradient(90deg,rgba(4,11,20,.28),rgba(5,12,23,.05)),url('/share-assets/banner.jpg') center/cover;display:flex;align-items:center;padding:0 max(28px,calc((100% - 1010px)/2));color:white}.hero h1{margin:0;font-size:31px;letter-spacing:-1px;text-shadow:0 2px 12px #000}.hero p{margin:8px 0 0;font-size:15px;color:#d5e7f2}.hero .service{position:absolute;right:24px;top:20px;display:flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid #8cf2bd66;border-radius:20px;background:#09251bcf;color:#a5f5c8;font-size:11px}.dot{width:7px;height:7px;border-radius:50%;background:#62e7a9;box-shadow:0 0 9px #62e7a9}.wrap{max-width:1010px;margin:34px auto;padding:0 20px}.section-title{margin:0 0 5px;font-size:22px}.sub{margin:0 0 24px;color:#92a8bd}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{position:relative;min-height:145px;padding:22px;border:1px solid #304860;border-radius:13px;background:linear-gradient(145deg,#16283b,#122133);box-shadow:0 14px 34px #02070d66;text-decoration:none;color:inherit;transition:.15s}.card:hover{transform:translateY(-4px);border-color:#55cfe8;background:#1a334b;box-shadow:0 18px 40px #02070dcc}.card{animation:cardIn .45s ease both}@keyframes cardIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}.card.folder{grid-row:span 2;min-height:310px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.card .more{position:absolute;right:14px;top:12px;color:#7792aa}.icon{font-size:43px;color:#57d4ed;margin-bottom:15px}.card strong{display:block;font-size:16px;font-weight:500}.card small{display:block;margin-top:6px;color:#8da6bd}.toolbar{display:flex;align-items:center;justify-content:space-between;margin:30px 0 16px;gap:12px}.upload{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:6px;background:#2b9fc2;color:#fff;font-weight:600}.upload input{max-width:190px}.back{color:#72d9ef;text-decoration:none}.login{min-height:100vh;display:grid;place-items:center;padding:20px;background:#081321}.login-box{width:min(420px,100%);padding:32px;animation:loginIn .5s ease}@keyframes loginIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none};border:1px solid #31516c;border-radius:15px;background:#122337;box-shadow:0 22px 80px #02070d}.login-box h1{margin:0 0 8px;font-size:25px}.login-box p{color:#91a8bd}.login-box label{display:block;margin-top:16px;color:#9db4c8;font-size:12px}.login-box input{width:100%;margin-top:7px;padding:11px;border:1px solid #3a5670;border-radius:6px;background:#091624;color:#fff;font-size:14px}.login-box button{width:100%;margin-top:20px;padding:11px;border:0;border-radius:6px;background:#31a6c8;color:white;font-weight:700}.error{padding:9px;border-radius:5px;background:#5e2435;color:#ffbec8}.note{margin-top:16px;color:#708aa2;font-size:11px}form{margin:0}@media(max-width:760px){.grid{grid-template-columns:1fr}.card.folder{grid-row:auto;min-height:145px}.hero h1{font-size:29px}.hero .service{top:10px;right:10px}}</style>`
function authPage(mode, message = '') { const register = mode === 'register'; return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project Files · ${register ? 'Crear cuenta' : 'Acceso'}</title>${pageStyles}</head><body><div class="login"><form class="login-box" method="post" action="/share-auth/${register ? 'register' : 'login'}"><div class="icon">▣</div><h1>${register ? 'Crear cuenta' : 'Acceso privado'}</h1><p>${register ? 'Crea un usuario para acceder al espacio compartido.' : 'Inicia sesión para ver los archivos compartidos.'}</p>${message ? `<div class="error">${escapeHtml(message)}</div>` : ''}<label>Usuario<input name="username" required minlength="3" maxlength="40" autocomplete="username"></label><label>Contraseña<input type="password" name="password" required minlength="6" autocomplete="${register ? 'new-password' : 'current-password'}"></label>${register ? '<label>Repetir contraseña<input type="password" name="confirm" required minlength="6" autocomplete="new-password"></label>' : ''}<button type="submit">${register ? 'Crear cuenta' : 'Entrar'}</button><p class="note">${register ? '¿Ya tienes cuenta? <a href="/share-auth/login">Inicia sesión</a>' : '¿Primera vez? <a href="/share-auth/register">Crea tu usuario desde aquí</a>'}</p></form></div></body></html>` }
async function sharePage(title, entries, relativePath, token, user, message = '') { const encodedBase = `/share/${token}/`; const parent = relativePath ? `${encodedBase}${relativePath.split('/').slice(0, -1).map(encodeURIComponent).join('/')}` : encodedBase; const cards = entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name)).map((entry) => { const href = `${encodedBase}${[relativePath, entry.name].filter(Boolean).map(encodeURIComponent).join('/')}`; const ext = path.extname(entry.name).toLowerCase(); const icon = entry.isDirectory() ? '▣' : ['.mp4','.webm','.mov'].includes(ext) ? '▶' : ['.jpg','.jpeg','.png','.gif','.webp'].includes(ext) ? '▧' : ['.pdf'].includes(ext) ? '▤' : '◈'; return `<a class="card ${entry.isDirectory() ? 'folder' : ''}" href="${href}"><span class="more">•••</span><span class="icon">${icon}</span><strong>${escapeHtml(entry.name)}</strong><small>${entry.isDirectory() ? 'Carpeta' : `${(entry.size / 1024 / 1024).toFixed(1)} MB · Archivo`}</small></a>` }).join(''); return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Project Files</title>${pageStyles}</head><body><header class="hero"><div><h1>Compartido en tu red local</h1><p>${escapeHtml(user)}</p></div><span class="service"><i class="dot"></i>Servicio en línea</span></header><main class="wrap"><div class="toolbar"><div><h2 class="section-title">Mis archivos compartidos</h2><p class="sub">Abre carpetas, reproduce imágenes y vídeos o descarga archivos autorizados.</p></div><form class="upload" method="post" action="/share/${token}/upload" enctype="multipart/form-data"><input type="file" name="files" multiple required><button type="submit">Publicar archivos</button></form></div>${message ? `<div class="error">${escapeHtml(message)}</div>` : ''}${relativePath ? `<a class="back" href="${parent}">← Volver</a>` : ''}<section class="grid">${cards || '<p class="sub">Todavía no hay publicaciones. Usa “Publicar archivos” para añadir vídeos, imágenes o cualquier archivo.</p>'}</section><p class="note">Usuario: ${escapeHtml(user)} · <a href="/share/${token}/logout">Cerrar sesión</a> · Los archivos se guardan en el almacenamiento persistente de Project Files.</p></main></body></html>` }

async function socialPage(entries, relativePath, token, user, social) {
  const base = `/share/${token}/`
  const posts = entries.filter((entry) => !entry.isDirectory()).sort((a, b) => b.name.localeCompare(a.name)).map((entry) => {
    const key = entry.name
    const post = social[key] ?? { comments: [], reactions: {} }
    const href = `${base}${encodeURIComponent(entry.name)}`
    const ext = path.extname(entry.name).toLowerCase()
    const preview = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? `<img class="social-media" src="${href}" alt="${escapeHtml(entry.name)}">` : ['.mp4', '.webm', '.mov'].includes(ext) ? `<video class="social-media" controls src="${href}"></video>` : `<div class="file-preview">◈ ${escapeHtml(entry.name)}</div>`
    const reactionButtons = ['🔥', '⚡', '🎮', '❤️', '😂', '😮', '💀'].map((emoji) => `<form method="post" action="${base}react" class="reaction-form"><input type="hidden" name="post" value="${escapeHtml(key)}"><input type="hidden" name="emoji" value="${emoji}"><button class="reaction" type="submit">${emoji} ${post.reactions?.[emoji] ?? 0}</button></form>`).join('')
    const comments = (post.comments ?? []).slice(-8).map((comment) => `<div class="comment"><b>${escapeHtml(comment.user)}</b>${escapeHtml(comment.text)}</div>`).join('')
    return `<article class="social-post"><div class="post-head"><strong>${escapeHtml(entry.name)}</strong><small>${(entry.size / 1024 / 1024).toFixed(1)} MB · publicado en la red local</small></div>${preview}<div class="reaction-bar">${reactionButtons}</div><div class="comment-list">${comments || '<span class="empty-comments">Sé el primero en comentar.</span>'}</div><form method="post" action="${base}comment" class="comment-form"><input type="hidden" name="post" value="${escapeHtml(key)}"><input name="comment" required maxlength="2000" placeholder="Escribe un comentario..."><button type="submit">Publicar</button></form></article>`
  }).join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Modo social · Project Files</title>${pageStyles}<style>.social-feed{max-width:760px;margin:0 auto;display:grid;gap:18px}.social-post{padding:18px;border:1px solid #304860;border-radius:13px;background:linear-gradient(145deg,#16283b,#122133);box-shadow:0 14px 34px #02070d66;animation:cardIn .45s ease}.post-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.post-head strong{font-size:15px}.post-head small{color:#8da6bd;font-size:10px}.social-media{max-width:100%;max-height:440px;display:block;margin:14px auto;border-radius:9px;object-fit:contain;background:#081321}.file-preview{margin:14px 0;padding:30px;text-align:center;border-radius:8px;background:#0b1928;color:#64d6ea;font-size:18px}.reaction-bar{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.reaction-form{margin:0}.reaction{padding:7px 9px;border:1px solid #36536d;border-radius:18px;background:#10283c;color:#d9edf7;cursor:pointer}.reaction:hover{background:#1e5470;transform:translateY(-2px)}.comment{margin-top:12px;padding:8px 10px;border-left:2px solid #48bad6;background:#0b1a2a;color:#c6d9e7;font-size:12px}.comment b{color:#72deed;margin-right:6px}.empty-comments{display:block;margin-top:13px;color:#718aa2;font-size:11px}.comment-form{display:flex;gap:8px;margin-top:12px}.comment-form input{flex:1;padding:9px;border:1px solid #38566e;border-radius:5px;background:#091624;color:#fff}.comment-form button{padding:0 12px;border:0;border-radius:5px;background:#2b9fc2;color:#fff}.mode-badge{display:inline-block;padding:6px 10px;border:1px solid #7b61ff88;border-radius:20px;color:#cfbfff;background:#35266e88;font-size:10px}</style></head><body><header class="hero"><div><h1>Modo social</h1><p>${escapeHtml(user)} · publicaciones, comentarios y reacciones</p></div><span class="service"><i class="dot"></i>Servicio en línea</span></header><main class="wrap"><div class="toolbar"><div><h2 class="section-title">Feed de la red local</h2><p class="sub">Publica vídeos, imágenes o archivos y conversa con emojis gamer.</p></div><form class="upload" method="post" action="/share/${token}/upload" enctype="multipart/form-data"><input type="file" name="files" multiple required><button type="submit">Publicar</button></form></div><section class="social-feed">${posts || '<p class="sub">Todavía no hay publicaciones. Publica el primer archivo.</p>'}</section><p class="note">Usuario: ${escapeHtml(user)} · <a href="/share/${token}/logout">Cerrar sesión</a></p></main></body></html>`
}


async function startShareServer(root, mode = 'files') {
  if (shareServer) await stopShareServer()
  await fs.access(root)
  const token = randomBytes(10).toString('hex')
  await fs.mkdir(shareDataDir(), { recursive: true })
  shareState = { root: path.resolve(root), token, mode: mode === 'social' ? 'social' : 'files', dataDir: shareDataDir() }
  shareServer = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost')
      const prefix = `/share/${token}/`
      if (requestUrl.pathname === '/share-assets/banner.jpg') { const banner = path.join(app.getAppPath(), 'dist', 'share-banner.jpg'); response.writeHead(200, { 'Content-Type': 'image/jpeg' }); createReadStream(banner).pipe(response); return }
      if (requestUrl.pathname === '/share-auth/login' && request.method === 'GET') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(authPage('login')); return }
      if (requestUrl.pathname === '/share-auth/register' && request.method === 'GET') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(authPage('register')); return }
      if (requestUrl.pathname === '/share-auth/login' && request.method === 'POST') {
        const body = await new Promise((resolve) => { let data = ''; request.on('data', (chunk) => { data += chunk.toString() }); request.on('end', () => resolve(new URLSearchParams(data))) })
        const users = await readUsers(); const username = String(body.get('username') ?? '').trim().toLowerCase(); const user = users[username]
        if (!user || !passwordMatches(String(body.get('password') ?? ''), user.hash)) { response.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(authPage('login', 'Usuario o contraseña incorrectos.')); return }
        const session = randomBytes(32).toString('hex'); shareSessions.set(session, username); redirect(response, `/share/${token}/`, `pf_session=${session}; HttpOnly; SameSite=Lax; Path=/`); return
      }
      if (requestUrl.pathname === '/share-auth/register' && request.method === 'POST') {
        const body = await new Promise((resolve) => { let data = ''; request.on('data', (chunk) => { data += chunk.toString() }); request.on('end', () => resolve(new URLSearchParams(data))) })
        const users = await readUsers(); const username = String(body.get('username') ?? '').trim().toLowerCase(); const password = String(body.get('password') ?? '')
        if (!/^[a-z0-9_.-]{3,40}$/.test(username) || password.length < 6 || password !== body.get('confirm')) { response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(authPage('register', 'Usuario inválido o contraseñas diferentes. Usa al menos 6 caracteres.')); return }
        if (users[username]) { response.writeHead(409, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(authPage('register', 'Ese usuario ya existe.')); return }
        users[username] = { hash: passwordHash(password), createdAt: new Date().toISOString() }; await writeUsers(users)
        const session = randomBytes(32).toString('hex'); shareSessions.set(session, username); redirect(response, `/share/${token}/`, `pf_session=${session}; HttpOnly; SameSite=Lax; Path=/`); return
      }
      if (!requestUrl.pathname.startsWith(prefix)) { response.writeHead(404); response.end('Not found'); return }
      const user = sessionUser(request)
      if (!user) { redirect(response, '/share-auth/login'); return }
      if (requestUrl.pathname === `${prefix}logout`) { shareSessions.delete(cookieValue(request, 'pf_session')); redirect(response, '/share-auth/login', 'pf_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/'); return }
      if (requestUrl.pathname === `${prefix}upload` && request.method === 'POST') {
        const busboy = Busboy({ headers: request.headers }); const writes = []
        busboy.on('file', (_field, file, info) => { const safeName = path.basename(info.filename || 'archivo'); const destination = safeChild(shareState.root, `${Date.now()}-${randomBytes(4).toString('hex')}-${safeName}`); const output = require('node:fs').createWriteStream(destination); file.pipe(output); writes.push(new Promise((resolve, reject) => { output.on('finish', resolve); output.on('error', reject); file.on('error', reject) })) })
        busboy.on('finish', async () => { try { await Promise.all(writes); redirect(response, `${prefix}`) } catch { response.writeHead(500); response.end('No se pudo guardar el archivo') } })
        request.pipe(busboy); return
      }
      if ((requestUrl.pathname === `${prefix}react` || requestUrl.pathname === `${prefix}comment`) && request.method === 'POST') {
        const body = await new Promise((resolve) => { let data = ''; request.on('data', (chunk) => { data += chunk.toString() }); request.on('end', () => resolve(new URLSearchParams(data))) })
        const social = await readSocial(); const post = String(body.get('post') ?? ''); social[post] ??= { comments: [], reactions: {} }
        if (requestUrl.pathname.endsWith('/react')) { const emoji = String(body.get('emoji') ?? ''); if (['🔥', '⚡', '🎮', '❤️', '😂', '😮', '💀'].includes(emoji)) social[post].reactions[emoji] = (social[post].reactions[emoji] ?? 0) + 1 }
        else { const text = String(body.get('comment') ?? '').trim(); if (text) social[post].comments.push({ user, text: text.slice(0, 2000), createdAt: new Date().toISOString() }) }
        await writeSocial(social); redirect(response, `${prefix}`); return
      }
      const relative = decodeURIComponent(requestUrl.pathname.slice(prefix.length)).replaceAll('/', path.sep)
      const target = safeChild(shareState.root, relative)
      const stat = await fs.stat(target)
      if (stat.isDirectory()) {
        const entries = await fs.readdir(target, { withFileTypes: true })
        const detailedEntries = await Promise.all(entries.map(async (entry) => { try { return Object.assign(entry, { size: entry.isDirectory() ? 0 : (await fs.stat(path.join(target, entry.name))).size }) } catch { return Object.assign(entry, { size: 0 }) } }))
        const relativeUrl = path.relative(shareState.root, target).split(path.sep).filter(Boolean).join('/')
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(shareState.mode === 'social' && !relativeUrl ? await socialPage(detailedEntries, relativeUrl, token, user, await readSocial()) : await sharePage(path.basename(target) || target, detailedEntries, relativeUrl, token, user)); return
      }
      const extension = path.extname(target).toLowerCase()
      response.writeHead(200, { 'Content-Type': mimeTypes[extension] ?? 'application/octet-stream', 'Content-Length': stat.size, 'Content-Disposition': inlineTypes.has(extension) ? 'inline' : `attachment; filename="${encodeURIComponent(path.basename(target))}"` })
      createReadStream(target).pipe(response)
    } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 403); response.end(error.code === 'ENOENT' ? 'Not found' : 'Access denied') }
  })
  await new Promise((resolve, reject) => { shareServer.once('error', reject); shareServer.listen(0, '0.0.0.0', resolve) })
  const port = shareServer.address().port
  return { root: shareState.root, mode: shareState.mode, port, url: `http://${lanAddress()}:${port}/share/${token}/`, localUrl: `http://127.0.0.1:${port}/share/${token}/` }
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
ipcMain.handle('share-start', (_event, folderPath, mode) => startShareServer(folderPath, mode))
ipcMain.handle('share-stop', () => stopShareServer())
ipcMain.handle('share-status', () => shareState && shareServer ? { root: shareState.root, mode: shareState.mode, port: shareServer.address().port, url: `http://${lanAddress()}:${shareServer.address().port}/share/${shareState.token}/`, localUrl: `http://127.0.0.1:${shareServer.address().port}/share/${shareState.token}/` } : null)
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

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { existsSync } = require('node:fs')
const { execFile } = require('node:child_process')

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
  return Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(folderPath, entry.name)
    const stat = await fs.stat(fullPath)
    return { name: entry.name, path: fullPath, kind: entry.isDirectory() ? 'folder' : 'file', size: stat.size, modified: stat.mtime.toISOString(), type: entry.isDirectory() ? 'Carpeta' : path.extname(entry.name) || 'Archivo' }
  }))
}

function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 860, minWidth: 960, minHeight: 640, title: 'Project Files', backgroundColor: '#101a2a', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false } })
  win.removeMenu()
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('list-directory', (_event, folderPath) => listDirectory(folderPath))
ipcMain.handle('open-default', (_event, filePath) => shell.openPath(filePath))
ipcMain.handle('show-in-folder', (_event, filePath) => shell.showItemInFolder(filePath))
ipcMain.handle('create-folder', async (_event, parentPath, name) => fs.mkdir(safeChild(parentPath, name), { recursive: false }))
ipcMain.handle('copy', async (_event, sourcePaths, destinationPath) => Promise.all(sourcePaths.map(async (source) => fs.cp(source, safeChild(destinationPath, path.basename(source)), { recursive: true, errorOnExist: false }))))
ipcMain.handle('move', async (_event, sourcePaths, destinationPath) => Promise.all(sourcePaths.map(async (source) => fs.rename(source, safeChild(destinationPath, path.basename(source))))))
ipcMain.handle('trash', async (_event, filePath) => shell.trashItem(filePath))
ipcMain.handle('rename', async (_event, filePath, name) => { const destination = safeChild(path.dirname(filePath), name); await fs.rename(filePath, destination); return destination })
ipcMain.handle('read-metadata', async (_event, filePath) => { const stat = await fs.stat(filePath); return { size: stat.size, created: stat.birthtime.toISOString(), modified: stat.mtime.toISOString() } })

app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

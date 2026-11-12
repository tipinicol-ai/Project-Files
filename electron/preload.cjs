const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('projectFilesNative', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  toggleMaximize: () => ipcRenderer.send('window-toggle-maximize'),
  close: () => ipcRenderer.send('window-close'),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  listDirectory: (folderPath) => ipcRenderer.invoke('list-directory', folderPath),
  openDefault: (filePath) => ipcRenderer.invoke('open-default', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  createFolder: (parentPath, name) => ipcRenderer.invoke('create-folder', parentPath, name),
  copy: (sourcePaths, destinationPath) => ipcRenderer.invoke('copy', sourcePaths, destinationPath),
  move: (sourcePaths, destinationPath) => ipcRenderer.invoke('move', sourcePaths, destinationPath),
  trash: (filePath) => ipcRenderer.invoke('trash', filePath),
  rename: (filePath, name) => ipcRenderer.invoke('rename', filePath, name),
  readMetadata: (filePath) => ipcRenderer.invoke('read-metadata', filePath),
})

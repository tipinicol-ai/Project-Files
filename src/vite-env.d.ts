/// <reference types="vite/client" />

type NativeDirectoryEntry = {
  name: string
  path: string
  kind: 'file' | 'folder'
  size: number
  modified: string
  created: string
  type: string
  extension?: string
}

type ProjectFilesNative = {
  platform: string
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  getDrives: () => Promise<NativeDirectoryEntry[]>
  getHomePath: () => Promise<string>
  chooseFolder: () => Promise<string | null>
  chooseFiles: () => Promise<string[]>
  listDirectory: (folderPath: string) => Promise<NativeDirectoryEntry[]>
  openDefault: (filePath: string) => Promise<string>
  showInFolder: (filePath: string) => Promise<void>
  createFolder: (parentPath: string, name: string) => Promise<void>
  copy: (sourcePaths: string[], destinationPath: string) => Promise<void>
  move: (sourcePaths: string[], destinationPath: string) => Promise<void>
  trash: (filePath: string) => Promise<void>
  rename: (filePath: string, name: string) => Promise<string>
  compress: (sourcePaths: string[], destinationZip: string) => Promise<void>
  extract: (archivePath: string, destinationPath: string) => Promise<void>
}

declare global {
  interface Window {
    projectFilesNative?: ProjectFilesNative
  }
}

export {}

/// <reference types="vite/client" />

type NativeDirectoryEntry = {
  name: string
  path: string
  kind: 'file' | 'folder'
  size: number
  free?: number
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
  copy: (sourcePaths: string[], destinationPath: string, jobId?: string) => Promise<void>
  cancelCopy: (jobId: string) => Promise<boolean>
  readText: (filePath: string) => Promise<string>
  writeText: (filePath: string, content: string) => Promise<void>
  move: (sourcePaths: string[], destinationPath: string) => Promise<void>
  trash: (filePath: string) => Promise<void>
  rename: (filePath: string, name: string) => Promise<string>
  compress: (sourcePaths: string[], destinationZip: string) => Promise<void>
  extract: (archivePath: string, destinationPath: string) => Promise<void>
  loadState: () => Promise<Record<string, unknown> | null>
  saveState: (state: Record<string, unknown>) => Promise<void>
  githubList: (username: string, token?: string) => Promise<Array<Record<string, unknown>>>
  githubClone: (cloneUrl: string, destinationPath: string) => Promise<void>
  youtubeDownload: (url: string, quality: string, mode: 'video' | 'audio', destinationPath: string) => Promise<void>
  shareStart: (folderPath: string, mode?: 'files' | 'social') => Promise<{ root: string; mode: 'files' | 'social'; port: number; url: string; localUrl: string }>
  shareStop: () => Promise<void>
  shareStatus: () => Promise<{ root: string; mode: 'files' | 'social'; port: number; url: string; localUrl: string } | null>
}

declare global {
  interface Window {
    projectFilesNative?: ProjectFilesNative
  }
}

export {}

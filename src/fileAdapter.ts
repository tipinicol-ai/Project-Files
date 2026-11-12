export type NativeFile = {
  id: string
  name: string
  kind: 'file' | 'folder'
  path: string
  size: number
  modified: string
  type: string
}

/**
 * Contrato que la interfaz puede consumir cuando se integre con Tauri/Electron/Win32.
 * La preview usa datos en memoria; una implementación nativa debe mapear estas operaciones
 * a APIs de Windows y enviar los cambios de vuelta a React.
 */
export interface FileSystemAdapter {
  list(path: string): Promise<NativeFile[]>
  createFolder(parentPath: string, name: string): Promise<NativeFile>
  copy(paths: string[], destinationPath: string): Promise<void>
  move(paths: string[], destinationPath: string): Promise<void>
  sendToRecycleBin(paths: string[]): Promise<void>
  rename(path: string, name: string): Promise<NativeFile>
  openDefault(path: string): Promise<void>
  compress(paths: string[], destinationZip: string): Promise<void>
  extract(archivePath: string, destinationPath: string): Promise<void>
}

/**
 * Impide que una ruta de un archivo comprimido escriba fuera del directorio elegido.
 * Debe ejecutarse después de obtener la ruta absoluta y antes de crear cada entrada.
 */
export function isSafeExtractionPath(destinationRoot: string, entryName: string): boolean {
  const normalRoot = normalizeForComparison(destinationRoot)
  if (/^(?:[a-z]:[\\/]|[\\/]{2})/i.test(entryName)) return false
  const candidate = normalizeForComparison(`${destinationRoot}/${entryName}`)
  return candidate === normalRoot || candidate.startsWith(`${normalRoot}/`)
}

function normalizeForComparison(value: string): string {
  const parts: string[] = []
  value.replace(/\\/g, '/').split('/').forEach((part) => {
    if (!part || part === '.') return
    if (part === '..') {
      if (parts.length && parts[parts.length - 1] !== '..') parts.pop()
      else parts.push('..')
      return
    }
    parts.push(part)
  })
  return parts.join('/').replace(/\/$/, '').toLowerCase()
}

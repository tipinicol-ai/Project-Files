import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Cloud,
  Copy,
  Download,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  HardDrive,
  Home,
  Info,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Settings2,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import './styles.css'

type ItemKind = 'folder' | 'file'
type ViewMode = 'list' | 'grid'
type SortKey = 'name' | 'modified' | 'size'
type Section = 'files' | 'github'

type FileItem = {
  id: string
  name: string
  kind: ItemKind
  type: string
  size: number
  modified: string
  created: string
  description: string
  tags: string[]
  parentId: string | null
  children?: string[]
  extension?: string
  path?: string
  free?: number
}

type Repo = {
  id: string
  name: string
  owner: string
  description: string
  language: string
  branch: string
  visibility: 'Público' | 'Privado'
  updated: string
  size: number
  localPath: string
  tags: string[]
  cloneUrl?: string
}

const now = '22/03/2021 7:33 AM'
const baseItems: Record<string, FileItem> = {
  root: { id: 'root', name: 'Mi equipo', kind: 'folder', type: 'Carpeta', size: 0, modified: now, created: now, description: 'Archivos y proyectos locales', tags: ['Local'], parentId: null, children: ['q4', 'client', 'research', 'budget', 'logo', 'summary'] },
  q4: { id: 'q4', name: 'Q4 Launch', kind: 'folder', type: 'Carpeta', size: 0, modified: now, created: now, description: 'Assets, documentos y cronogramas de la campaña Q4.', tags: ['Launch', 'Marketing', 'Q4'], parentId: 'root', children: ['q4Brief', 'q4Assets'] },
  q4Brief: { id: 'q4Brief', name: 'Launch_Brief.docx', kind: 'file', type: 'Documento de Word', extension: '.docx', size: 3480000, modified: '22/03/2021 7:33 AM', created: now, description: 'Documento con el brief creativo y los objetivos del lanzamiento.', tags: ['Launch'], parentId: 'q4' },
  q4Assets: { id: 'q4Assets', name: 'Creative Assets', kind: 'folder', type: 'Carpeta', size: 0, modified: '21/03/2021 5:35 AM', created: now, description: 'Material gráfico de la campaña.', tags: ['Design'], parentId: 'q4', children: [] },
  client: { id: 'client', name: 'Client A', kind: 'folder', type: 'Carpeta', size: 0, modified: '22/03/2021 1:35 AM', created: now, description: 'Presentaciones, entregables y recursos del cliente.', tags: ['Client'], parentId: 'root', children: [] },
  research: { id: 'research', name: 'Research', kind: 'folder', type: 'Carpeta', size: 0, modified: '22/03/2021 1:53 AM', created: now, description: 'Notas, referencias y análisis de mercado.', tags: ['Research'], parentId: 'root', children: [] },
  budget: { id: 'budget', name: 'Budget_Oct.xlsx', kind: 'file', type: 'Hoja de cálculo', extension: '.xlsx', size: 4096, modified: '12/03/2021 2:35 AM', created: now, description: 'Presupuesto mensual y previsiones del proyecto.', tags: ['Finance'], parentId: 'root' },
  logo: { id: 'logo', name: 'Logo_Final.png', kind: 'file', type: 'Imagen PNG', extension: '.png', size: 13800, modified: '21/03/2021 5:35 AM', created: now, description: 'Logo final aprobado para el proyecto.', tags: ['Design', 'Brand'], parentId: 'root' },
  summary: { id: 'summary', name: 'Summary.docx', kind: 'file', type: 'Documento de Word', extension: '.docx', size: 3480000000, modified: '22/03/2021 1:59 AM', created: now, description: 'Resumen ejecutivo con objetivos, hitos y próximos pasos.', tags: ['Report'], parentId: 'root' },
}

const repos: Repo[] = [
  { id: 'repo1', name: 'project-files-ui', owner: 'mi-cuenta', description: 'Interfaz de administración de archivos y proyectos.', language: 'TypeScript', branch: 'main', visibility: 'Privado', updated: 'Hoy, 10:42 AM', size: 4_300_000, localPath: 'No descargado', tags: ['UI', 'Project Files'] },
  { id: 'repo2', name: 'launch-assets', owner: 'mi-cuenta', description: 'Recursos creativos para la campaña de lanzamiento.', language: '—', branch: 'main', visibility: 'Público', updated: 'Ayer, 4:18 PM', size: 38_400_000, localPath: 'No descargado', tags: ['Marketing', 'Assets'] },
  { id: 'repo3', name: 'client-dashboard', owner: 'mi-cuenta', description: 'Dashboard de reportes para clientes y entregables.', language: 'React', branch: 'develop', visibility: 'Privado', updated: '08/11/2026', size: 12_800_000, localPath: 'No descargado', tags: ['Client', 'Dashboard'] },
]

const nativeMode = typeof window !== 'undefined' && Boolean(window.projectFilesNative)

function nativePathName(filePath: string) {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath
}

function nativeRepoFromGithub(value: Record<string, unknown>): Repo {
  return { id: String(value.id), name: String(value.name), owner: String((value.owner as Record<string, unknown> | undefined)?.login ?? ''), description: String(value.description ?? 'Sin descripción'), language: String(value.language ?? '—'), branch: String(value.default_branch ?? 'main'), visibility: value.private ? 'Privado' : 'Público', updated: String(value.updated_at ?? ''), size: Number(value.size ?? 0) * 1024, localPath: 'No descargado', tags: [String(value.language ?? 'GitHub')], cloneUrl: String(value.clone_url ?? '') }
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function getIcon(item: FileItem, size = 19) {
  if (item.type === 'Unidad') return <HardDrive size={size} color="#63d7ed" strokeWidth={1.8} />
  if (item.kind === 'folder') return <Folder size={size} fill="#f1b83c" color="#f7c95e" strokeWidth={1.7} />
  if (item.extension === '.xlsx') return <FileSpreadsheet size={size} color="#48bd91" />
  if (item.extension === '.pptx' || item.extension === '.ppt') return <FileSpreadsheet size={size} color="#e77d5e" />
  if (item.extension === '.png' || item.extension === '.jpg') return <FileImage size={size} color="#b77cff" />
  if (['.zip', '.7z', '.rar', '.gz', '.tar'].includes(item.extension ?? '')) return <FileArchive size={size} color="#f0b85d" />
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.rs', '.go', '.c', '.cpp', '.h'].includes(item.extension ?? '')) return <FileCode2 size={size} color="#62b9f4" />
  if (['.docx', '.doc', '.rtf', '.pdf'].includes(item.extension ?? '')) return <FileText size={size} color={item.extension === '.pdf' ? '#ec777d' : '#5e96e6'} />
  if (['.txt', '.md', '.log', '.csv', '.json', '.xml', '.yml', '.yaml', '.ini'].includes(item.extension ?? '')) return <FileText size={size} color="#b6c8de" />
  if (['.mp4', '.mkv', '.avi', '.mov', '.webm', '.mp3', '.wav', '.flac'].includes(item.extension ?? '')) return <FileImage size={size} color="#d58bea" />
  if (['.exe', '.msi', '.bat', '.cmd', '.com'].includes(item.extension ?? '')) return <FileCode2 size={size} color="#8dd7b4" />
  return <File size={size} color="#9caec8" />
}

function getRepoIcon(repo: Repo, size = 19) {
  return repo.visibility === 'Privado' ? <ShieldCheck size={size} color="#83d9ef" /> : <GitBranch size={size} color="#d5dceb" />
}

function getFolderSize(id: string, items: Record<string, FileItem>): number {
  const item = items[id]
  if (!item) return 0
  if (item.kind === 'file') return item.size
  return (item.children ?? []).reduce((sum, childId) => sum + getFolderSize(childId, items), 0)
}

function cloneTree(id: string, parentId: string, source: Record<string, FileItem>, target: Record<string, FileItem>, suffix = 'copy'): string {
  const original = source[id]
  const newId = `${id}-${suffix}-${Math.random().toString(36).slice(2, 7)}`
  const copy: FileItem = { ...original, id: newId, parentId, name: original.name, children: original.children ? [] : undefined }
  target[newId] = copy
  if (original.children) {
    copy.children = original.children.map((childId) => cloneTree(childId, newId, source, target, suffix))
  }
  return newId
}

function App() {
  const [items, setItems] = useState<Record<string, FileItem>>(baseItems)
  const [currentFolderId, setCurrentFolderId] = useState('root')
  const [navigation, setNavigation] = useState(['root'])
  const [navigationIndex, setNavigationIndex] = useState(0)
  const [selection, setSelection] = useState<string[]>(nativeMode ? [] : ['q4'])
  const [repoSelection, setRepoSelection] = useState<string[]>([])
  const [section, setSection] = useState<Section>('files')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDescending, setSortDescending] = useState(false)
  const [query, setQuery] = useState('')
  const [clipboard, setClipboard] = useState<{ ids: string[]; mode: 'copy' | 'move' } | null>(null)
  const [toast, setToast] = useState('')
  const [copyDialog, setCopyDialog] = useState<{ mode: 'copy' | 'move'; names: string[]; status: 'working' | 'done' | 'error' | 'cancelled'; message: string; jobId?: string } | null>(null)
  const [textEditor, setTextEditor] = useState<{ path: string; name: string; content: string; dirty: boolean } | null>(null)
  const [youtubePanel, setYoutubePanel] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeQuality, setYoutubeQuality] = useState('1080')
  const [youtubeMode, setYoutubeMode] = useState<'video' | 'audio'>('video')
  const [youtubeBusy, setYoutubeBusy] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [repoDownloaded, setRepoDownloaded] = useState<Record<string, string>>({})
  const [repoData, setRepoData] = useState<Repo[]>(nativeMode ? [] : repos)
  const [githubLoading, setGithubLoading] = useState(false)
  const [nativeLoading, setNativeLoading] = useState(nativeMode)
  const [metadataByPath, setMetadataByPath] = useState<Record<string, { description: string; tags: string[] }>>({})
  const [folderDialog, setFolderDialog] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [detailsDraft, setDetailsDraft] = useState<{ description: string; tags: string } | null>(null)
  const [githubDialog, setGithubDialog] = useState(false)
  const [githubUser, setGithubUser] = useState(() => localStorage.getItem('project-files-github-user') ?? '')
  const [githubToken, setGithubToken] = useState('')
  const [shareDialog, setShareDialog] = useState(false)
  const [shareInfo, setShareInfo] = useState<{ root: string; mode: 'files' | 'social'; port: number; url: string; localUrl: string } | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareMode, setShareMode] = useState<'files' | 'social'>('files')

  const currentFolder = items[currentFolderId]
  const selectedItems = selection.map((id) => items[id]).filter(Boolean)
  const selectedRepo = repoSelection.length ? repoData.find((repo) => repo.id === repoSelection[0]) : undefined

  const breadcrumb = useMemo(() => {
    const chain: FileItem[] = []
    let cursor: FileItem | undefined = currentFolder
    while (cursor) {
      chain.unshift(cursor)
      cursor = cursor.parentId ? items[cursor.parentId] : undefined
    }
    return chain
  }, [currentFolder, items])

  const visibleItems = useMemo(() => {
    const source = query.trim()
      ? Object.values(items).filter((item) => item.id !== 'root' && item.name.toLowerCase().includes(query.toLowerCase()))
      : (currentFolder?.children ?? []).map((id) => items[id]).filter(Boolean)
    return [...source].sort((a, b) => {
      const result = sortKey === 'name' ? a.name.localeCompare(b.name) : sortKey === 'size' ? a.size - b.size : a.modified.localeCompare(b.modified)
      return sortDescending ? -result : result
    })
  }, [currentFolder, items, query, sortDescending, sortKey])

  const detailsItem = selectedItems.length === 1 ? selectedItems[0] : undefined
  const totalSelectedSize = selectedItems.reduce((sum, item) => sum + (item.kind === 'folder' ? getFolderSize(item.id, items) : item.size), 0)
  const detailFolderStats = detailsItem?.kind === 'folder' ? (detailsItem.children ?? []).reduce((stats, id) => { const child = items[id]; if (!child) return stats; child.kind === 'folder' ? stats.folders += 1 : stats.files += 1; return stats }, { folders: 0, files: 0 }) : null

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const listener = (event: globalThis.MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.context-menu')) setContextMenu(null)
    }
    window.addEventListener('click', listener)
    return () => window.removeEventListener('click', listener)
  }, [])

  const notify = (message: string) => setToast(message)

  const openShareDialog = async () => {
    if (!nativeMode || !window.projectFilesNative) return notify('El servidor local funciona en el instalador de Windows')
    setShareDialog(true)
    try { setShareInfo(await window.projectFilesNative.shareStatus()) } catch { setShareInfo(null) }
  }

  const startShare = async () => {
    if (!window.projectFilesNative) return
    const folder = await window.projectFilesNative.chooseFolder()
    if (!folder) return
    setShareBusy(true)
    try { setShareInfo(await window.projectFilesNative.shareStart(folder, shareMode)); notify(shareMode === 'social' ? 'Modo social levantado en tu red' : 'Servidor local levantado en tu red') } catch (error) { notify(`No se pudo levantar el servidor: ${error instanceof Error ? error.message : 'error desconocido'}`) }
    finally { setShareBusy(false) }
  }

  const stopShare = async () => {
    if (!window.projectFilesNative) return
    await window.projectFilesNative.shareStop()
    setShareInfo(null)
    notify('Servidor local cerrado')
  }

  const refreshNativeFolder = async (folderPath = currentFolderId, pushHistory = false) => {
    if (!window.projectFilesNative) return
    setNativeLoading(true)
    try {
      const entries = await window.projectFilesNative.listDirectory(folderPath)
      const parentPath = items[folderPath]?.parentId ?? (folderPath.split(/[\\/]/).slice(0, -1).join(folderPath.includes('\\') ? '\\' : '/') || null)
      const folder: FileItem = { id: folderPath, path: folderPath, name: nativePathName(folderPath), kind: 'folder', type: 'Carpeta', size: entries.reduce((sum, entry) => sum + (entry.kind === 'file' ? entry.size : 0), 0), modified: '', created: '', description: folderPath, tags: [], parentId: parentPath, children: entries.map((entry) => entry.path) }
      setItems((previous) => {
        const next = { ...previous, [folderPath]: folder }
        entries.forEach((entry) => { const metadata = metadataByPath[entry.path]; next[entry.path] = { id: entry.path, path: entry.path, name: entry.name, kind: entry.kind, type: entry.type, extension: entry.extension || '', size: entry.size, modified: entry.modified, created: entry.created, description: metadata?.description ?? entry.path, tags: metadata?.tags ?? [], parentId: folderPath, children: entry.kind === 'folder' ? [] : undefined } })
        return next
      })
      setCurrentFolderId(folderPath)
      setSelection([])
      setQuery('')
      if (pushHistory) {
        const next = [...navigation.slice(0, navigationIndex + 1), folderPath]
        setNavigation(next)
        setNavigationIndex(next.length - 1)
      }
    } catch (error) {
      if (nativeMode) {
        const emptyComputer: FileItem = { id: 'computer', name: 'Este equipo', kind: 'folder', type: 'Equipo', size: 0, modified: '', created: '', description: 'No se pudo leer esta ubicación', tags: [], parentId: null, children: [] }
        setItems({ computer: emptyComputer })
        setCurrentFolderId('computer')
        setSelection([])
      }
      notify(`No se pudo leer la carpeta: ${error instanceof Error ? error.message : 'permiso denegado'}`)
    } finally { setNativeLoading(false) }
  }

  const refreshNativeDrives = async () => {
    if (!window.projectFilesNative) return
    setNativeLoading(true)
    try {
      const drives = await window.projectFilesNative.getDrives()
      const computer: FileItem = { id: 'computer', name: 'Este equipo', kind: 'folder', type: 'Equipo', size: 0, modified: '', created: '', description: 'Discos y unidades conectados a este PC', tags: [], parentId: null, children: drives.map((drive) => drive.path) }
      setItems((previous) => {
        const next: Record<string, FileItem> = { ...previous, computer }
        drives.forEach((drive) => { next[drive.path] = { id: drive.path, path: drive.path, name: drive.name, kind: 'folder', type: 'Unidad', size: drive.size, free: drive.free, modified: '', created: '', description: drive.path, tags: [], parentId: 'computer', children: [] } })
        return next
      })
      setCurrentFolderId('computer')
      setNavigation(['computer'])
      setNavigationIndex(0)
      setSelection([])
      setQuery('')
    } catch (error) { notify(`No se pudieron detectar los discos: ${error instanceof Error ? error.message : 'error desconocido'}`) }
    finally { setNativeLoading(false) }
  }

  useEffect(() => {
    if (!nativeMode || !window.projectFilesNative) return
    void window.projectFilesNative.loadState().then((saved) => {
      const savedFolder = typeof saved?.currentFolderId === 'string' ? saved.currentFolderId : ''
      if (saved?.metadata && typeof saved.metadata === 'object') setMetadataByPath(saved.metadata as Record<string, { description: string; tags: string[] }>)
      if (Array.isArray(saved?.navigation)) setNavigation(saved.navigation.filter((value): value is string => typeof value === 'string'))
      if (typeof saved?.navigationIndex === 'number') setNavigationIndex(saved.navigationIndex)
      if (saved?.viewMode === 'list' || saved?.viewMode === 'grid') setViewMode(saved.viewMode)
      if (saved?.sortKey === 'name' || saved?.sortKey === 'modified' || saved?.sortKey === 'size') setSortKey(saved.sortKey)
      if (typeof saved?.sortDescending === 'boolean') setSortDescending(saved.sortDescending)
      if (typeof saved?.query === 'string') setQuery(saved.query)
      return refreshNativeDrives().then(() => savedFolder && savedFolder !== 'computer' ? refreshNativeFolder(savedFolder) : undefined)
    }).catch(() => refreshNativeDrives())
    document.body.classList.add('native-app')
    return () => document.body.classList.remove('native-app')
  }, [])

  useEffect(() => {
    if (!nativeMode || !window.projectFilesNative) return
    void window.projectFilesNative.saveState({ currentFolderId, navigation, navigationIndex, viewMode, sortKey, sortDescending, query, metadata: metadataByPath })
  }, [currentFolderId, navigation, navigationIndex, viewMode, sortKey, sortDescending, query, metadataByPath])

  const goToFolder = (id: string, fromHistory = false) => {
    if (nativeMode) {
      if (id === 'computer') {
        void refreshNativeDrives()
        return
      }
      void refreshNativeFolder(id, !fromHistory)
      return
    }
    if (!items[id] || items[id].kind !== 'folder') return
    setCurrentFolderId(id)
    setSelection([])
    setQuery('')
    if (!fromHistory) {
      const next = [...navigation.slice(0, navigationIndex + 1), id]
      setNavigation(next)
      setNavigationIndex(next.length - 1)
    }
  }

  const navigateHistory = (direction: -1 | 1) => {
    const nextIndex = navigationIndex + direction
    if (nextIndex < 0 || nextIndex >= navigation.length) return
    setNavigationIndex(nextIndex)
    goToFolder(navigation[nextIndex], true)
  }

  const handleRowClick = (event: MouseEvent, id: string) => {
    setContextMenu(null)
    if (section === 'github') {
      setRepoSelection(event.ctrlKey || event.metaKey ? (repoSelection.includes(id) ? repoSelection.filter((value) => value !== id) : [...repoSelection, id]) : [id])
      return
    }
    setSelection(event.ctrlKey || event.metaKey ? (selection.includes(id) ? selection.filter((value) => value !== id) : [...selection, id]) : [id])
  }

  const createFolder = () => {
    setFolderName('')
    setFolderDialog(true)
  }

  const submitCreateFolder = async () => {
    const name = folderName.trim()
    if (!name) return notify('Escribe un nombre para la carpeta')
    setFolderDialog(false)
    if (nativeMode && currentFolderId === 'computer') {
      const destination = await window.projectFilesNative?.chooseFolder()
      if (!destination) return
      void window.projectFilesNative!.createFolder(destination, name).then(() => { setCurrentFolderId(destination); return refreshNativeFolder(destination, true) }).then(() => notify(`Carpeta “${name}” creada`)).catch((error) => notify(`No se pudo crear la carpeta: ${error.message}`))
      return
    }
    if (nativeMode && window.projectFilesNative) {
      void window.projectFilesNative.createFolder(currentFolderId, name).then(() => refreshNativeFolder()).then(() => notify(`Carpeta “${name}” creada`)).catch((error) => notify(`No se pudo crear la carpeta: ${error.message}`))
      return
    }
    const id = `folder-${Date.now()}`
    setItems((previous) => ({ ...previous, [id]: { id, name, kind: 'folder', type: 'Carpeta', size: 0, modified: 'Ahora', created: 'Ahora', description: 'Carpeta creada desde Project Files.', tags: [], parentId: currentFolderId, children: [] }, [currentFolderId]: { ...previous[currentFolderId], children: [...(previous[currentFolderId].children ?? []), id] } }))
    notify(`Carpeta “${name}” creada`)
  }

  const renameSelected = (id = selection[0]) => {
    const item = items[id]
    if (!item) return
    const name = window.prompt('Nuevo nombre', item.name)?.trim()
    if (!name || name === item.name) return
    if (nativeMode && window.projectFilesNative && item.path) {
      void window.projectFilesNative.rename(item.path, name).then(() => refreshNativeFolder()).then(() => notify(`“${item.name}” ahora se llama “${name}”`)).catch((error) => notify(`No se pudo cambiar el nombre: ${error.message}`))
      return
    }
    setItems((previous) => ({ ...previous, [id]: { ...previous[id], name, modified: 'Ahora' } }))
    notify(`“${item.name}” ahora se llama “${name}”`)
  }

  const removeSubtree = (id: string, record: Record<string, FileItem>) => {
    const item = record[id]
    if (!item) return
    item.children?.forEach((childId) => removeSubtree(childId, record))
    delete record[id]
  }

  const deleteSelected = (ids = selection) => {
    if (!ids.length) return
    const names = ids.map((id) => items[id]?.name).filter(Boolean).join(', ')
    if (!window.confirm(`¿Enviar a la Papelera estos elementos?\n\n${names}`)) return
    if (nativeMode && window.projectFilesNative) {
      void Promise.all(ids.map((id) => items[id]?.path ? window.projectFilesNative!.trash(items[id].path!) : Promise.resolve())).then(() => refreshNativeFolder()).then(() => notify('Elementos enviados a la Papelera')).catch((error) => notify(`No se pudieron enviar a la Papelera: ${error.message}`))
      return
    }
    setItems((previous) => {
      const next = { ...previous }
      ids.forEach((id) => {
        const parentId = next[id]?.parentId
        if (parentId && next[parentId]) next[parentId] = { ...next[parentId], children: (next[parentId].children ?? []).filter((childId) => childId !== id) }
        removeSubtree(id, next)
      })
      return next
    })
    setSelection([])
    notify('Elementos enviados a la Papelera')
  }

  const paste = () => {
    if (!clipboard?.ids.length) return notify('No hay elementos copiados')
    if (nativeMode && window.projectFilesNative) {
      const paths = clipboard.ids.map((id) => items[id]?.path).filter(Boolean) as string[]
      const names = clipboard.ids.map((id) => items[id]?.name).filter(Boolean) as string[]
      const operationMode = clipboard.mode
      const jobId = `copy-${Date.now()}`
      setCopyDialog({ mode: operationMode, names, status: 'working', message: 'Preparando la operación…', jobId })
      const operation = clipboard.mode === 'move' ? window.projectFilesNative.move(paths, currentFolderId) : window.projectFilesNative.copy(paths, currentFolderId, jobId)
      void operation.then(() => refreshNativeFolder()).then(() => { setClipboard(null); setCopyDialog((dialog) => dialog?.jobId === jobId ? { ...dialog, status: 'done', message: operationMode === 'move' ? 'Movimiento completado correctamente' : 'Copia completada correctamente' } : dialog); notify(operationMode === 'move' ? 'Elementos movidos' : 'Elementos copiados') }).catch((error) => { const cancelled = error instanceof Error && error.message === 'COPY_CANCELLED'; setCopyDialog((dialog) => dialog?.jobId === jobId ? { ...dialog, status: cancelled ? 'cancelled' : 'error', message: cancelled ? 'Copia cancelada' : error.message } : dialog); if (!cancelled) notify(`No se pudo completar la operación: ${error instanceof Error ? error.message : 'error desconocido'}`) })
      return
    }
    setItems((previous) => {
      const next = { ...previous }
      const pastedIds = clipboard.ids.map((id) => {
        const source = next[id]
        if (!source) return null
        if (clipboard.mode === 'move') {
          if (source.parentId && next[source.parentId]) next[source.parentId] = { ...next[source.parentId], children: (next[source.parentId].children ?? []).filter((childId) => childId !== id) }
          next[id] = { ...source, parentId: currentFolderId }
          return id
        }
        return cloneTree(id, currentFolderId, next, next)
      }).filter(Boolean) as string[]
      next[currentFolderId] = { ...next[currentFolderId], children: [...(next[currentFolderId].children ?? []), ...pastedIds] }
      return next
    })
    setClipboard(null)
    notify(clipboard.mode === 'move' ? 'Elementos movidos' : 'Elementos copiados')
  }

  const compressSelected = (ids = selection) => {
    if (!ids.length) return notify('Selecciona elementos para comprimir')
    const name = window.prompt('Nombre del archivo ZIP', 'project-files.zip')?.trim()
    if (!name) return
    const archiveName = name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`
    if (nativeMode && window.projectFilesNative) {
      const destination = `${currentFolderId.replace(/[\\/]$/, '')}${currentFolderId.includes('\\') ? '\\' : '/'}${archiveName}`
      const paths = ids.map((id) => items[id]?.path).filter(Boolean) as string[]
      void window.projectFilesNative.compress(paths, destination).then(() => refreshNativeFolder()).then(() => notify(`“${archiveName}” creado sin modificar los originales`)).catch((error) => notify(`No se pudo crear el ZIP: ${error.message}`))
      return
    }
    const id = `zip-${Date.now()}`
    const total = ids.reduce((sum, itemId) => sum + getFolderSize(itemId, items), 0)
    setItems((previous) => ({ ...previous, [id]: { id, name: archiveName, kind: 'file', type: 'Archivo ZIP', extension: '.zip', size: Math.max(1024, Math.round(total * 0.62)), modified: 'Ahora', created: 'Ahora', description: `Archivo comprimido con ${ids.length} elemento(s).`, tags: ['ZIP'], parentId: currentFolderId }, [currentFolderId]: { ...previous[currentFolderId], children: [...(previous[currentFolderId].children ?? []), id] } }))
    notify(`“${archiveName}” creado sin modificar los originales`)
  }

  const extractZip = (id: string) => {
    const archive = items[id]
    if (!archive || archive.extension !== '.zip') return notify('Selecciona un archivo ZIP')
    const folderId = `extract-${Date.now()}`
    const folderName = archive.name.replace(/\.zip$/i, '')
    if (nativeMode && window.projectFilesNative && archive.path) {
      const destination = `${currentFolderId.replace(/[\\/]$/, '')}${currentFolderId.includes('\\') ? '\\' : '/'}${folderName}`
      void window.projectFilesNative.extract(archive.path, destination).then(() => refreshNativeFolder()).then(() => notify(`Contenido de “${archive.name}” extraído aquí`)).catch((error) => notify(`No se pudo extraer el ZIP: ${error.message}`))
      return
    }
    setItems((previous) => ({ ...previous, [folderId]: { id: folderId, name: folderName, kind: 'folder', type: 'Carpeta', size: 0, modified: 'Ahora', created: 'Ahora', description: `Contenido extraído de ${archive.name}.`, tags: ['Extraído'], parentId: currentFolderId, children: [] }, [currentFolderId]: { ...previous[currentFolderId], children: [...(previous[currentFolderId].children ?? []), folderId] } }))
    notify(`Contenido de “${archive.name}” extraído aquí`)
  }

  const editDescription = () => {
    if (!detailsItem) return
    setDetailsDraft({ description: detailsItem.description ?? '', tags: detailsItem.tags.join(', ') })
  }

  const editDetails = () => {
    if (!detailsItem) return
    setDetailsDraft({ description: detailsItem.description ?? '', tags: detailsItem.tags.join(', ') })
  }

  const saveDetails = () => {
    if (!detailsItem || !detailsDraft) return
    const { description } = detailsDraft
    const tags = detailsDraft.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    setItems((previous) => ({ ...previous, [detailsItem.id]: { ...previous[detailsItem.id], description, tags } }))
    if (nativeMode && detailsItem.path) setMetadataByPath((previous) => ({ ...previous, [detailsItem.path!]: { description, tags } }))
    setDetailsDraft(null)
    notify('Detalles y etiquetas guardados')
  }

  const openSelected = (item: FileItem) => {
    if (item.kind === 'folder') goToFolder(item.id)
    else if (nativeMode && window.projectFilesNative && item.path && ['.txt', '.md', '.log', '.json', '.js', '.ts', '.tsx', '.css', '.html', '.yml', '.yaml', '.xml', '.csv'].includes(item.extension ?? '')) void window.projectFilesNative.readText(item.path).then((content) => setTextEditor({ path: item.path!, name: item.name, content, dirty: false })).catch((error) => notify(`No se pudo abrir el editor: ${error.message}`))
    else if (nativeMode && window.projectFilesNative && item.path) void window.projectFilesNative.openDefault(item.path).then((error) => error && notify(error)).catch((error) => notify(`No se pudo abrir el archivo: ${error.message}`))
    else notify(`Abriendo “${item.name}” con el programa predeterminado`)
  }

  const cancelCopy = async () => {
    if (!copyDialog?.jobId || !window.projectFilesNative) return
    const jobId = copyDialog.jobId
    await window.projectFilesNative.cancelCopy(jobId)
    setCopyDialog((dialog) => dialog && dialog.jobId === jobId ? { ...dialog, status: 'cancelled', message: 'Cancelando copia…' } : dialog)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'F2' && selection.length) { event.preventDefault(); renameSelected(); return }
    if (event.key === 'Delete' && selection.length) { event.preventDefault(); deleteSelected(); return }
    if (event.key === 'Enter' && selection.length === 1) { event.preventDefault(); const item = items[selection[0]]; if (item) openSelected(item); return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); setClipboard({ ids: selection, mode: 'copy' }); notify('Copia lista para pegar en otra carpeta'); return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') { event.preventDefault(); setClipboard({ ids: selection, mode: 'move' }); notify('Elementos listos para mover'); return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); paste(); return }
    if (event.key === 'Backspace') { event.preventDefault(); navigateHistory(-1) }
  }

  const handleContextMenu = (event: MouseEvent, id: string) => {
    event.preventDefault()
    if (!selection.includes(id)) setSelection([id])
    setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 230), y: Math.min(event.clientY, window.innerHeight - 310), id })
  }

  const loadGithub = async () => {
    if (!nativeMode || !window.projectFilesNative) return notify('GitHub real está disponible en el instalador de Windows')
    const username = githubUser.trim()
    if (!username) return notify('Escribe tu usuario de GitHub')
    localStorage.setItem('project-files-github-user', username)
    setGithubLoading(true)
    try {
      const remoteRepos = await window.projectFilesNative.githubList(username, githubToken.trim())
      const mapped = remoteRepos.map(nativeRepoFromGithub)
      setRepoData(mapped)
      setRepoSelection(mapped.length ? [mapped[0].id] : [])
      notify(`${mapped.length} repositorio(s) cargado(s) desde GitHub`)
      setGithubDialog(false)
    } catch (error) { notify(`No se pudieron cargar los repositorios: ${error instanceof Error ? error.message : 'error de GitHub'}`) }
    finally { setGithubLoading(false) }
  }

  const downloadRepo = (repo: Repo) => {
    if (nativeMode && window.projectFilesNative && repo.cloneUrl) {
      void window.projectFilesNative.chooseFolder().then((folder) => {
        if (!folder) return
        const destination = `${folder.replace(/[\\/]$/, '')}${folder.includes('\\') ? '\\' : '/'}${repo.name}`
        return window.projectFilesNative!.githubClone(repo.cloneUrl!, destination).then(() => { setRepoDownloaded((previous) => ({ ...previous, [repo.id]: destination })); notify(`“${repo.name}” descargado en ${destination}`) })
      }).catch((error) => notify(`No se pudo descargar “${repo.name}”: ${error.message}`))
      return
    }
    setRepoDownloaded((previous) => ({ ...previous, [repo.id]: `C:\\Users\\Usuario\\Projects\\${repo.name}` }))
    notify(`Descarga de “${repo.name}” completada en Proyectos`)
  }

  const downloadYoutube = async () => {
    if (!nativeMode || !window.projectFilesNative) return notify('El descargador funciona en el instalador de Windows')
    if (!youtubeUrl.trim()) return notify('Introduce la URL de YouTube')
    const folder = await window.projectFilesNative.chooseFolder()
    if (!folder) return
    setYoutubeBusy(true)
    try {
      await window.projectFilesNative.youtubeDownload(youtubeUrl.trim(), youtubeQuality, youtubeMode, folder)
      notify('Descarga terminada en la carpeta seleccionada')
      setYoutubeUrl('')
    } catch (error) { notify(`No se pudo descargar: ${error instanceof Error ? error.message : 'asegúrate de tener yt-dlp instalado'}`) }
    finally { setYoutubeBusy(false) }
  }

  const selectedRepoData = selectedRepo ? { ...selectedRepo, localPath: repoDownloaded[selectedRepo.id] ?? selectedRepo.localPath } : undefined

  return (
    <main className="desktop-stage" onKeyDown={handleKeyDown} tabIndex={0}>
      <section className="app-window">
        <header className="titlebar">
          <div className="brand-lockup">
            <div className="app-mark"><Folder size={17} fill="#64d6ed" color="#9aeeff" /></div>
            <span>Project Files</span>
          </div>
          <div className="window-caption">Administrador de archivos</div>
          <div className="window-controls" aria-label="Controles de ventana"><button aria-label="Minimizar" onClick={() => window.projectFilesNative?.minimize()}>—</button><button aria-label="Maximizar" onClick={() => window.projectFilesNative?.toggleMaximize()}>□</button><button aria-label="Cerrar" className="close" onClick={() => window.projectFilesNative?.close()}>×</button></div>
        </header>

        <div className="toolbar">
          <div className="toolbar-actions">
            <button className="toolbar-button" onClick={createFolder}><FolderPlus size={17} />Nueva carpeta</button>
            <button className="toolbar-button" onClick={() => { if (nativeMode && window.projectFilesNative) void window.projectFilesNative.chooseFiles().then((paths) => paths.length ? window.projectFilesNative!.copy(paths, currentFolderId).then(() => refreshNativeFolder()) : undefined).catch((error) => notify(`No se pudieron importar los archivos: ${error.message}`)); else notify('Selecciona una carpeta real desde el instalador de Windows') }}><Upload size={17} />Importar archivos</button>
          </div>
          <div className="search-wrap"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." /><kbd>Ctrl F</kbd>{query && <button className="clear-search" onClick={() => setQuery('')}><X size={14} /></button>}</div>
          <div className="toolbar-actions toolbar-right">
            <button className="toolbar-icon" title="Ordenar" onClick={() => setSortDescending((value) => !value)}><ArrowDown size={16} className={sortDescending ? 'rotated' : ''} /><span>Ordenar</span><ChevronDown size={13} /></button>
            <button className="toolbar-icon" title="Cambiar vista" onClick={() => setViewMode((value) => value === 'list' ? 'grid' : 'list')}>{viewMode === 'list' ? <List size={16} /> : <LayoutGrid size={16} />}<span>{viewMode === 'list' ? 'Lista/Detalles' : 'Cuadrícula'}</span><ChevronDown size={13} /></button>
            <button className="toolbar-icon" title="Configuración"><Settings2 size={16} /></button>
            <button className="help-button" title="Ayuda"><Info size={15} /></button>
          </div>
        </div>

        <div className="workspace">
          <aside className="sidebar">
            <div className="sidebar-heading">Mi equipo</div>
            <nav className="nav-list">
              {nativeMode ? <>
                <button className={section === 'files' && currentFolderId === 'computer' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('files'); void refreshNativeDrives() }}><Home size={16} />Este equipo</button>
                <button className="nav-item" onClick={() => { if (window.projectFilesNative) void window.projectFilesNative.chooseFolder().then((folder) => { if (folder) return refreshNativeFolder(folder, true) }) }}><FolderOpen size={16} />Abrir carpeta</button>
                <button className={section === 'github' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('github'); setGithubDialog(true) }}><GitBranch size={16} />Proyectos de GitHub</button>
                <button className={shareInfo ? 'nav-item share-active' : 'nav-item'} onClick={() => void openShareDialog()}><Cloud size={16} />Servidor en red {shareInfo && <span className="share-dot" />}</button>
                <button className={youtubePanel ? 'nav-item active' : 'nav-item'} onClick={() => setYoutubePanel(true)}><Download size={16} />Descargador multimedia</button>
                <button className="nav-item" onClick={() => document.querySelector<HTMLInputElement>('.search-wrap input')?.focus()}><Search size={16} />Buscar</button>
              </> : <>
                <button className={section === 'files' && currentFolderId === 'root' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('files'); goToFolder('root') }}><Home size={16} />Inicio</button>
                <button className={section === 'files' && currentFolderId === 'q4' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('files'); goToFolder('q4') }}><FolderOpen size={16} />Project Archives</button>
                <button className="nav-item" onClick={() => { setSection('files'); goToFolder('root'); setQuery('Documentos') }}><FileText size={16} />Documentos</button>
                <button className="nav-item" onClick={() => { setSection('files'); goToFolder('root'); setQuery('') }}><HardDrive size={16} />Este equipo</button>
                <button className={section === 'github' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('github'); setRepoSelection(['repo1']); setSelection([]) }}><GitBranch size={16} />Proyectos de GitHub</button>
                <button className="nav-item" onClick={() => notify('Las etiquetas locales se mostrarán aquí')}><Tag size={16} />Etiquetas</button>
                <button className="nav-item" onClick={() => document.querySelector<HTMLInputElement>('.search-wrap input')?.focus()}><Search size={16} />Buscar</button>
              </>}
            </nav>
            <div className="sidebar-divider" />
            <div className="sidebar-heading recent-heading">Carpetas recientes <MoreHorizontal size={15} /></div>
            <div className="recent-list">
              {nativeMode ? <button className="recent-item" onClick={() => window.projectFilesNative?.chooseFolder().then((folder) => { if (folder) return refreshNativeFolder(folder, true) })}><Folder size={15} fill="#eab64a" color="#f4c45d" />Elegir ubicación</button> : ['Q4 Marketing Plan', 'Client Presentations', 'Design Assets'].map((label) => <button key={label} className="recent-item" onClick={() => notify(`Ruta reciente: ${label}`)}><Folder size={15} fill="#eab64a" color="#f4c45d" />{label}</button>)}
            </div>
            <div className="sidebar-spacer" />
            <div className="storage-card"><div className="storage-title"><Cloud size={15} /> {nativeMode ? 'Unidades reales' : 'Almacenamiento local'}</div>{nativeMode ? <div className="storage-meta"><span>Discos del PC</span><span>Actualizado</span></div> : <><div className="storage-bar"><span /></div><div className="storage-meta"><span>68.4 GB usados</span><span>256 GB</span></div></>}</div>
          </aside>

          <section className="content-panel">
            <div className="content-header">
              <div className="breadcrumbs">
                {section === 'github' ? <><GitBranch size={15} /><span>Proyectos de GitHub</span></> : breadcrumb.map((crumb, index) => <span className="crumb-group" key={crumb.id}><button className={index === breadcrumb.length - 1 ? 'crumb current' : 'crumb'} onClick={() => goToFolder(crumb.id)}>{index === 0 ? <Home size={14} /> : null}{crumb.name}</button>{index < breadcrumb.length - 1 && <ChevronRight size={14} className="crumb-chevron" />}</span>)}
              </div>
              <div className="content-actions">
                {section === 'files' && <><button className="round-action" title="Pegar" onClick={paste}><Clipboard size={15} /></button><button className="round-action" title="Subir un nivel" onClick={() => currentFolder?.parentId && goToFolder(currentFolder.parentId)}><ArrowUp size={15} /></button></>}
                <button className="round-action" title="Actualizar" onClick={() => nativeMode ? (currentFolderId === 'computer' ? refreshNativeDrives() : refreshNativeFolder()) : notify('Carpeta actualizada')}><RefreshCw size={15} /></button>
              </div>
            </div>
            <div className="content-title-row"><div><h1>{section === 'github' ? 'Mis repositorios' : currentFolder?.name ?? (nativeLoading ? 'Cargando…' : 'Mi equipo')}</h1><p>{section === 'github' ? 'Descarga copias locales de tus proyectos' : query ? `${visibleItems.length} resultado(s) para “${query}”` : `${visibleItems.length} elementos`}</p></div><div className="sort-select"><span>Ordenar por</span><button onClick={() => setSortKey(sortKey === 'name' ? 'modified' : sortKey === 'modified' ? 'size' : 'name')}>{sortKey === 'name' ? 'Nombre' : sortKey === 'modified' ? 'Fecha' : 'Tamaño'} <ChevronDown size={13} /></button></div></div>

            {section === 'github' ? <div className="file-list github-list">
              <div className="list-head"><span className="name-head">Nombre</span><span>Lenguaje</span><span>Última actualización</span><span>Visibilidad</span><span>Tamaño</span></div>
              {repoData.map((repo) => <button className={repoSelection.includes(repo.id) ? 'file-row selected' : 'file-row'} key={repo.id} onClick={(event) => handleRowClick(event, repo.id)} onDoubleClick={() => downloadRepo(repo)}><span className="file-name"><span className="file-icon repo-icon">{getRepoIcon(repo)}</span><span><strong>{repo.name}</strong><small>{repo.owner}</small></span></span><span className="muted-cell">{repo.language}</span><span className="muted-cell">{repo.updated}</span><span className="muted-cell visibility-cell">{repo.visibility}</span><span className="muted-cell">{formatBytes(repo.size)}</span></button>)}
              {!repoData.length && <div className="empty-list-hint"><GitBranch size={18} /> {githubLoading ? 'Cargando repositorios de GitHub…' : 'Pulsa “Proyectos de GitHub” para cargar tus repositorios reales'}</div>}
            </div> : <div className={viewMode === 'grid' ? 'file-list grid-view' : 'file-list'}>
              {viewMode === 'list' && <div className="list-head"><span className="name-head">Nombre</span><span>Tipo</span><span>Fecha de modificación</span><span>Tamaño</span><span>Descripción</span></div>}
              {visibleItems.map((item) => <button className={`${selection.includes(item.id) ? 'file-row selected' : 'file-row'} ${currentFolderId === 'computer' && item.type === 'Unidad' ? 'drive-card' : ''}`} key={item.id} onClick={(event) => handleRowClick(event, item.id)} onDoubleClick={() => openSelected(item)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); openSelected(item) } }} onContextMenu={(event) => handleContextMenu(event, item.id)}>
                <span className="file-name"><span className="file-icon">{getIcon(item)}</span><span><strong>{item.name}</strong>{viewMode === 'grid' && <small>{item.type}</small>}</span></span>
                {viewMode === 'list' && <><span className="muted-cell">{item.type}</span><span className="muted-cell">{item.modified || (item.type === 'Unidad' ? 'Disponible' : '—')}</span><span className="muted-cell">{item.kind === 'folder' ? (item.type === 'Unidad' ? formatBytes(item.size) : '—') : formatBytes(item.size)}</span><span className="description-cell">{item.type === 'Unidad' && item.free !== undefined ? `${formatBytes(item.size - item.free)} usados de ${formatBytes(item.size)}` : item.description}</span></>}
                {currentFolderId === 'computer' && item.type === 'Unidad' && item.free !== undefined && <span className="drive-usage"><span style={{ width: `${Math.max(2, Math.min(100, ((item.size - item.free) / Math.max(1, item.size)) * 100))}%` }} /></span>}
              </button>)}
              {!visibleItems.length && <div className="empty-list-hint"><Search size={18} /> No se encontraron elementos en esta ubicación</div>}
              {visibleItems.length > 0 && <div className="list-footer"><span>{visibleItems.length} elementos</span><span>{clipboard ? `${clipboard.mode === 'copy' ? 'Copiado' : 'Cortado'}: ${clipboard.ids.length}` : 'Listo'}</span></div>}
            </div>}

            <div className="bottom-status"><div><span className="status-dot" /> {nativeMode ? 'Conectado al sistema de archivos de Windows' : 'Modo Preview'}</div><div>{nativeMode ? 'Acceso nativo' : 'Datos de demostración'} <ShieldCheck size={13} /></div></div>
          </section>

          <aside className="details-panel">
            <div className="details-heading"><span>Detalles</span><button><MoreHorizontal size={17} /></button></div>
            {section === 'github' && selectedRepoData ? <div className="details-body">
              <div className="details-hero repo-hero"><div className="big-file-icon"><GitBranch size={33} /></div><h2>{selectedRepoData.name}</h2><p className="path-line">github.com/{selectedRepoData.owner}/{selectedRepoData.name}</p></div>
              <div className="detail-divider" /><div className="detail-lines"><div><span>Propietario</span><strong>{selectedRepoData.owner}</strong></div><div><span>Lenguaje</span><strong>{selectedRepoData.language}</strong></div><div><span>Rama</span><strong>{selectedRepoData.branch}</strong></div><div><span>Visibilidad</span><strong>{selectedRepoData.visibility}</strong></div><div><span>Actualizado</span><strong>{selectedRepoData.updated}</strong></div><div><span>Tamaño</span><strong>{formatBytes(selectedRepoData.size)}</strong></div></div>
              <div className="detail-section"><label>Etiquetas</label><div className="tag-list">{selectedRepoData.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></div><div className="detail-section"><label>Descripción</label><p className="detail-description">{selectedRepoData.description}</p></div>
              <div className="detail-actions"><button className="primary-action" onClick={() => downloadRepo(selectedRepoData)}><Download size={15} />{repoDownloaded[selectedRepoData.id] ? 'Descargado' : 'Descargar proyecto'}</button><button className="secondary-action" onClick={() => notify('Se abrirá GitHub en el navegador')}><GitBranch size={15} />Abrir en GitHub</button></div>
            </div> : detailsItem ? <div className="details-body">
              <div className="details-hero"><div className="big-file-icon">{getIcon(detailsItem, 34)}</div><h2>{detailsItem.name}</h2><p className="path-line">{breadcrumb.map((crumb) => crumb.name).join(' / ')}</p></div>
              {detailsItem.kind === 'folder' && <div className="usage-ring" style={{ background: detailsItem.type === 'Unidad' && detailsItem.free !== undefined ? `conic-gradient(#55c7e8 0deg ${(detailsItem.size - detailsItem.free) / Math.max(1, detailsItem.size) * 360}deg, #26354d ${(detailsItem.size - detailsItem.free) / Math.max(1, detailsItem.size) * 360}deg 360deg)` : 'conic-gradient(#55c7e8 0deg 235deg, #26354d 235deg 360deg)' }}><div><strong>{detailsItem.type === 'Unidad' ? `${Math.round((detailsItem.size - (detailsItem.free ?? 0)) / Math.max(1, detailsItem.size) * 100)}%` : detailsItem.children?.length ?? 0}</strong><span>{detailsItem.type === 'Unidad' ? 'usado' : 'elementos'}</span></div></div>}
              <div className="detail-divider" /><div className="detail-lines"><div><span>Tipo</span><strong>{detailsItem.type}</strong></div>{detailsItem.type === 'Unidad' && <><div><span>Espacio usado</span><strong>{formatBytes(detailsItem.size - (detailsItem.free ?? 0))}</strong></div><div><span>Espacio libre</span><strong>{formatBytes(detailsItem.free ?? 0)}</strong></div><div><span>Capacidad total</span><strong>{formatBytes(detailsItem.size)}</strong></div></>}{detailsItem.type !== 'Unidad' && <><div><span>Carpetas</span><strong>{detailFolderStats?.folders ?? (detailsItem.kind === 'folder' ? '0' : '—')}</strong></div><div><span>Archivos</span><strong>{detailFolderStats?.files ?? (detailsItem.kind === 'folder' ? '0' : '—')}</strong></div><div><span>Tamaño</span><strong>{detailsItem.kind === 'folder' ? formatBytes(getFolderSize(detailsItem.id, items)) : formatBytes(detailsItem.size)}</strong></div></>}<div><span>Creado</span><strong>{detailsItem.created}</strong></div><div><span>Modificado</span><strong>{detailsItem.modified}</strong></div><div><span>Ubicación</span><strong className="truncate">Mi equipo / {breadcrumb.slice(1).map((crumb) => crumb.name).join(' / ') || detailsItem.name}</strong></div></div>
              <div className="detail-section"><label>Categorías <button className="inline-edit" onClick={editDetails} title="Editar categorías"><Plus size={13} /></button></label><div className="tag-list">{detailsItem.tags.length ? detailsItem.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>) : <span className="empty-meta">Sin categorías</span>}</div></div><div className="detail-section"><label>Descripción <button className="inline-edit" onClick={editDetails} title="Editar descripción"><Pencil size={12} /></button></label><p className="detail-description">{detailsItem.description || 'Añade una descripción local para este elemento.'}</p></div>
              <div className="detail-actions"><button className="secondary-action" onClick={editDetails}><Pencil size={15} />Editar detalles y etiquetas</button><button className="secondary-action danger-action" onClick={() => deleteSelected([detailsItem.id])}><Trash2 size={15} />Papelera</button></div>
            </div> : <div className="no-selection"><div className="no-selection-icon"><FolderOpen size={26} /></div><h3>Sin selección</h3><p>Selecciona un archivo o carpeta para ver sus detalles.</p></div>}
          </aside>
        </div>

        <footer className="app-footer"><span><Zap size={13} /> Project Files</span><span>Desarrollado por Bryan Castellano</span><span>{nativeMode ? 'v0.2.0 Windows' : 'v0.2.0 Preview'}</span></footer>
      </section>

      {contextMenu && <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
        <button onClick={() => { const item = items[contextMenu.id]; if (item) openSelected(item); setContextMenu(null) }}><FolderOpen size={15} />Abrir</button>
        <div className="context-separator" />
        <button onClick={() => { setClipboard({ ids: [contextMenu.id], mode: 'copy' }); notify('Elemento copiado'); setContextMenu(null) }}><Copy size={15} />Copiar</button>
        <button onClick={() => { setClipboard({ ids: [contextMenu.id], mode: 'move' }); notify('Elemento listo para mover'); setContextMenu(null) }}><ArrowRight size={15} />Cortar / mover</button>
        <button onClick={() => { paste(); setContextMenu(null) }}><Clipboard size={15} />Pegar</button>
        <div className="context-separator" />
        <button onClick={() => { renameSelected(contextMenu.id); setContextMenu(null) }}><Pencil size={15} />Cambiar nombre</button>
        <button onClick={() => { compressSelected([contextMenu.id]); setContextMenu(null) }}><Archive size={15} />Comprimir en ZIP…</button>
        {items[contextMenu.id]?.extension === '.zip' && <button onClick={() => { extractZip(contextMenu.id); setContextMenu(null) }}><FileArchive size={15} />Extraer aquí</button>}
        <button className="danger-menu" onClick={() => { deleteSelected([contextMenu.id]); setContextMenu(null) }}><Trash2 size={15} />Enviar a la Papelera</button>
      </div>}

      {copyDialog && <div className="copy-overlay" role="dialog" aria-modal="true" aria-label="Progreso de copia"><div className="copy-dialog"><div className={`copy-dialog-icon ${copyDialog.status}`}><Copy size={25} /></div><div className="copy-dialog-title">{copyDialog.mode === 'move' ? 'Moviendo elementos' : 'Copiando elementos'}</div><div className="copy-dialog-subtitle">{copyDialog.message}</div>{copyDialog.status === 'working' && <div className="copy-progress"><span /></div>}<div className="copy-dialog-destination"><span>Destino</span><strong>{currentFolder?.path ?? currentFolder?.name ?? 'Ubicación actual'}</strong></div><div className="copy-dialog-items">{copyDialog.names.slice(0, 4).map((name) => <span key={name}>{name}</span>)}{copyDialog.names.length > 4 && <span>+ {copyDialog.names.length - 4} más</span>}</div>{copyDialog.status === 'working' ? <button className="secondary-action copy-close" onClick={() => void cancelCopy()}>Cancelar copia</button> : <button className="primary-action copy-close" onClick={() => setCopyDialog(null)}>{copyDialog.status === 'done' ? 'Cerrar' : 'Cerrar'}</button>}</div></div>}

      {textEditor && <div className="editor-overlay" role="dialog" aria-modal="true" aria-label="Editor de texto"><div className="text-editor"><div className="editor-topbar"><div className="editor-file"><FileCode2 size={16} />{textEditor.name}{textEditor.dirty && <span>●</span>}</div><div className="editor-actions"><button onClick={() => setTextEditor(null)}>Cerrar</button><button className="editor-save" onClick={() => { if (!window.projectFilesNative) return; void window.projectFilesNative.writeText(textEditor.path, textEditor.content).then(() => { setTextEditor({ ...textEditor, dirty: false }); notify('Archivo guardado') }).catch((error) => notify(`No se pudo guardar: ${error.message}`)) }}>Guardar</button></div></div><textarea className="code-editor" spellCheck={false} value={textEditor.content} onChange={(event) => setTextEditor({ ...textEditor, content: event.target.value, dirty: true })} /><div className="editor-status"><span>Texto · UTF-8</span><span>{textEditor.content.split('\n').length} líneas</span><span>Desarrollado por Bryan Castellano</span></div></div></div>}

      {shareDialog && <div className="copy-overlay" role="dialog" aria-modal="true" aria-label="Servidor en red local"><div className="copy-dialog share-dialog"><div className="copy-dialog-icon"><Cloud size={25} /></div><div className="copy-dialog-title">Servidor en red local</div><div className="copy-dialog-subtitle">Elige cómo quieres compartir tu carpeta en la red Wi-Fi o LAN.</div>{shareInfo ? <><div className="share-online"><span className="share-status-dot" />{shareInfo.mode === 'social' ? 'Modo social activo' : 'Servicio de archivos activo'}</div><label className="media-label">Dirección para compartir<input readOnly className="media-input share-url" value={shareInfo.url} onFocus={(event) => event.currentTarget.select()} /></label><div className="share-path"><span>Carpeta compartida</span><strong>{shareInfo.root}</strong></div><div className="share-actions"><button className="secondary-action" onClick={() => navigator.clipboard?.writeText(shareInfo.url).then(() => notify('Dirección copiada'))}><Copy size={14} />Copiar dirección</button><button className="secondary-action" onClick={() => { setShareMode(shareInfo.mode); void stopShare() }}>Cambiar modo</button><button className="primary-action" onClick={() => void stopShare()}>Cerrar servidor</button></div><p className="media-note">Abre la dirección desde otro dispositivo de tu red. Si Windows muestra una alerta del Firewall, permite el acceso en redes privadas.</p></> : <><div className="share-mode-grid"><button className={shareMode === 'files' ? 'share-mode selected' : 'share-mode'} onClick={() => setShareMode('files')}><FolderOpen size={24} /><strong>Compartir archivos</strong><span>Carpetas, imágenes, vídeos y descargas.</span></button><button className={shareMode === 'social' ? 'share-mode selected social' : 'share-mode social'} onClick={() => setShareMode('social')}><Sparkles size={24} /><strong>Modo social</strong><span>Publicaciones, comentarios y reacciones gamer.</span></button></div><button className="primary-action share-start" disabled={shareBusy} onClick={() => void startShare()}>{shareBusy ? 'Levantando servidor…' : 'Elegir carpeta y levantar servidor'}</button></>}<button className="share-close" onClick={() => setShareDialog(false)}>Cerrar ventana</button></div></div>}

      {folderDialog && <div className="copy-overlay" role="dialog" aria-modal="true" aria-label="Crear carpeta"><form className="copy-dialog form-dialog" onSubmit={(event) => { event.preventDefault(); void submitCreateFolder() }}><div className="copy-dialog-icon"><FolderPlus size={25} /></div><div className="copy-dialog-title">Nueva carpeta</div><div className="copy-dialog-subtitle">Se creará dentro de la ubicación actual o de la unidad que elijas.</div><label className="media-label">Nombre de la carpeta<input autoFocus className="media-input" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Ejemplo: Mis proyectos" /></label><div className="media-actions"><button type="button" className="secondary-action" onClick={() => setFolderDialog(false)}>Cancelar</button><button type="submit" className="primary-action">Crear carpeta</button></div></form></div>}

      {detailsDraft && <div className="copy-overlay" role="dialog" aria-modal="true" aria-label="Editar detalles"><form className="copy-dialog form-dialog" onSubmit={(event) => { event.preventDefault(); saveDetails() }}><div className="copy-dialog-icon"><Pencil size={25} /></div><div className="copy-dialog-title">Editar detalles</div><div className="copy-dialog-subtitle">La descripción y las categorías se guardan localmente para este elemento.</div><label className="media-label">Descripción<textarea autoFocus className="media-input media-textarea" value={detailsDraft.description} onChange={(event) => setDetailsDraft({ ...detailsDraft, description: event.target.value })} placeholder="Escribe una descripción…" /></label><label className="media-label">Categorías <span className="field-hint">separadas por coma</span><input className="media-input" value={detailsDraft.tags} onChange={(event) => setDetailsDraft({ ...detailsDraft, tags: event.target.value })} placeholder="Trabajo, Importante, Proyecto" /></label><div className="media-actions"><button type="button" className="secondary-action" onClick={() => setDetailsDraft(null)}>Cancelar</button><button type="submit" className="primary-action">Guardar cambios</button></div></form></div>}

      {githubDialog && <div className="copy-overlay" role="dialog" aria-modal="true" aria-label="Conectar GitHub"><form className="copy-dialog form-dialog" onSubmit={(event) => { event.preventDefault(); void loadGithub() }}><div className="copy-dialog-icon"><GitBranch size={25} /></div><div className="copy-dialog-title">Conectar cuenta de GitHub</div><div className="copy-dialog-subtitle">Carga tus repositorios públicos o usa un token personal para acceder a los privados. El token no se guarda.</div><label className="media-label">Usuario de GitHub<input autoFocus className="media-input" value={githubUser} onChange={(event) => setGithubUser(event.target.value)} placeholder="tu-usuario" /></label><label className="media-label">Token personal <span className="field-hint">opcional para repositorios privados</span><input type="password" className="media-input" value={githubToken} onChange={(event) => setGithubToken(event.target.value)} placeholder="ghp_…" /></label><div className="github-help">Crea un token en GitHub → Settings → Developer settings → Personal access tokens. Para repositorios privados usa permiso de lectura de contenido.</div><div className="media-actions"><button type="button" className="secondary-action" onClick={() => setGithubDialog(false)}>Cancelar</button><button type="submit" className="primary-action" disabled={githubLoading}>{githubLoading ? 'Conectando…' : 'Conectar y cargar repositorios'}</button></div></form></div>}

      {youtubePanel && <div className="copy-overlay" role="dialog" aria-modal="true" aria-label="Descargador de YouTube"><div className="copy-dialog media-dialog"><div className="copy-dialog-icon"><Download size={25} /></div><div className="copy-dialog-title">Descargador multimedia</div><div className="copy-dialog-subtitle">Descarga únicamente vídeos o audios que tengas autorización para guardar.</div><label className="media-label">URL de YouTube<input className="media-input" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></label><div className="media-options"><label className="media-label">Tipo<select className="media-input" value={youtubeMode} onChange={(event) => setYoutubeMode(event.target.value as 'video' | 'audio')}><option value="video">Vídeo</option><option value="audio">Solo audio</option></select></label><label className="media-label">Calidad<select className="media-input" value={youtubeQuality} onChange={(event) => setYoutubeQuality(event.target.value)} disabled={youtubeMode === 'audio'}><option value="best">Mejor disponible</option><option value="2160">2160p</option><option value="1440">1440p</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></select></label></div><div className="media-actions"><button className="secondary-action" onClick={() => setYoutubePanel(false)}>Cancelar</button><button className="primary-action" onClick={downloadYoutube} disabled={youtubeBusy}>{youtubeBusy ? 'Descargando…' : 'Elegir carpeta y descargar'}</button></div><p className="media-note">Requiere <strong>yt-dlp</strong> instalado y disponible en PATH de Windows.</p></div></div>}

      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </main>
  )
}

export default App

createRoot(document.getElementById('root')!).render(<App />)

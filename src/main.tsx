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

function formatBytes(bytes: number) {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function getIcon(item: FileItem, size = 19) {
  if (item.kind === 'folder') return <Folder size={size} fill="#f1b83c" color="#f7c95e" strokeWidth={1.7} />
  if (item.extension === '.xlsx') return <FileSpreadsheet size={size} color="#48bd91" />
  if (item.extension === '.png' || item.extension === '.jpg') return <FileImage size={size} color="#b77cff" />
  if (item.extension === '.zip' || item.extension === '.7z') return <FileArchive size={size} color="#f0b85d" />
  if (item.extension === '.ts' || item.extension === '.tsx') return <FileCode2 size={size} color="#62b9f4" />
  if (item.extension === '.docx') return <FileText size={size} color="#5e96e6" />
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
  const [selection, setSelection] = useState<string[]>(['q4'])
  const [repoSelection, setRepoSelection] = useState<string[]>([])
  const [section, setSection] = useState<Section>('files')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDescending, setSortDescending] = useState(false)
  const [query, setQuery] = useState('')
  const [clipboard, setClipboard] = useState<{ ids: string[]; mode: 'copy' | 'move' } | null>(null)
  const [toast, setToast] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [repoDownloaded, setRepoDownloaded] = useState<Record<string, string>>({})

  const currentFolder = items[currentFolderId]
  const selectedItems = selection.map((id) => items[id]).filter(Boolean)
  const selectedRepo = repoSelection.length ? repos.find((repo) => repo.id === repoSelection[0]) : undefined

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

  const goToFolder = (id: string, fromHistory = false) => {
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
    const name = window.prompt('Nombre de la nueva carpeta', 'Nueva carpeta')?.trim()
    if (!name) return
    const id = `folder-${Date.now()}`
    setItems((previous) => ({ ...previous, [id]: { id, name, kind: 'folder', type: 'Carpeta', size: 0, modified: 'Ahora', created: 'Ahora', description: 'Carpeta creada desde Project Files.', tags: [], parentId: currentFolderId, children: [] }, [currentFolderId]: { ...previous[currentFolderId], children: [...(previous[currentFolderId].children ?? []), id] } }))
    notify(`Carpeta “${name}” creada`)
  }

  const renameSelected = (id = selection[0]) => {
    const item = items[id]
    if (!item) return
    const name = window.prompt('Nuevo nombre', item.name)?.trim()
    if (!name || name === item.name) return
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
    setItems((previous) => ({ ...previous, [folderId]: { id: folderId, name: folderName, kind: 'folder', type: 'Carpeta', size: 0, modified: 'Ahora', created: 'Ahora', description: `Contenido extraído de ${archive.name}.`, tags: ['Extraído'], parentId: currentFolderId, children: [] }, [currentFolderId]: { ...previous[currentFolderId], children: [...(previous[currentFolderId].children ?? []), folderId] } }))
    notify(`Contenido de “${archive.name}” extraído aquí`)
  }

  const editDescription = () => {
    if (!detailsItem) return
    const description = window.prompt('Descripción local', detailsItem.description)
    if (description === null) return
    setItems((previous) => ({ ...previous, [detailsItem.id]: { ...previous[detailsItem.id], description } }))
    notify('Descripción guardada localmente')
  }

  const openSelected = (item: FileItem) => {
    if (item.kind === 'folder') goToFolder(item.id)
    else notify(`Abriendo “${item.name}” con el programa predeterminado`)
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

  const downloadRepo = (repo: Repo) => {
    setRepoDownloaded((previous) => ({ ...previous, [repo.id]: `C:\\Users\\Usuario\\Projects\\${repo.name}` }))
    notify(`Descarga de “${repo.name}” completada en Proyectos`)
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
          <div className="window-controls" aria-label="Controles de ventana"><span>—</span><span>□</span><span className="close">×</span></div>
        </header>

        <div className="toolbar">
          <div className="toolbar-actions">
            <button className="toolbar-button" onClick={createFolder}><FolderPlus size={17} />Nueva carpeta</button>
            <button className="toolbar-button" onClick={() => notify('Importador listo: el adaptador nativo conectará archivos reales')}><Upload size={17} />Importar archivos</button>
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
              <button className={section === 'files' && currentFolderId === 'root' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('files'); goToFolder('root') }}><Home size={16} />Inicio</button>
              <button className={section === 'files' && currentFolderId === 'q4' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('files'); goToFolder('q4') }}><FolderOpen size={16} />Project Archives</button>
              <button className="nav-item" onClick={() => { setSection('files'); goToFolder('root'); setQuery('Documentos') }}><FileText size={16} />Documentos</button>
              <button className="nav-item" onClick={() => { setSection('files'); goToFolder('root'); setQuery('') }}><HardDrive size={16} />Este equipo</button>
              <button className={section === 'github' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('github'); setRepoSelection(['repo1']); setSelection([]) }}><GitBranch size={16} />Proyectos de GitHub</button>
              <button className="nav-item" onClick={() => notify('Las etiquetas locales se mostrarán aquí')}><Tag size={16} />Etiquetas</button>
              <button className="nav-item" onClick={() => document.querySelector<HTMLInputElement>('.search-wrap input')?.focus()}><Search size={16} />Buscar</button>
            </nav>
            <div className="sidebar-divider" />
            <div className="sidebar-heading recent-heading">Carpetas recientes <MoreHorizontal size={15} /></div>
            <div className="recent-list">
              {['Q4 Marketing Plan', 'Client Presentations', 'Design Assets'].map((label) => <button key={label} className="recent-item" onClick={() => notify(`Ruta reciente: ${label}`)}><Folder size={15} fill="#eab64a" color="#f4c45d" />{label}</button>)}
            </div>
            <div className="sidebar-spacer" />
            <div className="storage-card"><div className="storage-title"><Cloud size={15} /> Almacenamiento local</div><div className="storage-bar"><span /></div><div className="storage-meta"><span>68.4 GB usados</span><span>256 GB</span></div></div>
          </aside>

          <section className="content-panel">
            <div className="content-header">
              <div className="breadcrumbs">
                {section === 'github' ? <><GitBranch size={15} /><span>Proyectos de GitHub</span></> : breadcrumb.map((crumb, index) => <span className="crumb-group" key={crumb.id}><button className={index === breadcrumb.length - 1 ? 'crumb current' : 'crumb'} onClick={() => goToFolder(crumb.id)}>{index === 0 ? <Home size={14} /> : null}{crumb.name}</button>{index < breadcrumb.length - 1 && <ChevronRight size={14} className="crumb-chevron" />}</span>)}
              </div>
              <div className="content-actions">
                {section === 'files' && <><button className="round-action" title="Pegar" onClick={paste}><Clipboard size={15} /></button><button className="round-action" title="Subir un nivel" onClick={() => currentFolder?.parentId && goToFolder(currentFolder.parentId)}><ArrowUp size={15} /></button></>}
                <button className="round-action" title="Actualizar" onClick={() => notify('Carpeta actualizada')}><RefreshCw size={15} /></button>
              </div>
            </div>
            <div className="content-title-row"><div><h1>{section === 'github' ? 'Mis repositorios' : currentFolder.name}</h1><p>{section === 'github' ? 'Descarga copias locales de tus proyectos' : query ? `${visibleItems.length} resultado(s) para “${query}”` : `${visibleItems.length} elementos`}</p></div><div className="sort-select"><span>Ordenar por</span><button onClick={() => setSortKey(sortKey === 'name' ? 'modified' : sortKey === 'modified' ? 'size' : 'name')}>{sortKey === 'name' ? 'Nombre' : sortKey === 'modified' ? 'Fecha' : 'Tamaño'} <ChevronDown size={13} /></button></div></div>

            {section === 'github' ? <div className="file-list github-list">
              <div className="list-head"><span className="name-head">Nombre</span><span>Lenguaje</span><span>Última actualización</span><span>Visibilidad</span><span>Tamaño</span></div>
              {repos.map((repo) => <button className={repoSelection.includes(repo.id) ? 'file-row selected' : 'file-row'} key={repo.id} onClick={(event) => handleRowClick(event, repo.id)} onDoubleClick={() => downloadRepo(repo)}><span className="file-name"><span className="file-icon repo-icon">{getRepoIcon(repo)}</span><span><strong>{repo.name}</strong><small>{repo.owner}</small></span></span><span className="muted-cell">{repo.language}</span><span className="muted-cell">{repo.updated}</span><span className="muted-cell visibility-cell">{repo.visibility}</span><span className="muted-cell">{formatBytes(repo.size)}</span></button>)}
              <div className="empty-list-hint"><GitBranch size={18} /> Doble clic para descargar una copia local del repositorio</div>
            </div> : <div className={viewMode === 'grid' ? 'file-list grid-view' : 'file-list'}>
              {viewMode === 'list' && <div className="list-head"><span className="name-head">Nombre</span><span>Tipo</span><span>Fecha de modificación</span><span>Tamaño</span><span>Descripción</span></div>}
              {visibleItems.map((item) => <button className={selection.includes(item.id) ? 'file-row selected' : 'file-row'} key={item.id} onClick={(event) => handleRowClick(event, item.id)} onDoubleClick={() => openSelected(item)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); openSelected(item) } }} onContextMenu={(event) => handleContextMenu(event, item.id)}>
                <span className="file-name"><span className="file-icon">{getIcon(item)}</span><span><strong>{item.name}</strong>{viewMode === 'grid' && <small>{item.type}</small>}</span></span>
                {viewMode === 'list' && <><span className="muted-cell">{item.type}</span><span className="muted-cell">{item.modified}</span><span className="muted-cell">{item.kind === 'folder' ? '—' : formatBytes(item.size)}</span><span className="description-cell">{item.description}</span></>}
              </button>)}
              {!visibleItems.length && <div className="empty-list-hint"><Search size={18} /> No se encontraron elementos en esta ubicación</div>}
              {visibleItems.length > 0 && <div className="list-footer"><span>{visibleItems.length} elementos</span><span>{clipboard ? `${clipboard.mode === 'copy' ? 'Copiado' : 'Cortado'}: ${clipboard.ids.length}` : 'Listo'}</span></div>}
            </div>}

            <div className="bottom-status"><div><span className="status-dot" /> Conectado a almacenamiento local</div><div>Vista protegida <ShieldCheck size={13} /></div></div>
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
              {detailsItem.kind === 'folder' && <div className="usage-ring" style={{ background: `conic-gradient(#55c7e8 0deg 235deg, #26354d 235deg 360deg)` }}><div><strong>{detailsItem.children?.length ?? 0}</strong><span>elementos</span></div></div>}
              <div className="detail-divider" /><div className="detail-lines"><div><span>Tipo</span><strong>{detailsItem.type}</strong></div><div><span>Elementos</span><strong>{detailsItem.kind === 'folder' ? detailsItem.children?.length ?? 0 : '—'}</strong></div><div><span>Tamaño</span><strong>{detailsItem.kind === 'folder' ? formatBytes(getFolderSize(detailsItem.id, items)) : formatBytes(detailsItem.size)}</strong></div><div><span>Creado</span><strong>{detailsItem.created}</strong></div><div><span>Modificado</span><strong>{detailsItem.modified}</strong></div><div><span>Ubicación</span><strong className="truncate">Mi equipo / {breadcrumb.slice(1).map((crumb) => crumb.name).join(' / ') || detailsItem.name}</strong></div></div>
              <div className="detail-section"><label>Etiquetas <button className="inline-edit"><Plus size={13} /></button></label><div className="tag-list">{detailsItem.tags.length ? detailsItem.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>) : <span className="empty-meta">Sin etiquetas</span>}</div></div><div className="detail-section"><label>Descripción <button className="inline-edit" onClick={editDescription}><Pencil size={12} /></button></label><p className="detail-description">{detailsItem.description || 'Añade una descripción local para este elemento.'}</p></div>
              <div className="detail-actions"><button className="secondary-action" onClick={() => editDescription()}><Pencil size={15} />Editar detalles</button><button className="secondary-action danger-action" onClick={() => deleteSelected([detailsItem.id])}><Trash2 size={15} />Papelera</button></div>
            </div> : <div className="no-selection"><div className="no-selection-icon"><FolderOpen size={26} /></div><h3>Sin selección</h3><p>Selecciona un archivo o carpeta para ver sus detalles.</p></div>}
          </aside>
        </div>

        <footer className="app-footer"><span><Zap size={13} /> Project Files</span><span>Administrador local de archivos</span><span>v0.1 Preview</span></footer>
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

      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </main>
  )
}

export default App

createRoot(document.getElementById('root')!).render(<App />)

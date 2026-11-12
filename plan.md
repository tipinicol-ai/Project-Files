# Project Files — Plan de implementación

## Alcance
Project Files será una interfaz de administración de archivos inspirada fielmente en la referencia entregada: ventana oscura azul marino, barra superior compacta, navegación izquierda, tabla central y panel derecho de detalles. La primera entrega funcional se ejecuta en Preview como prototipo interactivo con un sistema de archivos de demostración en memoria. La arquitectura deja aislada la futura integración nativa para Windows (filesystem real, Papelera, ZIP/RAR y GitHub OAuth) sin presentar datos simulados como si fueran archivos reales del equipo.

## Enfoque técnico
- React + TypeScript + Vite para una UI rápida y mantenible.
- Estado local en memoria para demostrar navegación, selección, detalles, copiar, mover, renombrar, borrar, ZIP y extracción.
- Adaptador `FileSystemAdapter` futuro para conectar APIs nativas de Windows/Tauri/Electron sin reescribir la UI.
- Persistencia local de descripciones y etiquetas mediante `localStorage` en la capa de interfaz.
- Navegación por árbol de carpetas con historial Atrás/Adelante y migas de pan.
- GitHub se presenta como un módulo visual preparado para conectar OAuth/API oficial; no se guardan tokens ni se realizan peticiones remotas en esta primera entrega.

## Diseño
### Movimiento
Desktop utility de Windows 11 con lenguaje Fluent oscuro, ajustado al layout exacto de la captura de referencia.

### Principios
1. Densidad informativa alta, pero con filas legibles y controles compactos.
2. Jerarquía espacial en tres zonas: navegación, contenido y detalles.
3. Cian como color de acción y selección sobre una base azul carbón.
4. Interacciones directas: doble clic abre, clic selecciona, clic derecho ofrece acciones.

### Filosofía de color
El azul marino profundo reduce fatiga visual y hace que la selección cian sea inequívoca. Los grises azulados separan superficies sin líneas agresivas; el cian se reserva para acciones, rutas y foco.

### Layout
Shell de ventana casi a pantalla completa, con header superior fijo; sidebar de 220px; área central flexible; details panel de 235px. La tabla mantiene columnas alineadas y overflow controlado.

### Motivos distintivos
- Icono de marca formado por tres carpetas apiladas y una línea de proyecto.
- Selección con resplandor cian muy sutil y borde interno.
- Gráfico circular de uso en el panel de detalles.

### Interacción y animación
Hover rápido de 120ms, selección con transición de 160ms, paneles sin animaciones llamativas. Doble clic navega o abre. Las confirmaciones destructivas se mantienen nativas y claras.

### Tipografía
Inter/Segoe UI como familia principal, 13px para el contenido, 12px para metadatos y 15–16px para nombres y títulos. Peso 600 solo en encabezados y acciones.

### Voz y marca
Project Files es claro, silencioso y orientado a proyectos. Mensajes: “Selecciona un elemento para ver sus detalles” y “Copia lista para pegar en otra carpeta”.

## Estructura
- `src/main.tsx`: composición de la aplicación y estado interactivo.
- `src/styles.css`: sistema visual completo, responsive y componentes.
- `public/manus-routes.json`: manifiesto de rutas requerido por Preview.
- `public/project-files.svg`: icono de marca.
- `README.md`: instrucciones y límites de la entrega.
- `TODO.md`: resultados y criterios pendientes.

# Project Files

Project Files es un administrador de archivos con una interfaz inspirada en la referencia visual entregada: ventana azul marino, barra superior, navegación lateral, tabla de archivos y panel de detalles. Esta entrega incluye una Preview web interactiva para revisar el diseño y los flujos principales.

## Incluido en la Preview

La vista funciona sin datos externos y permite navegar entre carpetas con doble clic y migas de pan, volver con Atrás/Backspace, buscar, ordenar, alternar lista/cuadrícula, seleccionar uno o varios elementos, ver detalles, crear carpetas, copiar, cortar/mover, pegar, renombrar, enviar a la Papelera de demostración, crear ZIP, extraer ZIP, editar descripciones locales y explorar la vista preparada de repositorios de GitHub. También incluye menú contextual y atajos de teclado principales.

## Desarrollo

```bash
npm install
npm run dev
npm run build
npm test
```

La Preview usa un árbol de datos en memoria para que las interacciones puedan verificarse dentro del navegador. La interfaz no afirma que esos elementos ya sean archivos reales del disco: para eso existe el contrato `src/fileAdapter.ts`, que deberá conectarse a una aplicación nativa.

## Siguiente capa nativa de Windows

El proyecto ya incluye el envoltorio Electron, el puente `electron/preload.cjs`, el proceso nativo `electron/main.cjs`, la configuración NSIS y los scripts `scripts/build-windows.ps1`/`scripts/build-windows.cmd`. La integración GitHub debe usar OAuth o un token guardado en el Administrador de credenciales de Windows, sin exponerlo en la UI. Las funciones RAR/TAR.GZ/7Z deben usar herramientas compatibles con sus licencias.

La validación `isSafeExtractionPath` y sus pruebas bloquean rutas de extracción que intentan escapar del destino, como `..` o rutas absolutas externas. Se generó `release/Project-Files-Setup-0.1.0.exe` como instalador NSIS x64 y `release/win-unpacked/Project Files.exe` como aplicación empaquetada. La estructura PE/NSIS y hashes fueron comprobados en Linux; la ejecución interactiva final debe confirmarse en Windows real porque Wine no pudo iniciar el stub NSIS en este sandbox sin escritorio Windows.

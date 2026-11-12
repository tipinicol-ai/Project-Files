# Project Files

Project Files es un administrador de archivos para Windows con una interfaz inspirada en la referencia visual entregada: ventana azul marino, barra superior, navegación lateral, tabla de archivos y panel de detalles.

## Modo Windows real

El instalador Electron enumera las unidades reales conectadas al PC (`C:\`, `D:\`, USB y otras disponibles), entra en sus carpetas y lee sus nombres, tamaños y fechas reales. En Windows están conectados abrir con el programa predeterminado, seleccionar/importar archivos, crear carpetas, copiar, mover entre discos, pegar, renombrar, enviar a la Papelera de Windows, crear ZIP, extraer ZIP con validación de rutas, menú contextual, búsqueda, ordenamiento, lista/cuadrícula, atajos de teclado y controles de ventana. La ventana se maximiza y el área central y el panel de detalles tienen scroll independiente.

## Desarrollo

```bash
npm install
npm run dev
npm run build
npm test
```

La Preview web mantiene un árbol de demostración porque el navegador no tiene permisos para enumerar las unidades del PC. El instalador de Windows no usa ese árbol: activa el puente nativo `electron/preload.cjs` y lee el filesystem real.

## Empaquetado Windows

El proyecto incluye el envoltorio Electron, el puente nativo, el proceso de Windows, la configuración NSIS y los scripts `scripts/build-windows.ps1`/`scripts/build-windows.cmd`. La integración GitHub se mantiene separada hasta conectar OAuth o un token guardado en el Administrador de credenciales de Windows; no se muestran repositorios falsos en el modo Windows.

La validación `isSafeExtractionPath` y la validación adicional de PowerShell bloquean rutas de extracción que intentan escapar del destino, como `..` o rutas absolutas externas. La compilación final es `release/Project-Files-Setup-0.2.0.exe` como instalador NSIS x64 y `release/win-unpacked/Project Files.exe` como aplicación empaquetada. La estructura PE/NSIS, la carga del renderer y las pruebas de seguridad se comprobaron en Linux; la firma digital requiere un certificado del propietario.

## Firma digital

El proyecto incluye `scripts/build-signed-windows.ps1`. Para una firma reconocida por Windows se necesita un certificado de firma de código del propietario (`.pfx`) y su contraseña. En PowerShell se ejecuta con `CSC_LINK` y `CSC_KEY_PASSWORD`; electron-builder firma el ejecutable y el instalador sin guardar el certificado en Git. Un certificado autofirmado no elimina la advertencia de SmartScreen y no sustituye a un certificado de confianza.

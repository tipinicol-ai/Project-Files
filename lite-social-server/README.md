# Project Files Social Server Lite

Servidor social ligero de Project Files. La interfaz usa las tres referencias visuales ubicadas en `assets/`; el banner y la hoja de estilos se integran dentro del ejecutable mediante `go:embed`, por lo que no hace falta copiar recursos al instalarlo.

## Compilar y ejecutar en desarrollo

Requiere Go 1.22 o posterior.

```sh
go test ./...
go run .
```

La página local se abre en `http://127.0.0.1:8787`. Para elegir otro puerto:

```sh
PROJECT_FILES_PORT=8788 go run .
```

## Crear el instalador de Windows

Desde PowerShell, en esta carpeta, compila primero el servidor y después ejecuta NSIS:

```powershell
New-Item -ItemType Directory -Force dist | Out-Null
go build -trimpath -ldflags="-s -w" -o "dist/Project Files Social Server Lite.exe" .
makensis social-lite.nsi
```

El ejecutable incluye los banners y CSS; las cuentas, publicaciones y archivos siguen guardándose en la carpeta de configuración del usuario de Windows.

## Videos

La publicación genera un elemento HTML5 con controles y reproducción integrada. Los archivos se sirven con el tipo MIME por extensión y soporte de solicitudes HTTP `Range`, necesario para buscar dentro del video y para la reproducción en navegador. Se admiten los contenedores MP4/M4V, WebM, OGV/OGG y MOV; la compatibilidad final depende también del códec que contenga el archivo. Para mayor compatibilidad entre navegadores se recomienda MP4 con video H.264 y audio AAC, o WebM con VP8/VP9.

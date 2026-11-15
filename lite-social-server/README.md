# Project Files Social Server Lite

Servidor social local de Project Files. La interfaz, los scripts y el icono gamer se integran en el ejecutable mediante `go:embed`; no hace falta copiar esos recursos junto al programa. Las cuentas, publicaciones, fotos de perfil y archivos se conservan en la carpeta de configuración del usuario y no se incluyen en las distribuciones.

## Requisitos y ejecución

Requiere Go 1.22 o posterior.

```sh
go test ./...
go run .
```

Abre `http://127.0.0.1:8787`. Para elegir otro puerto, define `PROJECT_FILES_PORT` antes de iniciar el servidor.

## Administrador

La consola está denegada por defecto. Para designar una cuenta **ya registrada** como administradora, define `PROJECT_FILES_ADMIN_USER` con el nombre de esa cuenta antes de iniciar el servidor. Por ejemplo, en PowerShell:

```powershell
$env:PROJECT_FILES_ADMIN_USER = "tu_usuario"
& ".\Project Files Social Server Lite.exe"
```

Solo esa cuenta firmada podrá consultar la consola y realizar moderación. No hay contraseña pública ni promoción automática al registrarse. La aplicación crea una clave de sesión aleatoria en la carpeta privada de configuración; las cookies se validan mediante HMAC. Mantén esa carpeta y el acceso al equipo protegidos. Los cambios de datos existentes son compatibles; las sesiones antiguas sin firma deberán iniciar sesión otra vez.

## Distribución Windows x64

En Windows, desde esta carpeta, se puede generar el ejecutable portable, el ZIP y el instalador NSIS así:

```powershell
New-Item -ItemType Directory -Force dist | Out-Null
go build -trimpath -ldflags="-s -w" -o "dist/Project Files Social Server Lite.exe" .
Compress-Archive -Force "dist/Project Files Social Server Lite.exe", "README.md" "dist/Project-Files-Social-Server-Lite-Portable.zip"
makensis social-lite.nsi
```

El script NSIS usa `assets/icon.ico` tanto para el instalador como para los accesos directos. Los banners, CSS, scripts y favicon están embebidos en el ejecutable. `icon_windows_amd64.syso` incluye el recurso del icono dentro del ejecutable x64; se generó desde `assets/icon.ico` con `rsrc -ico assets/icon.ico -o icon_windows_amd64.syso`.

El servidor escucha en el puerto 8787 por defecto. Inicia el ejecutable, revisa la dirección local que imprime en consola y abre `http://127.0.0.1:8787` en el navegador. Cierra la consola con Ctrl+C para detenerlo. Para habilitar la consola, inicia el servidor después de configurar `PROJECT_FILES_ADMIN_USER` como se explicó arriba.

## Publicaciones y medios

Los comentarios se envían sin recargar la página, por lo que el video conserva su reproducción; los formularios tradicionales siguen disponibles si JavaScript está desactivado. Se puede buscar y filtrar el feed, editar el texto o reemplazar medios, y cambiar la imagen de perfil. La consola muestra publicaciones recientes, permite buscar y moderar y refresca la actividad periódicamente.

El servidor acepta imágenes y los contenedores de video MP4/M4V, WebM, OGV/OGG y MOV, entre otros adjuntos permitidos por extensión. El tamaño máximo de medios es 500 MiB; el de fotos de perfil, 5 MiB. La compatibilidad de reproducción depende del códec; se recomienda MP4 H.264/AAC o WebM VP8/VP9.

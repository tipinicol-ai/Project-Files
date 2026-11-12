$ErrorActionPreference = 'Stop'

if (-not $env:CSC_LINK) {
  throw 'Falta CSC_LINK. Proporciona la ruta o URL de tu certificado .pfx antes de firmar.'
}
if (-not $env:CSC_KEY_PASSWORD) {
  throw 'Falta CSC_KEY_PASSWORD. La contraseña del certificado no se guarda en el proyecto.'
}

npm run dist:win
Write-Host 'Instalador firmado generado en release/.'

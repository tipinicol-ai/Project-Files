$ErrorActionPreference = 'Stop'
Write-Host 'Building Project Files web assets...'
npm ci
npm run build
Write-Host 'Building Project Files Windows x64 NSIS installer...'
npx electron-builder --win nsis --x64 --config electron-builder.yml
Write-Host 'Installer output:'
Get-ChildItem -Path release -Filter '*.exe' | Select-Object Name, Length, FullName

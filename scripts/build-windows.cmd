@echo off
setlocal
call npm ci
if errorlevel 1 exit /b %errorlevel%
call npm run build
if errorlevel 1 exit /b %errorlevel%
call npx electron-builder --win nsis --x64 --config electron-builder.yml
if errorlevel 1 exit /b %errorlevel%
dir release\*.exe

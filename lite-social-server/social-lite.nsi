Unicode True
Name "Project Files Social Server Lite"
OutFile "dist\Project-Files-Social-Server-Lite-Setup-0.2.0.exe"
InstallDir "$PROGRAMFILES64\Project Files Social Server Lite"
RequestExecutionLevel admin
Icon "..\build\icon.ico"

Page directory
Page instfiles

Section "Servidor social"
  SetOutPath "$INSTDIR"
  File "dist\Project Files Social Server Lite.exe"
  CreateDirectory "$SMPROGRAMS\Project Files Social Server Lite"
  CreateShortCut "$DESKTOP\Project Files Social Server Lite.lnk" "$INSTDIR\Project Files Social Server Lite.exe"
  CreateShortCut "$SMPROGRAMS\Project Files Social Server Lite\Project Files Social Server Lite.lnk" "$INSTDIR\Project Files Social Server Lite.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Project Files Social Server Lite.lnk"
  Delete "$SMPROGRAMS\Project Files Social Server Lite\Project Files Social Server Lite.lnk"
  RMDir "$SMPROGRAMS\Project Files Social Server Lite"
  Delete "$INSTDIR\Project Files Social Server Lite.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd

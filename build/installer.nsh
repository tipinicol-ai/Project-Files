!macro customHeader
  BrandingText "Desarrollado por Bryan Castellano"
!macroend

!macro customInstall
  DetailPrint "Project Files fue desarrollado por Bryan Castellano"
  CreateShortCut "$DESKTOP\Project Files Web Server.lnk" "$INSTDIR\Project Files Web Server.exe"
  CreateShortCut "$SMPROGRAMS\Project Files Web Server.lnk" "$INSTDIR\Project Files Web Server.exe"
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Project Files Web Server.lnk"
  Delete "$SMPROGRAMS\Project Files Web Server.lnk"
!macroend

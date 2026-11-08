@echo off
REM Kiosque BD - double-cliquez sur ce fichier pour lancer le kiosque.
REM Tout le travail est fait par lib\kiosque-windows.ps1 (rien a installer).
chcp 65001 >nul
if not exist "%~dp0lib\kiosque-windows.ps1" (
  echo.
  echo   Le kiosque ne trouve pas ses fichiers.
  echo.
  echo   Si vous avez ouvert le fichier ZIP, il faut d'abord l'extraire :
  echo   clic droit sur le fichier ZIP, puis "Extraire tout...".
  echo.
  pause
  exit /b 1
)
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0lib\kiosque-windows.ps1"

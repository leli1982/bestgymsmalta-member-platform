@echo off
setlocal
title BestGymsMalta - HU20 FICTIONAL TEST terminal
echo.
echo BestGymsMalta HU20 - TEST ONLY (not Production)
echo.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Hu20-StartTestTerminal.ps1"
if errorlevel 1 (
  echo.
  echo TEST terminal stopped. Review the error above. No automatic retry.
)
echo.
pause
endlocal

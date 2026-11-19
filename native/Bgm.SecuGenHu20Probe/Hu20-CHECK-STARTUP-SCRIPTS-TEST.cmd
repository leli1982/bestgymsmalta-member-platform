@echo off
setlocal
title BGM HU20 - Read-Only Startup Script Check
echo This checks PowerShell syntax only. It does NOT install, reset, scan or record attendance.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Hu20-WindowsStartupParseCheck.ps1"
if errorlevel 1 (
  echo.
  echo FAILED - DO NOT ENABLE THE NEW KIOSK STARTUP.
) else (
  echo.
  echo PASS - THE WINDOWS STARTUP SCRIPTS PARSE CORRECTLY.
)
pause
endlocal

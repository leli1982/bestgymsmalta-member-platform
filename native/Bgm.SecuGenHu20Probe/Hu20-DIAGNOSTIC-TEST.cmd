@echo off
setlocal
title BGM HU20 - RECOGNITION DIAGNOSTIC - TEST ONLY
echo BGM HU20 RECOGNITION-ONLY TEST - NO CLOCK IN OR CLOCK OUT.
echo Arm a fresh 10-minute TEST kiosk in Super Admin for the same terminal.
echo This checks five scans using existing SecuGen SDK and DPAPI credentials.
echo It displays only quality and recognition outcomes; no images or templates saved.
echo Press Ctrl+C to stop. Close normal kiosk before launching this diagnostic.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Hu20-StartTestTerminal.ps1" -AutoKioskTest -RecognitionDiagnostic
if errorlevel 1 echo DIAGNOSTIC STOPPED. Do not retry without reviewing the error.
pause
endlocal

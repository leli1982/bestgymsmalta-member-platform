@echo off
setlocal
title BestGymsMalta - HU20 AUTOMATIC FICTIONAL TEST KIOSK
echo HU20 AUTOMATIC TEST KIOSK ONLY - NOT FOR LIVE STAFF
echo First arm a 10-minute TEST kiosk from Staff Super Admin.
echo Ctrl+C or STOP in Super Admin ends the window.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Hu20-StartTestTerminal.ps1" -AutoKioskTest
if errorlevel 1 echo TEST kiosk stopped after an error. Do not automatically restart.
pause
endlocal

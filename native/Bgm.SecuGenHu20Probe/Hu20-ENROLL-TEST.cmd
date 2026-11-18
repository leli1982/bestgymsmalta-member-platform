@echo off
setlocal
title BestGymsMalta - Local HU20 Super Admin Enrollment (TEST ONLY)
echo.
echo BGM HU20 - LOCAL ENROLLMENT (FICTIONAL TEST ONLY)
echo Checks the HU20 physically connected to THIS PC.
echo Uses the terminal configuration already installed on this PC.
echo Does NOT scan fingerprints, contact the server or record attendance.
echo.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Hu20-OpenLocalEnrollment.ps1"
if errorlevel 1 (
  echo.
  echo The local reader check failed. No enrolment page was opened.
  echo Close the kiosk if it has the reader open, then retry.
)
echo.
pause
endlocal

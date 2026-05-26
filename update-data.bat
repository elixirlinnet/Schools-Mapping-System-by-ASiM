@echo off
setlocal
cd /d "%~dp0"
node update-data.js
if errorlevel 1 (
  echo.
  echo Data update failed. Fix the CSV issues above, then run update-data.bat again.
  exit /b 1
)
echo.
echo Data update complete.

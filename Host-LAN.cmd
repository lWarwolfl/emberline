@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 first, then run this launcher again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    echo Dependencies could not be installed. Check your connection and try again.
    pause
    exit /b 1
  )
)
echo Keep this terminal open. Open the LAN address printed below on every device.
call npm run host
pause

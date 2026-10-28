@echo off
setlocal
set "GAME_URL=file:///%~dp0index.html"
set "GAME_URL=%GAME_URL:\=/%"
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
  start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="%GAME_URL%" --window-size=1280,960
  exit /b
)
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
  start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app="%GAME_URL%" --window-size=1280,960
  exit /b
)
start "" "%~dp0index.html"


@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Dependencies are missing. Run npm install first.
  pause
  exit /b 1
)
if not exist .env (
  echo .env is missing. Copy .env.example to .env and configure credentials first.
  pause
  exit /b 1
)
npm start
endlocal

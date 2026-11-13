@echo off
setlocal
cd /d "%~dp0"
if exist "node_modules\eecircuit-engine\package.json" (
  node scripts\patch-solver.mjs
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
powershell -NoProfile -Command "try { $page = Invoke-WebRequest 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 2; if ($page.Content -match 'workbench-entry') { Start-Process 'http://127.0.0.1:5173'; exit 0 } } catch {}; exit 1"
if not errorlevel 1 exit /b 0
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies...
  set "npm_config_cache=%~dp0.cache\npm"
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Opening WiSim at http://127.0.0.1:5173
echo Keep this window open. Press Ctrl+C to stop the preview.
node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173 --strictPort --open
pause

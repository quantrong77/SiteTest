@echo off
rem Chay Vite local; can Node.js 22.12+ (hoac 20.19+) va npm ci lan dau.
cd /d "%~dp0"
where npm >nul 2>nul || (echo Can cai Node.js 22.12 tro len hoac 20.19 tro len. & pause & exit /b 1)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
start "" "http://localhost:8000/"
call npm run dev

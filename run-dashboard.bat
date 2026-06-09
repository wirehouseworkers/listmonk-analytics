@echo off
REM ============================================================
REM  run-dashboard.bat — local dev launcher for listmonk-analytics
REM
REM  Loads DATABASE_URL (and optional vars) from .env, builds the
REM  binary, starts the server, and opens the dashboard in your
REM  browser. Place in the repo root next to go.mod and .env.
REM  Close the window or press Ctrl+C to stop the server.
REM ============================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

REM --- locate Go (not always on PATH) ---
set "GO=go"
where go >nul 2>nul || set "GO=C:\Program Files\Go\bin\go.exe"

if not exist ".env" (
  echo [ERROR] .env not found in this folder: %cd%
  pause
  exit /b 1
)

REM --- load .env. For each line: skip blanks and lines starting with #,
REM     split on the FIRST '=' only, assign key=value. ---
for /f "usebackq tokens=* delims=" %%L in (".env") do (
  set "line=%%L"
  if defined line (
    set "first=!line:~0,1!"
    if not "!first!"=="#" (
      for /f "tokens=1* delims==" %%A in ("!line!") do (
        set "%%A=%%B"
      )
    )
  )
)

if "%DATABASE_URL%"=="" (
  echo [ERROR] DATABASE_URL not found in .env.
  echo Check that .env contains a line like:
  echo   DATABASE_URL=postgresql://user:pass@host:port/db
  echo and is saved as UTF-8 ^(without BOM^).
  pause
  exit /b 1
)

set "PORT=8080"
if not "%LISTEN_ADDR%"=="" (
  for /f "tokens=2 delims=:" %%P in ("%LISTEN_ADDR%") do set "PORT=%%P"
)

echo.
echo  Building listmonk-analytics...
"%GO%" build -o listmonk-analytics.exe .
if not exist "listmonk-analytics.exe" (
  echo [ERROR] Build failed. Run  "%GO%" build .  manually to see the error.
  pause
  exit /b 1
)

echo  Starting server on http://localhost:%PORT%
echo  (Close this window or press Ctrl+C to stop.)
echo.

start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%"
listmonk-analytics.exe

endlocal

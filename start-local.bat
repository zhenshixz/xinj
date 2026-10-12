@echo off
chcp 65001 >nul
setlocal
 title Xinj Local Server
cd /d "%~dp0"
if errorlevel 1 goto path_error
if not exist "server.js" goto path_error
if not exist "package.json" goto path_error
if not exist "package-lock.json" goto path_error
if not exist "scripts\start-local.js" goto path_error
where node >nul 2>nul
if errorlevel 1 goto node_error
where npm >nul 2>nul
if errorlevel 1 goto npm_error
node -e "['http-proxy','react','react-dom','recharts','vite'].forEach(p=>require.resolve(p))" >nul 2>nul
if not errorlevel 1 goto start
 echo [INFO] Installing dependencies from package-lock.json...
call npm ci --no-audit --no-fund
if errorlevel 1 goto dependency_error
:start
 echo [INFO] Starting Xinj. Use the HTTP address printed below.
node scripts\start-local.js
if errorlevel 1 goto service_error
 echo [INFO] Server stopped.
goto done
:path_error
 echo [ERROR] Project files are missing. Keep this BAT in the repository root.
goto failed
:node_error
 echo [ERROR] Node.js is missing from PATH. Install Node.js LTS, then reopen this BAT.
goto failed
:npm_error
 echo [ERROR] npm is missing from PATH. Repair the Node.js installation.
goto failed
:dependency_error
 echo [ERROR] Dependency installation failed. Check the network and npm output above.
goto failed
:service_error
 echo [ERROR] Server failed. Check the startup output above.
goto failed
:failed
 echo.
pause
exit /b 1
:done
 echo.
pause
exit /b 0

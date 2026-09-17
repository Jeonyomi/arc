@echo off
REM ArcWatch periodic local sync (mirrors RobinSync pattern)
set "PROJECT_DIR=C:\Users\USER\AppData\Local\Temp\arc"
set "NODE_DIR=C:\Program Files\nodejs"
set "PATH=%NODE_DIR%;%PATH%"
cd /d "%PROJECT_DIR%"
if not exist "data" mkdir "data"
echo ===== %date% %time% sync started ===== >> "data\sync.log"
"%NODE_DIR%\node.exe" "node_modules\tsx\dist\cli.mjs" scripts\sync.ts >> "data\sync.log" 2>&1
echo ===== %date% %time% exit code: %errorlevel% ===== >> "data\sync.log"
exit /b 0

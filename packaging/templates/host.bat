@echo off
REM ReManga Plus native messaging host shim (Windows).
REM Chrome spawns this script with the calling extension origin as %1
REM and the parent window handle as %2. Forward both via %*.

setlocal

set "REMANGA_PARSER_BUNDLE=%~dp0parser-server.js"
set "REMANGA_NODE_BIN=%~dp0node.exe"
set "REMANGA_PARSER_CACHE_DIR=%LOCALAPPDATA%\Remanga Plus\cache"

if not exist "%REMANGA_PARSER_CACHE_DIR%" mkdir "%REMANGA_PARSER_CACHE_DIR%"

"%~dp0node.exe" "%~dp0host.js" %*

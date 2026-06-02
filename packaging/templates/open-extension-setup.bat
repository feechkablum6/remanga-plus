@echo off
REM Opens the installed extension folder and the browser extensions page.
REM Chrome still requires the user to load local unpacked extensions manually.

setlocal

set "EXTENSION_DIR=%~dp0extension"
set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME_EXE_X86=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE_EXE_64=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

start "" explorer.exe "%~dp0extension"

if exist "%CHROME_EXE%" (
  start "" "%CHROME_EXE%" "chrome://extensions"
  exit /b 0
)

if exist "%CHROME_EXE_X86%" (
  start "" "%CHROME_EXE_X86%" "chrome://extensions"
  exit /b 0
)

if exist "%EDGE_EXE%" (
  start "" "%EDGE_EXE%" "edge://extensions"
  exit /b 0
)

if exist "%EDGE_EXE_64%" (
  start "" "%EDGE_EXE_64%" "edge://extensions"
  exit /b 0
)

start "" "chrome://extensions"

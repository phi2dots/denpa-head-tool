@echo off
cd /d "%~dp0"
set "CODEX_NODE=C:\Users\game_\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%CODEX_NODE%" (
  "%CODEX_NODE%" server.js
) else (
  node server.js
)

param(
  [string]$NodePath = "C:\Users\LENOVO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe",
  [int]$Port = 4100
)

$env:PORT = [string]$Port
& $NodePath server.js

# Launches the FastAPI backend on :8000 and the Vite dev server on :5173.
# Open http://localhost:5173/ in your browser; /api/* is proxied to the backend.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Cyan
$backend = Start-Process -PassThru -NoNewWindow -FilePath "python" `
    -ArgumentList "-m", "uvicorn", "api.main:app", "--reload", "--port", "8000" `
    -WorkingDirectory $root

Start-Sleep -Seconds 2

Write-Host "Starting Vite dev server on http://localhost:5173 ..." -ForegroundColor Cyan
Push-Location (Join-Path $root "web")
try {
    npm run dev
} finally {
    Pop-Location
    if (-not $backend.HasExited) {
        Stop-Process -Id $backend.Id -Force
    }
}

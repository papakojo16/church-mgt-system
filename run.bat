@echo off
rem Starts the Mt.Olivet Methodist Church web app.
rem The backend (FastAPI) serves both the API and the built React frontend on port 8080.
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv
    .venv\Scripts\python.exe -m pip install -r requirements.txt
)

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    pushd frontend
    call npm install
    popd
)

if not exist "frontend\dist\index.html" (
    echo Building frontend...
    pushd frontend
    call npm run build
    popd
)

.venv\Scripts\python.exe -m backend.main

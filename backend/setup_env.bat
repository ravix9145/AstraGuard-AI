@echo off
REM =============================================================================
REM AstraGuard AI — Backend Environment Setup (Windows)
REM =============================================================================
REM Usage: setup_env.bat
REM =============================================================================

echo ============================================
echo      AstraGuard AI -- Backend Setup
echo ============================================
echo.

WHERE python >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: python not found. Install Python 3.11+ and add it to PATH.
    exit /b 1
)

echo Detected Python:
python --version

IF NOT EXIST ".venv\" (
    echo Creating virtual environment...
    python -m venv .venv
    echo Virtual environment created.
) ELSE (
    echo Virtual environment already exists.
)

echo Activating and installing dependencies...
call .venv\Scripts\activate.bat
python -m pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo.
echo ============================================
echo  Setup complete! Start the API server:
echo.
echo  .venv\Scripts\activate
echo  uvicorn main:app --reload --port 8000
echo ============================================

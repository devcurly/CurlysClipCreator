@echo off
title Curlys Clip Creator - Build
echo ========================================
echo   Building Curlys Clip Creator
echo ========================================
echo.

echo [1/3] Building frontend...
cd /d "%~dp0frontend"
call npm run build
if %errorlevel% neq 0 (
    echo FAILED: Frontend build error
    pause
    exit /b 1
)
echo OK

echo [2/3] Compiling app (PyInstaller)...
cd /d "%~dp0"
pip install pyinstaller -q 2>nul
"%APPDATA%\Python\Python314\Scripts\pyinstaller.exe" --onefile --noconsole --distpath dist-exe --workpath build --specpath . --name "Curlys Clip Creator" --add-data "frontend\dist;frontend\dist" --add-data "Icon.ico;." --icon Icon.ico --hidden-import uvicorn --hidden-import fastapi --hidden-import pydantic --hidden-import starlette --hidden-import websockets --hidden-import httptools --hidden-import multipart app.py >nul
if %errorlevel% neq 0 (
    echo FAILED: PyInstaller build error
    pause
    exit /b 1
)
echo OK

echo [3/3] Cleaning up build artifacts...
if exist "build" rmdir /s /q "build"
if exist "*.spec" del /q "*.spec"
echo OK

echo.
echo ========================================
echo   DONE!
echo   EXE: dist-exe\Curlys Clip Creator.exe
echo ========================================
echo.
pause

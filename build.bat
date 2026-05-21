@echo off
title Curlys Clip Creator - Build
echo ========================================
echo   Building Curlys Clip Creator
echo ========================================
echo.

echo [1/4] Building frontend...
cd /d "%~dp0frontend"
call npm run build
if %errorlevel% neq 0 (
    echo FAILED: Frontend build error
    pause
    exit /b 1
)
echo OK

echo [2/4] Packaging Electron app...
cd /d "%~dp0electron"
call npx electron-builder build --win
if %errorlevel% neq 0 (
    echo FAILED: Electron build error
    pause
    exit /b 1
)
echo OK

echo [3/4] Building installer EXE (PyInstaller)...
cd /d "%~dp0"
pip install pyinstaller -q 2>nul
"%APPDATA%\Python\Python314\Scripts\pyinstaller.exe" --onefile --noconsole --distpath dist-exe --workpath build --specpath . --add-data "Icon.ico;." --icon Icon.ico --name "Curlys Clip Creator Installer" installer.py >nul
if %errorlevel% neq 0 (
    echo FAILED: Installer build error
    pause
    exit /b 1
)
echo OK

echo [4/4] Cleaning up build artifacts...
cd /d "%~dp0"
if exist "build" rmdir /s /q "build"
if exist "*.spec" del /q "*.spec"
echo OK

echo.
echo ========================================
echo   DONE!
echo   Portable:  dist-exe\Curlys Clip Creator 1.0.0.exe
echo   Installer: dist-exe\Curlys Clip Creator Installer.exe
echo   (plus win-unpacked\ folder)
echo ========================================
echo.
pause

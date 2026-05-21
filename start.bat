@echo off
title Curlys Clip Creator
echo ========================================
echo   Curlys Clip Creator - Scene Splitter
echo ========================================
echo.
echo Choose mode:
echo   1 - Web app (opens in browser)
echo   2 - Desktop app (opens in Electron window)
echo   3 - Build standalone EXE
echo.
set /p mode="Enter 1, 2, or 3: "

if "%mode%"=="1" goto web
if "%mode%"=="2" goto desktop
if "%mode%"=="3" goto build
echo Invalid choice
pause
exit /b

:web
echo.
echo [1/2] Building frontend...
cd /d "%~dp0frontend"
call npm run build >nul 2>&1
cd /d "%~dp0"
echo [2/2] Starting backend...
start "Curlys-Backend" cmd /c "cd /d "%~dp0backend" && python main.py"
timeout /t 4 /nobreak >nul
echo.
echo ========================================
echo   App running at http://127.0.0.1:8000
echo ========================================
echo.
pause
exit /b

:desktop
echo.
echo [1/2] Building frontend...
cd /d "%~dp0frontend"
call npm run build >nul 2>&1
cd /d "%~dp0"
echo [2/2] Starting Electron app...
cd /d "%~dp0electron"
call npx electron .
pause
exit /b

:build
cd /d "%~dp0"
call build.bat
pause
exit /b

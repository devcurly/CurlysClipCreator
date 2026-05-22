@echo off
title Curlys Clip Creator
echo ========================================
echo   Curlys Clip Creator - Scene Splitter
echo ========================================
echo.
echo   1 - Run web app (opens in browser)
echo   2 - Build standalone EXE
echo.
set /p mode="Enter 1 or 2: "

if "%mode%"=="1" goto web
if "%mode%"=="2" goto build
echo Invalid choice
pause
exit /b

:web
echo.
echo [1/2] Building frontend...
cd /d "%~dp0frontend"
call npm run build >nul 2>&1
cd /d "%~dp0"
echo [2/2] Starting app...
start python app.py
timeout /t 3 /nobreak >nul
echo.
echo ========================================
echo   App running at http://127.0.0.1:8000
echo ========================================
echo.
pause
exit /b

:build
cd /d "%~dp0"
call build.bat
pause
exit /b

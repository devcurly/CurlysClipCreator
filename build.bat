@echo off
title Curlys Clip Creator - Build EXE
echo ========================================
echo   Building Curlys Clip Creator EXE
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
echo.

echo [2/3] Installing Electron dependencies...
cd /d "%~dp0electron"
call npm install
if %errorlevel% neq 0 (
    echo FAILED: npm install error
    pause
    exit /b 1
)
echo OK
echo.

echo [3/3] Packaging EXE (this may take a few minutes)...
cd /d "%~dp0electron"
call npx electron-builder build --win
if %errorlevel% neq 0 (
    echo FAILED: Build error
    pause
    exit /b 1
)

echo.
echo ========================================
echo   DONE! EXE created in:
echo   %~dp0dist-exe\Curlys Clip Creator *.exe
echo ========================================
echo.
pause

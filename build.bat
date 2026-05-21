@echo off
title Curlys Clip Creator - Build
echo ========================================
echo   Building Curlys Clip Creator
echo ========================================
echo.

echo [1/5] Building backend EXE (PyInstaller)...
cd /d "%~dp0backend"
pip install pyinstaller -q 2>nul
"C:\Users\aiden\AppData\Roaming\Python\Python314\Scripts\pyinstaller.exe" --onefile --name backend --noconsole --distpath dist --workpath build --specpath . --hidden-import=uvicorn.logging --hidden-import=uvicorn.loops --hidden-import=uvicorn.loops.auto --hidden-import=uvicorn.protocols --hidden-import=uvicorn.protocols.http --hidden-import=uvicorn.protocols.http.auto --hidden-import=uvicorn.protocols.websockets --hidden-import=uvicorn.protocols.websockets.auto --hidden-import=uvicorn.middleware --hidden-import=uvicorn.middleware.asgi2 --hidden-import=uvicorn.middleware.wsgi --hidden-import=uvicorn.middleware.proxy_headers --hidden-import=multipart --hidden-import=cv2 --add-data "detector.py;." --add-data "splitter.py;." main.py >nul
if %errorlevel% neq 0 (
    echo FAILED: Backend build error
    pause
    exit /b 1
)
echo OK

echo [2/5] Building frontend...
cd /d "%~dp0frontend"
call npm run build
if %errorlevel% neq 0 (
    echo FAILED: Frontend build error
    pause
    exit /b 1
)
echo OK

echo [3/5] Packaging Electron app...
cd /d "%~dp0electron"
call npx electron-builder build --win
if %errorlevel% neq 0 (
    echo FAILED: Electron build error
    pause
    exit /b 1
)
echo OK

echo [4/5] Building installer (Inno Setup)...
cd /d "%~dp0installer"
if not exist "C:\Users\aiden\AppData\Local\InnoSetup\ISCC.exe" (
    echo Inno Setup not found, downloading...
    powershell -Command "Invoke-WebRequest -Uri 'https://jrsoftware.org/download.php/is.exe' -OutFile '%TEMP%\innosetup.exe' -UseBasicParsing"
    start /wait "" "%TEMP%\innosetup.exe" /VERYSILENT /SUPPRESSMSGBOXES /DIR="C:\Users\aiden\AppData\Local\InnoSetup" /COMPONENTS=program,help
)
"C:\Users\aiden\AppData\Local\InnoSetup\ISCC.exe" "%~dp0installer\setup.iss"
if %errorlevel% neq 0 (
    echo FAILED: Installer build error
    pause
    exit /b 1
)
echo OK

echo [5/5] Creating portable EXE...
echo (already done in step 3)

echo.
echo ========================================
echo   DONE!
echo   Portable: dist-exe\Curlys Clip Creator 1.0.0.exe
echo   Installer: dist-exe\Curlys Clip Creator Setup.exe
echo ========================================
echo.
pause

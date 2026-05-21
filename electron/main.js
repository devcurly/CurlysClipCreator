const { app, BrowserWindow, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')
const fs = require('fs')

let mainWindow
let backendProcess

const BACKEND_PORT = 8000
const WINDOW_WIDTH = 540
const WINDOW_HEIGHT = 520

function getBackendDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend')
  }
  return path.join(__dirname, '..', 'backend')
}

function getFrontendDist() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontend', 'dist')
  }
  return path.join(__dirname, '..', 'frontend', 'dist')
}

function getBackendExe() {
  const dir = getBackendDir()
  if (app.isPackaged) {
    return path.join(dir, 'backend.exe')
  }
  // In dev: detect if compiled EXE exists, otherwise fall back to python
  const exePath = path.join(dir, 'dist', 'backend.exe')
  if (fs.existsSync(exePath)) {
    return exePath
  }
  return null
}

function startBackend() {
  const backendDir = getBackendDir()
  const staticDir = getFrontendDist()
  const backendExe = getBackendExe()

  if (backendExe) {
    backendProcess = spawn(backendExe, [], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        STATIC_DIR: staticDir,
        PORT: String(BACKEND_PORT)
      }
    })
  } else if (fs.existsSync(path.join(backendDir, 'main.py'))) {
    backendProcess = spawn('python', ['main.py'], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        STATIC_DIR: staticDir,
        PORT: String(BACKEND_PORT)
      }
    })
  } else {
    dialog.showErrorBox('Backend Not Found', `Could not find backend at:\n${backendDir}`)
    return
  }

  backendProcess.stdout.on('data', (data) => {
    console.log('[backend]', data.toString().trim())
  })

  backendProcess.stderr.on('data', (data) => {
    console.log('[backend]', data.toString().trim())
  })

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err)
    dialog.showErrorBox('Backend Error', `Failed to start the backend process.\n\n${err.message}\n\nMake sure Python is installed and in your PATH.`)
  })

  backendProcess.on('exit', (code) => {
    console.log('Backend exited with code:', code)
    if (code !== 0 && !mainWindow) {
      dialog.showErrorBox('Backend Error', `The backend process exited unexpectedly (code: ${code}).\n\nThe app will close.`)
    }
  })
}

function waitForBackend(retries = 40) {
  return new Promise((resolve, reject) => {
    function check(attempt) {
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (data.includes('ok')) {
            resolve()
          } else if (attempt < retries) {
            setTimeout(() => check(attempt + 1), 500)
          } else {
            reject(new Error('Backend not ready'))
          }
        })
      })
      req.on('error', () => {
        if (attempt < retries) {
          setTimeout(() => check(attempt + 1), 500)
        } else {
          reject(new Error('Backend not ready'))
        }
      })
      req.end()
    }
    check(0)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Curlys Clip Creator',
    icon: path.join(__dirname, '..', 'Icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  startBackend()
  try {
    await waitForBackend()
    createWindow()
  } catch (err) {
    console.error('Failed:', err.message)
    dialog.showErrorBox('Backend Not Ready', `The backend did not start in time.\n\n${err.message}\n\nMake sure:\n- Python 3.14+ is installed and in PATH\n- Required packages are installed (pip install -r requirements.txt)`)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
  app.quit()
})

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
})

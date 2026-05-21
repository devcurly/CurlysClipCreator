const { app, BrowserWindow } = require('electron')
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

function startBackend() {
  const backendDir = getBackendDir()
  const staticDir = getFrontendDist()

  if (!fs.existsSync(backendDir + '\\main.py')) {
    console.error('Backend not found at:', backendDir)
    return
  }

  backendProcess = spawn('python', ['main.py'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      STATIC_DIR: staticDir,
      PORT: String(BACKEND_PORT)
    }
  })

  backendProcess.stdout.on('data', (data) => {
    console.log('[backend]', data.toString().trim())
  })

  backendProcess.stderr.on('data', (data) => {
    console.log('[backend]', data.toString().trim())
  })

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err)
  })

  backendProcess.on('exit', (code) => {
    console.log('Backend exited with code:', code)
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

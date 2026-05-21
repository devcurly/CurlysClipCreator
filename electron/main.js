const { app, BrowserWindow, dialog } = require('electron')
const { spawn, execFile } = require('child_process')
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
  const exePath = path.join(dir, 'backend.exe')
  if (fs.existsSync(exePath)) {
    return exePath
  }
  const devExe = path.join(dir, 'dist', 'backend.exe')
  if (fs.existsSync(devExe)) {
    return devExe
  }
  return null
}

function findPython() {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', ['--version'], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    proc.stdout.on('data', (d) => { output += d })
    proc.stderr.on('data', (d) => { output += d })
    proc.on('error', () => reject(new Error('Python not found in PATH')))
    proc.on('close', (code) => {
      if (code === 0) resolve('python')
      else reject(new Error('Python check failed: ' + output.trim()))
    })
  })
}

function installDependencies() {
  return new Promise((resolve, reject) => {
    const reqFile = path.join(getBackendDir(), 'requirements.txt')
    if (!fs.existsSync(reqFile)) {
      resolve()
      return
    }

    const proc = spawn('python', ['-m', 'pip', 'install', '-r', reqFile], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let output = ''
    proc.stdout.on('data', (d) => { output += d })
    proc.stderr.on('data', (d) => { output += d })

    proc.on('error', (err) => reject(err))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error('pip install failed (exit ' + code + '): ' + output.trim()))
    })
  })
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
    dialog.showErrorBox('Backend Error', `Failed to start backend.\n\n${err.message}`)
  })

  backendProcess.on('exit', (code) => {
    console.log('Backend exited with code:', code)
    if (code !== 0 && !mainWindow) {
      dialog.showErrorBox('Backend Error', `Backend exited unexpectedly (code: ${code}).`)
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
  try {
    await findPython()
    await installDependencies()
    startBackend()
    await waitForBackend()
    createWindow()
  } catch (err) {
    console.error('Failed:', err.message)
    dialog.showErrorBox('Setup Error',
      `${err.message}\n\nMake sure Python 3.14+ is installed and in PATH.\nhttps://www.python.org/downloads/`)
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

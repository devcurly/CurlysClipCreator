# Curly's Clip Creator

A Windows desktop app for creating clips, built with Electron (frontend) and Python (backend).

> ⚠️ Still a work in progress — please report bugs to `curly_dev` on Discord.

---

## Download

Head to the [Releases](https://github.com/devcurly/CurlysClipCreator/releases) page and grab the latest version. Two options are available:

- **Installer** (`Curlys Clip Creator Installer.exe`) — recommended. Installs Python automatically, sets up shortcuts, and registers an uninstaller.
- **Portable EXE** (`Curlys Clip Creator 1.0.0.exe`) — runs without installing, but requires Python to already be on your system.

---

## Installation

1. Download the installer from [Releases](https://github.com/devcurly/CurlysClipCreator/releases).
2. Right-click the installer and choose **Run as Administrator** (required).
3. Click **Install** and wait — it will automatically download and install Python if needed, install Python dependencies, copy the app to `Program Files`, and create desktop/Start Menu shortcuts.
4. Once done, click **Launch** or use the shortcut on your desktop.

To uninstall, go to **Settings → Apps** and remove "Curlys Clip Creator" like any other program.

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (for the frontend and Electron)
- [Python 3.14+](https://www.python.org/) with pip
- [PyInstaller](https://pyinstaller.org/) (`pip install pyinstaller`)

### Steps

```bash
git clone https://github.com/devcurly/CurlysClipCreator.git
cd CurlysClipCreator
```

Then run the build script:

```bat
build.bat
```

This will:
1. Build the React frontend (`frontend/`)
2. Package the Electron app with `electron-builder`
3. Bundle the installer with PyInstaller
4. Output files to `dist-exe/`

The finished artifacts will be at:
- `dist-exe\Curlys Clip Creator 1.0.0.exe` — portable build
- `dist-exe\Curlys Clip Creator Installer.exe` — installer

---

## Project Structure

```
CurlysClipCreator/
├── backend/          # Python backend
│   └── requirements.txt
├── electron/         # Electron shell & packaging config
├── frontend/         # React UI
├── installer.py      # GUI installer (built with Tkinter + PyInstaller)
├── build.bat         # One-step build script
├── start.bat         # Dev launch helper
└── Icon.ico / Icon.png
```

---

## Tech Stack

| Layer     | Technology              |
|-----------|-------------------------|
| UI        | React + CSS             |
| Desktop   | Electron                |
| Backend   | Python                  |
| Installer | Python (Tkinter) + PyInstaller |

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

Found a bug? Report it to `curly_dev` on Discord.

---

## License

This project does not currently specify a license. All rights reserved by the author unless stated otherwise.

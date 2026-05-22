import os, sys, threading, subprocess, shutil, traceback, time
from pathlib import Path

BG      = "#0e0e0d"
TEXT    = "#e8e6df"
MUTED   = "#6b6b65"
ACCENT  = "#3b82f6"
PORT    = 8000

if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).parent

os.environ.setdefault("STATIC_DIR", str(BASE_DIR / "frontend" / "dist"))

server_started = threading.Event()

def start_server():
    try:
        from backend.main import app
        import uvicorn
        config = uvicorn.Config(app, host="127.0.0.1", port=PORT, log_config=None)
        server = uvicorn.Server(config)
        server_started.set()
        server.run()
    except Exception as e:
        err = traceback.format_exc()
        try:
            with open(os.path.join(os.environ.get("TEMP", "C:\\Temp"), "curlys_error.log"), "w") as f:
                f.write(err)
        except:
            pass

def open_app_window():
    server_started.wait()
    url = f"http://127.0.0.1:{PORT}"
    candidates = [
        shutil.which("msedge"),
        shutil.which("chrome"),
        shutil.which("google-chrome"),
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ]
    for exe in candidates:
        if exe and os.path.exists(exe):
            subprocess.Popen([exe, f"--app={url}", "--window-size=540,560"], close_fds=True)
            return
    import webbrowser
    webbrowser.open(url)

if __name__ == "__main__":
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    open_app_window()
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        os._exit(0)

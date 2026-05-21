import os, sys, re, gzip, json, subprocess, urllib.request, ssl, tempfile, shutil, ctypes, struct, winreg
from pathlib import Path
from tkinter import Tk, Frame, Label, Text, Button, ttk, messagebox
from tkinter.font import Font
from threading import Thread
from queue import Queue

BG      = "#0e0e0d"
SURFACE = "#161614"
BORDER  = "#2a2a27"
BORDER2 = "#3f3f3a"
TEXT    = "#e8e6df"
MUTED   = "#6b6b65"
ACCENT  = "#3b82f6"

ROOT = Path(sys.argv[0]).resolve().parent
APP_NAME = "Curlys Clip Creator"
APP_EXE = "Curlys Clip Creator.exe"
INSTALL_DIR = Path(os.environ.get("ProgramW6432", "C:\\Program Files")) / APP_NAME

def find_path(*parts):
    p = Path(*parts)
    for base in (ROOT, ROOT.parent):
        c = base / p
        if c.exists():
            return c
    return ROOT / p

def is_admin():
    try: return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except: return False

def run(cmd, timeout=300):
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            shell=True, creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        stdout, stderr = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout, stderr = proc.communicate()
        return proc.returncode, stdout.decode(errors='replace'), stderr.decode(errors='replace') + "\n[TIMEOUT]"
    return proc.returncode, stdout.decode(errors='replace'), stderr.decode(errors='replace')

def get_latest_python_version():
    req = urllib.request.Request("https://www.python.org/downloads/windows/",
                                 headers={"Accept-Encoding": "gzip"})
    ctx = ssl.create_default_context()
    resp = urllib.request.urlopen(req, timeout=10, context=ctx)
    data = resp.read()
    if resp.info().get("Content-Encoding") == "gzip":
        data = __import__("gzip").decompress(data)
    html = data.decode("utf-8", errors="replace")
    versions = re.findall(r"python-(\d+\.\d+\.\d+)-amd64\.exe", html)
    versions = sorted(set(versions), key=lambda v: tuple(int(x) for x in v.split(".")))
    return versions[-1] if versions else "3.14.5"

def get_python_path():
    for key in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        try:
            with winreg.OpenKey(key, r"SOFTWARE\Python\PythonCore\3.14\InstallPath") as k:
                return winreg.QueryValueEx(k, "")[0]
        except: pass
    try:
        code, out, _ = run("where python", 5)
        if code == 0: return out.strip().split("\n")[0].strip()
    except: pass
    return None

def create_shortcut(target, link_path, description=""):
    ps = (
        f'$ws = New-Object -ComObject WScript.Shell; '
        f'$sc = $ws.CreateShortcut("{link_path}"); '
        f'$sc.TargetPath = "{target}"; '
        f'$sc.WorkingDirectory = "{target.parent}"; '
        f'$sc.Description = "{description}"; '
        f'$sc.Save()'
    )
    run(f'powershell -NoProfile -Command "{ps}"', 10)

class InstallerGUI:
    def __init__(self):
        self.root = Tk()
        self.root.title(f"{APP_NAME} Installer")
        self.root.geometry("560x480")
        self.root.configure(bg=BG)
        self.root.resizable(False, False)
        try:
            ico = ROOT / "Icon.ico"
            if ico.exists(): self.root.iconbitmap(str(ico))
        except: pass
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        self.queue = Queue()
        self.running = False
        self.completed = False

        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Horizontal.TProgressbar", background=ACCENT, troughcolor=BORDER,
                        bordercolor=BORDER, lightcolor=ACCENT, darkcolor=ACCENT)

        Label(self.root, text=APP_NAME, font=Font(family="Segoe UI", size=22, weight="bold"),
              fg=TEXT, bg=BG).place(x=24, y=20)
        Label(self.root, text="Installer", font=Font(family="Segoe UI", size=12),
              fg=MUTED, bg=BG).place(x=24, y=58)

        sep = Frame(self.root, height=2, bg=BORDER)
        sep.place(x=24, y=90, width=512)

        self.status = Label(self.root, text="Ready to install", font=Font(family="Consolas", size=9),
                            fg=MUTED, bg=BG, anchor="w")
        self.status.place(x=24, y=108, width=512)

        self.log = Text(self.root, font=Font(family="Consolas", size=9),
                        bg=SURFACE, fg=TEXT, bd=0, relief="flat", state="disabled",
                        wrap="word", padx=8, pady=6)
        self.log.place(x=24, y=130, width=512, height=160)

        self.progress = ttk.Progressbar(self.root, style="Horizontal.TProgressbar", length=512, mode="determinate")
        self.progress.place(x=24, y=305, height=18)

        self.install_btn = Button(self.root, text="Install", font=Font(family="Segoe UI", size=10, weight="bold"),
                                  fg="#ffffff", bg=ACCENT, bd=0, padx=24, pady=6, cursor="hand2",
                                  activebackground="#2563eb", activeforeground="#ffffff",
                                  command=self.start_install)
        self.install_btn.place(x=24, y=345)

        self.launch_btn = Button(self.root, text="Launch", font=Font(family="Segoe UI", size=10, weight="bold"),
                                 fg="#ffffff", bg=ACCENT, bd=0, padx=24, pady=6, cursor="hand2",
                                 activebackground="#2563eb", activeforeground="#ffffff",
                                 command=self.launch_app, state="disabled")
        self.launch_btn.place(x=140, y=345)

        Button(self.root, text="Close", font=Font(family="Segoe UI", size=10),
               fg=TEXT, bg=SURFACE, bd=1, padx=24, pady=6, cursor="hand2",
               activebackground=BORDER2, activeforeground=TEXT,
               command=self.on_close).place(x=440, y=345)

        Label(self.root, text="Requires Administrator privileges",
              font=Font(family="Segoe UI", size=8), fg=BORDER2, bg=BG).place(x=24, y=395)

        self.root.after(100, self.process_queue)

    def log_msg(self, msg):
        self.queue.put(("log", msg))

    def set_status(self, msg):
        self.queue.put(("status", msg))

    def set_progress(self, val):
        self.queue.put(("progress", val))

    def done(self, success=True):
        self.queue.put(("done", success))

    def process_queue(self):
        while not self.queue.empty():
            typ, val = self.queue.get_nowait()
            if typ == "log":
                self.log.configure(state="normal")
                self.log.insert("end", val + "\n")
                self.log.see("end")
                self.log.configure(state="disabled")
            elif typ == "status":
                self.status.configure(text=val)
            elif typ == "progress":
                self.progress["value"] = val
            elif typ == "done":
                self.completed = True
                if val:
                    self.install_btn.configure(state="disabled", text="Installed")
                    self.launch_btn.configure(state="normal")
                    self.status.configure(text="Installation complete!", fg=ACCENT)
                else:
                    self.install_btn.configure(state="normal", text="Retry")
                self.running = False
        self.root.after(100, self.process_queue)

    def start_install(self):
        if self.running: return
        if not is_admin():
            messagebox.showerror("Admin Required", "Please run this installer as Administrator.")
            return
        self.running = True
        self.install_btn.configure(state="disabled", text="Installing...")
        self.launch_btn.configure(state="disabled")
        Thread(target=self.run_install, daemon=True).start()

    def run_install(self):
        try:
            self.set_status("Checking Python version...")
            self.log_msg("> Fetching latest Python version from python.org...")
            py_ver = get_latest_python_version()
            py_url = f"https://www.python.org/ftp/python/{py_ver}/python-{py_ver}-amd64.exe"
            self.log_msg(f"  Latest Python: {py_ver}")
            self.set_progress(5)

            existing = get_python_path()
            if existing:
                self.log_msg(f"  Python found at: {existing}")
                self.set_progress(15)
            else:
                self.log_msg("  Python not found. Downloading...")
                self.set_status(f"Downloading Python {py_ver}...")
                installer = Path(tempfile.gettempdir()) / f"python-{py_ver}-amd64.exe"
                ctx = ssl.create_default_context()
                with urllib.request.urlopen(py_url, timeout=120, context=ctx) as src:
                    with open(installer, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                self.log_msg(f"  Downloaded ({installer.stat().st_size // 1024 // 1024} MB)")
                self.set_progress(30)

                self.set_status(f"Installing Python {py_ver}...")
                self.log_msg("  Running Python installer (this may take a minute)...")
                code, out, err = run(f'"{installer}" /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1', 180)
                if code != 0:
                    self.log_msg(f"  Python installer exited with code {code}")
                    self.log_msg(f"  {err[:200]}")
                    raise RuntimeError(f"Python installer failed (code {code})")
                self.log_msg("  Python installed.")
                installer.unlink(missing_ok=True)
                self.set_progress(45)

                ctypes.windll.user32.SendMessageW(0xFFFF, 0x001A, 0, "Environment")

            self.set_status("Installing Python packages...")
            self.log_msg("> Installing pip dependencies...")
            req_file = find_path("backend", "requirements.txt")
            if not req_file.exists():
                req_file = find_path("win-unpacked", "resources", "backend", "requirements.txt")
            if req_file.exists():
                code, out, err = run(f'python -m pip install -r "{req_file}"', 300)
                if code != 0:
                    self.log_msg(f"  pip had issues (code {code}): {err[:200]}")
                else:
                    self.log_msg("  Packages installed.")
            else:
                self.log_msg("  No requirements.txt found (will auto-install on app launch)")
            self.set_progress(60)

            self.set_status("Installing app files...")
            self.log_msg("> Copying application files...")
            source = find_path("dist-exe", "win-unpacked")
            if not source.exists():
                self.log_msg(f"  ERROR: Source not found at {source}")
                raise RuntimeError("Run build.bat first to create the packaged app")
            run('taskkill /f /im "Curlys Clip Creator.exe" 2>nul', 5)
            if INSTALL_DIR.exists():
                shutil.rmtree(str(INSTALL_DIR), ignore_errors=True)
            shutil.copytree(str(source), str(INSTALL_DIR))
            self.log_msg(f"  Copied to {INSTALL_DIR}")
            self.set_progress(75)

            self.set_status("Creating shortcuts...")
            self.log_msg("> Creating shortcuts...")
            target = INSTALL_DIR / APP_EXE
            desktop = Path(os.environ["USERPROFILE"]) / "Desktop"
            start_menu = Path(os.environ["ProgramData"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs"

            create_shortcut(target, start_menu / f"{APP_NAME}.lnk", APP_NAME)
            create_shortcut(target, desktop / f"{APP_NAME}.lnk", APP_NAME)
            self.log_msg("  Shortcuts created.")
            self.set_progress(85)

            self.set_status("Registering uninstaller...")
            self.log_msg("> Creating uninstall entry...")
            key_path = rf"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{APP_NAME}"
            with winreg.CreateKey(winreg.HKEY_LOCAL_MACHINE, key_path) as k:
                winreg.SetValueEx(k, "DisplayName", 0, winreg.REG_SZ, APP_NAME)
                winreg.SetValueEx(k, "DisplayVersion", 0, winreg.REG_SZ, "1.0.0")
                winreg.SetValueEx(k, "Publisher", 0, winreg.REG_SZ, "Curly")
                winreg.SetValueEx(k, "InstallLocation", 0, winreg.REG_SZ, str(INSTALL_DIR))
                winreg.SetValueEx(k, "DisplayIcon", 0, winreg.REG_SZ, str(target))
                winreg.SetValueEx(k, "NoModify", 0, winreg.REG_DWORD, 1)
                winreg.SetValueEx(k, "NoRepair", 0, winreg.REG_DWORD, 1)
                uninst = f'powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item ''{INSTALL_DIR}'' -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item ''{start_menu / (APP_NAME + ".lnk")}'' -Force -ErrorAction SilentlyContinue; Remove-Item ''{desktop / (APP_NAME + ".lnk")}'' -Force -ErrorAction SilentlyContinue; Remove-Item ''HKLM:\\{key_path}'' -Recurse -Force -ErrorAction SilentlyContinue"'
                winreg.SetValueEx(k, "UninstallString", 0, winreg.REG_SZ, uninst)
            self.log_msg("  Uninstaller registered.")
            self.set_progress(95)

            self.log_msg("")
            self.log_msg("=== Installation Complete! ===")
            self.set_status("Installation complete!")
            self.set_progress(100)
            self.done(True)

        except Exception as e:
            self.log_msg(f"ERROR: {e}")
            self.set_status("Installation failed")
            self.done(False)

    def launch_app(self):
        target = INSTALL_DIR / APP_EXE
        if target.exists():
            subprocess.Popen([str(target)], shell=True)
        self.root.destroy()

    def on_close(self):
        if self.running:
            if not messagebox.askokcancel("Installing", "Installation is in progress. Cancel?"):
                return
        self.root.destroy()

    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    InstallerGUI().run()

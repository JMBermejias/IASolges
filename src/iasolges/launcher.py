"""
IASolges - Lanzador
Arranca el servidor local y abre la interfaz en una ventana de aplicacion.
"""
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser

from . import app as appmod
from . import db

BROWSERS = [
    ("google-chrome-stable", ["--app=%s", "--window-size=1440,900", "--disable-features=Translate"]),
    ("google-chrome", ["--app=%s", "--window-size=1440,900"]),
    ("chromium-browser", ["--app=%s", "--window-size=1440,900"]),
    ("chromium", ["--app=%s", "--window-size=1440,900"]),
    ("microsoft-edge-stable", ["--app=%s", "--window-size=1440,900"]),
    ("firefox", ["--new-window", "%s"]),
]


def _wait(url, timeout=25):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as r:
                if r.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            time.sleep(0.25)
    return False


def open_window(url):
    """Abre la app en una ventana sin barra de direcciones (ventana de app)."""
    if os.environ.get("IASOLGES_BROWSER"):
        return webbrowser.open(url), "env"
    for exe, args in BROWSERS:
        path = shutil.which(exe)
        if not path:
            continue
        cmd = [path] + [a.replace("%s", url) for a in args]
        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True, exe
        except (OSError, subprocess.SubprocessError):
            continue
    webbrowser.open(url)
    return False, "default"


def main(argv=None):
    argv = list(argv if argv is not None else sys.argv[1:])
    port = 8765
    no_browser = "--no-browser" in argv or os.environ.get("IASOLGES_NO_BROWSER")
    debug = "--debug" in argv or os.environ.get("IASOLGES_DEBUG")
    for a in argv:
        if a.startswith("--port="):
            try:
                port = int(a.split("=", 1)[1])
            except ValueError:
                pass

    db_path = db.DEFAULT_DB
    httpd = appmod.create_server(db_path, port)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/"
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()

    print(f"  IASolges v{appmod.VERSION}")
    print(f"  Servidor: {url}")
    print(f"  Datos:     {db_path}")
    print("  Ctrl+C para salir.\n")

    if _wait(url + "api/ping"):
        if no_browser:
            print(f"  Modo servidor. Abre {url} en tu navegador.\n")
        else:
            ok, how = open_window(url)
            print(f"  Ventana abierta con: {how}\n")
    else:
        print("  Aviso: el servidor tardo en responder. Revisa el puerto.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n  Cerrando IASolges...")
        httpd.shutdown()
    return 0


import threading  # noqa: E402  (import tardio intencional)


if __name__ == "__main__":
    sys.exit(main())
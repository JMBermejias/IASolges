"""
IASolges - Lanzador

Arranca el servidor local y abre la interfaz. Prioridad de apertura:
  1. Ventana nativa GTK + WebKit2 (aplicacion de escritorio real)
  2. Ventana sin barra de direcciones (Chrome/Chromium/Edge con --app)
  3. Navegador del sistema (xdg-open / webbrowser)

Tambien resuelve la carpeta de datos y evita arrancar dos servidores a la vez.
"""
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser

from . import app as appmod
from . import db

PREFERRED_PORT = 8765

# Ventana sin barra de direcciones: solo Chromium/Chrome/Edge lo soportan.
APPMODE_BROWSERS = [
    ("google-chrome-stable", ["--app=%s", "--window-size=1440,900"]),
    ("google-chrome", ["--app=%s", "--window-size=1440,900"]),
    ("chromium-browser", ["--app=%s", "--window-size=1440,900"]),
    ("chromium", ["--app=%s", "--window-size=1440,900"]),
    ("microsoft-edge-stable", ["--app=%s", "--window-size=1440,900"]),
    ("microsoft-edge", ["--app=%s", "--window-size=1440,900"]),
]


def log(*a):
    """Volcado inmediato: imprescindible cuando no hay terminal (menu de apps)."""
    print(*a, flush=True)


# ------------------------------------------------------------- datos
def resolver_db(app_dir):
    """
    Decide donde guardar los datos, en este orden:
      1. Variable de entorno IASOLGES_HOME
      2. <carpeta de la aplicacion>/data  (si es escribible)
      3. ~/.local/share/iasolges         (instalacion del sistema)

    Asi la carpeta de trabajo del proyecto contiene tambien los datos.
    """
    env = os.environ.get("IASOLGES_HOME")
    if env:
        return os.path.abspath(os.path.join(env, "iasolges.db"))

    if app_dir:
        cand = os.path.join(app_dir, "data")
        if os.access(app_dir, os.W_OK):
            return os.path.join(cand, "iasolges.db")

    return db.DEFAULT_DB


# ------------------------------------------------------------- instancia unica
def _vivo(url, timeout=1.2):
    try:
        with urllib.request.urlopen(url + "api/ping", timeout=timeout) as r:
            return r.status == 200
    except (urllib.error.URLError, OSError):
        return False


def puerto_libre(preferido=PREFERRED_PORT, intentos=40):
    for p in [preferido] + list(range(preferido + 1, preferido + intentos)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ------------------------------------------------------------- apertura
def abrir_nativo(url, al_cerrar=None):
    """Ventana GTK + WebKit2. Devuelve (ok, mensaje)."""
    try:
        from . import window
    except ImportError as e:
        return False, f"sin modulo de ventana ({e})"
    if not window.disponible():
        return False, "WebKitGTK no instalado"
    try:
        w = window.Ventana(url, al_cerrar=al_cerrar)
        w.ejecutar()          # bloqueante hasta que se cierre
        return True, "GTK/WebKit2"
    except Exception as e:                                    # noqa: BLE001
        return False, f"error GTK ({e})"


def abrir_appmode(url):
    """Ventana sin barra de direcciones en navegadores Chromium."""
    for exe, args in APPMODE_BROWSERS:
        path = shutil.which(exe)
        if not path:
            continue
        try:
            subprocess.Popen([path] + [a.replace("%s", url) for a in args],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True, exe
        except (OSError, subprocess.SubprocessError):
            continue
    return False, ""


def abrir_navegador(url):
    """Navegador del sistema, probando xdg-open antes que webbrowser."""
    if os.environ.get("IASOLGES_BROWSER"):
        return webbrowser.open(url), "navegador (forzado)"
    for exe in ("xdg-open", "gio", "gnome-open", "kde-open5", "x-www-browser"):
        path = shutil.which(exe)
        if not path:
            continue
        cmd = [path, "open", url] if exe == "gio" else [path, url]
        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True, exe
        except (OSError, subprocess.SubprocessError):
            continue
    try:
        return webbrowser.open(url), "webbrowser"
    except Exception:                                          # noqa: BLE001
        return False, ""


def abrir(url, al_cerrar=None):
    """Abre la interfaz con el primer metodo disponible."""
    modo = os.environ.get("IASOLGES_WINDOW", "").lower()

    if modo != "browser":
        ok, como = abrir_nativo(url, al_cerrar=al_cerrar)
        if ok:
            return True, como, "nativo"
        if modo == "native":
            return False, como, "nativo"

    ok, como = abrir_appmode(url)
    if ok:
        return True, como, "app"

    ok, como = abrir_navegador(url)
    if ok:
        return True, como, "navegador"

    return False, "sin metodo", "ninguno"


# ------------------------------------------------------------- principal
def main(argv=None):
    argv = list(argv if argv is not None else sys.argv[1:])
    port = PREFERRED_PORT
    data_dir = None
    no_browser = "--no-browser" in argv or os.environ.get("IASOLGES_NO_BROWSER")
    debug = "--debug" in argv or os.environ.get("IASOLGES_DEBUG")

    for a in argv:
        if a.startswith("--port="):
            try:
                port = int(a.split("=", 1)[1])
            except ValueError:
                pass
        elif a.startswith("--data-dir="):
            data_dir = os.path.abspath(a.split("=", 1)[1])

    # Carpeta de la aplicacion: la del codigo fuente o /opt/iasolges.
    app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if data_dir:
        os.makedirs(data_dir, exist_ok=True)
        db_path = os.path.join(data_dir, "iasolges.db")
    else:
        db_path = resolver_db(app_dir)

    # --- instancia unica: si ya hay un IASolges escuchando, solo abrir ventana
    url_existente = f"http://127.0.0.1:{port}/"
    if _vivo(url_existente):
        log(f"  IASolges ya esta ejecutandose en {url_existente}")
        log(f"  Abriendo la interfaz en esa instancia...")
        if not no_browser:
            abrir(url_existente)
            return 0
        log(f"  Navega a {url_existente}")
        return 0

    db.init_db(db_path)
    httpd = appmod.create_server(db_path, port)
    puerto = httpd.server_address[1]
    url = f"http://127.0.0.1:{puerto}/"

    servidor = threading.Thread(target=httpd.serve_forever, daemon=True)
    servidor.start()

    def apagar():
        try:
            httpd.shutdown()
        except Exception:                                      # noqa: BLE001
            pass

    log("")
    log(f"  IASolges v{appmod.VERSION}")
    log(f"  Servidor : {url}")
    log(f"  Datos    : {db_path}")
    log("")

    if no_browser:
        log(f"  Modo servidor. Abre {url} en tu navegador.")
        log("  Ctrl+C para salir.")
        log("")
    else:
        # Espera a que el servidor responda antes de abrir la ventana.
        for _ in range(60):
            if _vivo(url, timeout=0.8):
                break
            time.sleep(0.25)

        modo_nombre = {"nativo": "ventana de aplicacion",
                       "app": "ventana del navegador",
                       "navegador": "navegador del sistema"}
        log("  Abriendo IASolges...")

        def cerrar():
            apagar()
            log("\n  Cerrando IASolges...")

        ok, como, modo = abrir(url, al_cerrar=cerrar)
        if ok:
            log(f"  Interfaz abierta ({modo_nombre.get(modo, modo)}: {como})")
            if modo in ("navegador", "app"):
                log("")
                log(f"  Si no ves la ventana, abre manualmente:  {url}")
                log("")
                # El proceso debe seguir vivo sirviendo la app.
                try:
                    while True:
                        time.sleep(1)
                except KeyboardInterrupt:
                    apagar()
            log("")
            return 0

        # Ningun metodo funciono: no fallar en silencio.
        log("")
        log("  !!  No se pudo abrir ninguna ventana automaticamente.")
        log("")
        log(f"      Abre manualmente esta direccion en tu navegador:")
        log("")
        log(f"          {url}")
        log("")
        log("  Para forzar el navegador:  iasolges --no-browser")
        log("  Ctrl+C para salir.")
        log("")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n  Cerrando IASolges...")
        apagar()
    return 0


if __name__ == "__main__":
    sys.exit(main())
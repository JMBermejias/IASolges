"""
IASolges - Comprobacion y aplicacion de actualizaciones

Consulta las releases publicadas en GitHub, compara con la version local y
ofrece la instalacion del paquete .deb descargado.
"""
import json
import os
import re
import shutil
import ssl
import subprocess
import tempfile
import urllib.error
import urllib.request

REPO_OWNER = "JMBermejias"
REPO_NAME = "IASolges"
REPO_SLUG = f"{REPO_OWNER}/{REPO_NAME}"
API_URL = f"https://api.github.com/repos/{REPO_SLUG}/releases/latest"
RELEASE_PAGE = f"https://github.com/{REPO_SLUG}/releases/latest"
TIMEOUT = 12
UA = "IASolges-Update-Checker"


class UpdateError(Exception):
    pass


def version_tuple(v):
    """'1.2.3' -> (1, 2, 3). Tolera sufijos tipo '1.2.3-rc1'."""
    nums = re.findall(r"\d+", str(v or ""))
    parts = [int(n) for n in nums[:3]]
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts)


def _get(url, binary=False):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/vnd.github+json",
    })
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as r:
            data = r.read()
            return data if binary else json.loads(data.decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise UpdateError(f"GitHub respondio HTTP {e.code}")
    except urllib.error.URLError as e:
        raise UpdateError(f"Sin conexion a Internet ({e.reason})")
    except (ValueError, TimeoutError, OSError) as e:
        raise UpdateError(str(e))


def comprobar(actual):
    """
    Devuelve el estado de la actualizacion.
      actual, ultima, hay_actualizacion, url, notas, fecha, publicado
    """
    info = _get(API_URL)
    tag = info.get("tag_name") or info.get("name") or "0"
    ultima = tag.lstrip("vV")

    hay = version_tuple(ultima) > version_tuple(actual)

    notas = ""
    cuerpo = info.get("body") or ""
    # Se queda con las primeras lineas utiles del cuerpo de la release.
    lineas = [l.rstrip() for l in cuerpo.splitlines() if l.strip()]
    if lineas:
        notas = "\n".join(lineas[:12])[:2000]

    activo = next((a for a in info.get("assets", [])
                   if a.get("name", "").endswith(".deb")), None)

    return {
        "repositorio": REPO_SLUG,
        "actual": actual,
        "ultima": ultima,
        "hay_actualizacion": hay,
        "url": RELEASE_PAGE,
        "notas": notas,
        "publicado": info.get("published_at", ""),
        "paquete": (activo or {}).get("browser_download_url", ""),
        "paquete_nombre": (activo or {}).get("name", ""),
        "tamano": (activo or {}).get("size", 0),
        "prerelease": bool(info.get("prerelease")),
    }


# ---------------------------------------------------------------- aplicacion
def _cache_dir():
    d = os.environ.get("XDG_CACHE_HOME") or os.path.expanduser("~/.cache")
    d = os.path.join(d, "iasolges", "updates")
    os.makedirs(d, exist_ok=True)
    return d


def _url_oficial(url):
    """Solo se aceptan URLs de descarga de la release oficial del repositorio."""
    try:
        from urllib.parse import urlparse
        p = urlparse(url)
    except ValueError:
        return False
    return (p.scheme == "https"
            and p.netloc in ("github.com", "www.github.com", "objects.githubusercontent.com")
            and REPO_SLUG in p.path
            and p.path.endswith(".deb"))


def descargar(url, nombre_destino=None):
    """Descarga el .deb y lo valida. Devuelve la ruta local."""
    if not url:
        raise UpdateError("GitHub no publica un paquete .deb para esta version")
    if not _url_oficial(url):
        raise UpdateError("La descarga solo se permite desde la release oficial "
                          f"de {REPO_SLUG}")

    dest = os.path.join(_cache_dir(), nombre_destino or os.path.basename(url))
    tmp = dest + ".part"
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(url, timeout=180, context=ctx) as r:
            with open(tmp, "wb") as f:
                shutil.copyfileobj(r, f)
    except urllib.error.URLError as e:
        raise UpdateError(f"No se pudo descargar: {e.reason}")
    os.replace(tmp, dest)

    # Validacion: debe ser un paquete Debian legitimo.
    if not _es_deb(dest):
        os.remove(dest)
        raise UpdateError("El archivo descargado no es un paquete .deb valido")
    return dest


def _es_deb(path):
    try:
        with open(path, "rb") as f:
            return f.read(8) == b"!<arch>\n"
    except OSError:
        return False


def instalar(ruta_deb):
    """
    Instala el paquete con pkexec (pide clave de forma grafica).
    Si no hay pkexec, devuelve la orden que debe ejecutar el usuario.
    """
    if not _es_deb(ruta_deb):
        raise UpdateError("El archivo no es un paquete .deb valido")

    pkexec = shutil.which("pkexec")
    if pkexec:
        # Lista de argumentos: nunca se pasa por un shell.
        proc = subprocess.run([pkexec, "dpkg", "-i", ruta_deb],
                              capture_output=True, text=True, timeout=300)
        salida = (proc.stdout or "") + (proc.stderr or "")
        if proc.returncode == 0:
            return {"ok": True, "metodo": "pkexec", "salida": salida[-800:]}
        # Si el usuario cancela, dpkg devuelve codigo 126/127.
        if proc.returncode in (126, 127):
            raise UpdateError("Instalacion cancelada o no autorizada")
        return {"ok": False, "metodo": "pkexec",
                "salida": salida[-800:] or f"dpkg termino con codigo {proc.returncode}"}

    return {"ok": False, "metodo": "manual",
            "salida": f"sudo apt install {ruta_deb}",
            "comando": f"sudo apt install {ruta_deb}"}
#!/usr/bin/env python3
"""
Regresion del fallo que hizo que la busqueda real cayese siempre a la muestra.

La app instalada arranca SIN --data-dir (usa la ruta por defecto). Solo en ese
caso la carpeta de cache de OpenStreetMap se quedaba sin fijar, la cache en
memoria devolvia la tupla (fecha, valor) en vez del valor, y la busqueda
reventaba con "tuple indices must be integers or slices, not str". Como el
error se tragaba, el usuario veia datos inventados sin saber por que.

Este test no necesita red: comprueba la cache en memoria y que la cache de
disco se fija siempre, con y sin --data-dir.
   python3 tests/test_cache_osm.py
"""
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

ok = 0
fail = 0


def check(etiqueta, cond, detalle=""):
    global ok, fail
    if cond:
        ok += 1
        print("  \x1b[32mOK\x1b[0m   %s" % etiqueta)
    else:
        fail += 1
        print("  \x1b[31mFAIL\x1b[0m %s  %s" % (etiqueta, detalle))


def silencioso():
    global ok, fail
    ok += 1
    print("  \x1b[32mOK\x1b[0m   %s" % "todos silenciosos")


from iasolges import osm  # noqa: E402

print("\n=== 1. Cache en memoria (sin carpeta) ===")
osm.CACHE_DIR = None
osm._cache.clear()
clave = osm._clave_cache("prueba", "memoria")
osm._cache_escribir(clave, [{"name": "Taller Perez", "lat": 1.0}])
leido = osm._cache_leer(clave)
check("devuelve el VALOR, no la tupla (fecha, valor)",
      isinstance(leido, list), "tipo=%s" % type(leido).__name__)
check("el contenido es el esperado",
      isinstance(leido, list) and leido[0].get("name") == "Taller Perez",
      repr(leido)[:60])
try:
    leido[0]["name"]
    check("se puede indexar como diccionario (era el fallo real)", True)
except TypeError as e:
    check("se puede indexar como diccionario (era el fallo real)", False, str(e))

print("\n=== 2. La cache caduca ===")
osm._cache[clave] = (time.time() - (osm.CACHE_TTL + 60), [{"name": "Viejo"}])
check("una entrada caducada no se devuelve", osm._cache_leer(clave) is None,
      repr(osm._cache_leer(clave))[:50])
osm._cache.clear()
silencioso()

print("\n=== 3. La carpeta se crea sola ===")
tmp = tempfile.mkdtemp(prefix="iasolges-cache-")
destino = os.path.join(tmp, "cache", "a", "mas")
try:
    osm.fijar_cache(destino)
    check("crea la carpeta aunque no exista",
          os.path.isdir(destino), destino)
    osm._cache_escribir("k1", [{"name": "X"}])
    check("se puede escribir en la carpeta recien creada",
          os.path.exists(os.path.join(destino, "osm_k1.json")))
    check("y se vuelve a leer",
          osm._cache_leer("k1")[0]["name"] == "X")
except OSError as e:
    check("crea la carpeta aunque no exista", False, str(e))

print("\n=== 4. La cache se fija siempre, con y sin --data-dir ===")
from iasolges.app import Api  # noqa: E402

dbdir = tempfile.mkdtemp(prefix="iasolges-db-")
db = os.path.join(dbdir, "iasolges.db")
Api(db)                      # arranque normal de la app instalada
check("sin --data-dir tambien se fija la cache",
      osm.CACHE_DIR == os.path.join(dbdir, "cache"), str(osm.CACHE_DIR))
check("la carpeta existe de verdad", os.path.isdir(osm.CACHE_DIR or ""))
check("la cache esta junto a la base de datos, no en /tmp suelto",
      (osm.CACHE_DIR or "").startswith(dbdir), osm.CACHE_DIR or "")

db2 = os.path.join(tempfile.mkdtemp(prefix="iasolges-db2-"), "iasolges.db")
osm.CACHE_DIR = None
Api(db2)
check("tampoco se olvida si antes estaba sin fijar", osm.CACHE_DIR is not None)

print("\n=== 5. Los errores se traducen al castellano ===")
import urllib.error  # noqa: E402

m = osm.motivo_amigable(urllib.error.HTTPError("u", 429, "Too Many", None, None))
check("el 429 se explica sin jerga", "limitando" in m.lower() or "429" in m, m[:60])
m2 = osm.motivo_amigable(urllib.error.URLError("Connection refused"))
check("el fallo de conexion se explica", "conexion" in m2.lower(), m2[:60])
m3 = osm.motivo_amigable(TypeError("tuple indices must be integers"))
check("un error interno no se muestra en crudo",
      "tuple indices" not in m3 and m3.strip() != "", m3[:70])
m4 = osm.motivo_amigable(osm.OSMError("No se encontro la localidad 'X'."))
check("un aviso propio se pasa tal cual", "X" in m4, m4[:60])
check("y sin punto duplicado", ".." not in m4, m4[-30:])
silencioso()

for d in (tmp, dbdir):
    shutil.rmtree(d, ignore_errors=True)

print("\n%s\n  %d correctos | %d fallidos\n%s"
      % ("=" * 52, ok, fail, "=" * 52))
sys.exit(1 if fail else 0)
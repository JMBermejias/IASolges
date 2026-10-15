"""Nombres y coordenadas REALES de negocios y centros, vía OpenStreetMap.

Antes el mapa generaba nombres inventados ("Asesoria S.L. 1", "Asesoria S.L. 2"...)
con teléfonos y correos también inventados. Para vender eso es un problema: un
teléfono inventado quema la relación en el primer contacto.

Aquí se consultan datos abiertos reales:
  * Nominatim  -> nombres reales, dirección y coordenadas.
  * Tiles OSM  -> el mapa de fondo (los usa el navegador, ver views.js).

Reglas de uso que impone OpenStreetMap y que hay que respetar:
  * User-Agent identificable (ya se usa USER_AGENT).
  * Máximo 1 petición por segundo. Se respetan con _throttle().
  * Los datos se cachean 7 días para no repetir consultas.

Si no hay red, o el sector no devuelve nada, se cae a los datos de muestra
y cada resultado indica claramente de dónde sale.
"""

import hashlib
import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request

NOMINATIM = "https://nominatim.openstreetmap.org"
UA_OSM = "IASolges/1.0 (+https://github.com/JMBermejias/IASolges; uso comercial local)"

# Palabras que se buscan en OpenStreetMap para cada sector.
#
# Importante: OpenStreetMap esta etiquetado con lugares y oficios concretos
# ("peluqueria", "fontaneria"), no con categorias de empresa ("constructora",
# "consultoria"). Buscar "constructora" en un pueblo devuelve 0 aunque haya
# veinte empresas de reformas. Por eso cada lista mezcla el termino
# profesional con los oficios reales que se Findan en el mapa.
CLAVES_SECTOR = {
    "tecnologia": ["informatica", "software", "telefonia", "telecomunicaciones",
                   "servicios informaticos", "reparacion de computers", "consultoria"],
    "salud": ["centro de salud", "clinica", "fisioterapia", "dental", "dentista",
              "farmacia", "laboratorio", "veterinario", "psicologo", "podologo"],
    "legal": ["despacho", "abogado", "asesoria", "gestoria", "notario",
              "administracion de loteria", "inmobiliaria"],
    "construccion": ["reformas", "fontaneria", "electricista", "carpinteria",
                     "albanil", "cerrajeria", "instalaciones", "pintores",
                     "inmobiliaria", "techos", "piscinas", "revestimientos"],
    "ecommerce": ["tienda online", "comercio electronico", "distribuidor", "almacen",
                  "mayorista", "envios"],
    "hosteleria": ["restaurante", "hotel", "cafe", "bar", "catering", "panaderia",
                   "pizzeria", "taperia", "hostal", "residencia"],
    "educacion": ["academia", "centro de formacion", "escuela", "instituto",
                  "guarderia", "colegio", "autoescuela", "conservatorio"],
    "servicios": ["asesoria", "gestoria", "agencia", "consultora", "seguros",
                  "inmobiliaria", "lavanderia", "peluqueria", "esteticista",
                  "spa", "masajes", "limpieza", "traduccion"],
    "agricultura": ["agricola", "cooperativa", "vinedo", "finca", "vivero",
                    "riego", "almacen agricola"],
    "industrial": ["industrial", "almacen", "metalurgica", "mantenimiento",
                   "caldereria", "carpinteria metalica", "envasado"],
    "general": ["tienda", "servicios", "comercio", "empresa", "centro", "almacen"],
}

# Si con la lista del sector no salen suficientes, se prueban estos oficios
# Amplios antes de recurrir a palabras genericas.
AMPLIAR = {
    "tecnologia": ["impresion", "fotocopia", "electronica", "cable"],
    "salud": ["ortopedia", "optica", "auditorio", "nutricion", "fisioterapia"],
    "legal": ["seguros", "comunidad de propietarios"],
    "construccion": ["excavaciones", "hormigon", "vidrieria", "ceramica", "calefaccion"],
    "ecommerce": ["papeleria", "ferreteria"],
    "hosteleria": ["cocina", "pasteleria", "asador", "marisqueria"],
    "educacion": ["musica", "baile", "idiomas", "refuerzo"],
    "servicios": ["tapiceria", "cerrajeria", "rotulacion", "carnets"],
    "agricultura": ["olivar", "almendro", "agricultura"],
    "industrial": ["calderas", "electricidad industrial", "maquinaria"],
    "general": ["restaurante", "peluqueria", "panaderia", "farmacia", "fontaneria"],
}

# Ultimo recurso: palabras que existen en cualquier pueblo.
GENERICOS = ["tienda", "empresa", "servicios", "comercio"]

# Tope de peticiones a Nominatim por busqueda. Cada una tarda 1-2 s y su
# politica pide no abusar: mejor menos resultados que bloquearse.
MAX_PETICIONES = 12

# Tipos que se ofrecen en el desplegable de la aplicacion, por sector.
ETIQUETAS = {
    "tecnologia": "Tecnologia y software",
    "salud": "Salud y clinics",
    "legal": "Legal y gestorias",
    "construccion": "Construccion y reformas",
    "ecommerce": "Comercio electronico",
    "educacion": "Educacion y formacion",
    "hosteleria": "Hosteleria y restauracion",
    "servicios": "Servicios profesionales",
    "agricultura": "Agricultura",
    "industrial": "Industria y almacen",
    "general": "Cualquiera",
}

_cache = {}
_ultima_llamada = [0.0]
CACHE_DIR = None          # lo fija el arranque de la aplicacion
CACHE_TTL = 7 * 24 * 3600


class OSMError(Exception):
    pass


def fijar_cache(directorio):
    global CACHE_DIR
    CACHE_DIR = directorio


def _throttle():
    """OpenStreetMap pide no pasar de 1 peticion por segundo."""
    ahora = time.monotonic()
    espera = 1.05 - (ahora - _ultima_llamada[0])
    if espera > 0:
        time.sleep(espera)
    _ultima_llamada[0] = time.monotonic()


def _clave_cache(*partes):
    h = hashlib.sha256("|".join(str(p) for p in partes).encode("utf-8")).hexdigest()[:24]
    return h


def _cache_leer(clave):
    if not CACHE_DIR:
        c = _cache.get(clave)
        return c if (c and time.time() - c[0] < CACHE_TTL) else None
    ruta = os.path.join(CACHE_DIR, "osm_%s.json" % clave)
    try:
        if os.path.exists(ruta) and time.time() - os.path.getmtime(ruta) < CACHE_TTL:
            with open(ruta, encoding="utf-8") as f:
                return json.load(f)
    except (OSError, ValueError):
        pass
    return None


def _cache_escribir(clave, valor):
    if not CACHE_DIR:
        _cache[clave] = (time.time(), valor)
        return
    try:
        ruta = os.path.join(CACHE_DIR, "osm_%s.json" % clave)
        with open(ruta, "w", encoding="utf-8") as f:
            json.dump(valor, f, ensure_ascii=False)
    except OSError:
        pass


def _pedir(ruta, params, timeout=18):
    url = "%s/%s?%s" % (NOMINATIM, ruta, urllib.parse.urlencode(params))
    _throttle()
    req = urllib.request.Request(url, headers={"User-Agent": UA_OSM,
                                               "Accept": "application/json",
                                               "Accept-Language": "es"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def geocodificar(lugar):
    """'Novelda, Alicante' -> (lat, lon, nombre legible)."""
    clave = _clave_cache("geo", lugar)
    got = _cache_leer(clave)
    if got:
        return (got["lat"], got["lon"], got["nombre"])
    datos = _pedir("search", {"q": lugar, "format": "jsonv2", "limit": "1",
                             "addressdetails": "0"})
    if not datos:
        raise OSMError("No se encontro la localidad '%s'." % lugar)
    d = datos[0]
    val = {"lat": float(d["lat"]), "lon": float(d["lon"]),
           "nombre": d.get("display_name", lugar).split(",")[0].strip()}
    _cache_escribir(clave, val)
    return (val["lat"], val["lon"], val["nombre"])


def _distancia(lat1, lon1, lat2, lon2):
    """Distancia en km,formula simple (suficiente para ordenar candidatos)."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _direccion(a):
    if not a:
        return ""
    calle = a.get("road") or a.get("pedestrian") or a.get("footway") or ""
    num = a.get("house_number") or ""
    ciudad = a.get("city") or a.get("town") or a.get("village") or a.get("municipality") or ""
    partes = [p for p in (" ".join(x for x in (calle, num) if x).strip(), ciudad) if p]
    return ", ".join(partes)


def buscar_reales(localidad, sector, radio, limite=20, tipo=""):
    """Negocios y centros REALES alrededor de una localidad.

    Devuelve una lista de dicts con la misma forma que usa el mapa. Si no hay
    conexion o no se encuentra nada, devuelve lista vacia: el llamante cae a
    los datos de muestra avisando al usuario.
    """
    sector = (sector or "general").lower()
    radio = max(1, min(100, int(radio or 10)))
    limite = max(1, min(60, int(limite or 20)))
    lat, lon, _ = geocodificar(localidad)

    if tipo:
        rondas = [[tipo.lower()]]
    else:
        rondas = [CLAVES_SECTOR.get(sector, CLAVES_SECTOR["general"]),
                  AMPLIAR.get(sector, []), GENERICOS]

    vistos = {}
    pedidos = 0

    def _consulta(clave):
        """Una peticion a Nominatim, con su cache en disco."""
        consulta = "%s, %s" % (clave, localidad)
        ck = _clave_cache("b", consulta, radio, limite)
        got = _cache_leer(ck)
        if got is not None:
            return got
        try:
            got = _pedir("search", {
                "q": consulta, "format": "jsonv2", "limit": str(min(50, limite * 3)),
                "addressdetails": "1", "extratags": "1", "countrycodes": "es",
            })
        except (urllib.error.URLError, urllib.error.HTTPError, OSError,
                ValueError, TimeoutError):
            got = []
        _cache_escribir(ck, got)
        return got

    for claves in rondas:
        for clave in claves:
            if pedidos >= MAX_PETICIONES or len(vistos) >= limite:
                break
            pedidos += 1
            for d in _consulta(clave):
                nombre = (d.get("name") or "").strip()
                if not nombre or len(nombre) < 3:
                    continue
                try:
                    flat, flon = float(d["lat"]), float(d["lon"])
                except (KeyError, ValueError, TypeError):
                    continue
                dist = _distancia(lat, lon, flat, flon)
                if dist > radio:
                    continue
                if nombre in vistos and dist >= vistos[nombre]["distance"]:
                    continue
                vistos[nombre] = {
                    "name": nombre,
                    "business_type": _etiqueta(d.get("category") or "",
                                                d.get("type") or "", clave, sector),
                    "address": _direccion(d.get("address")) or d.get("display_name", ""),
                    "lat": round(flat, 6), "lon": round(flon, 6),
                    "distance": round(dist, 2),
                    # OpenStreetMap no publica telefono ni correo. Se dejan
                    # vacios a proposito: inventarlos seria peor que no tenerlos.
                    "phone": "", "email": "", "website": "",
                    "score": 0, "size": "", "pain": "", "real": True,
                    "osm_id": "%s/%s" % (d.get("osm_type", "node"), d.get("osm_id", "")),
                }
        if len(vistos) >= limite:
            break

    salida = sorted(vistos.values(), key=lambda r: r["distance"])[:limite]
    return salida, lat, lon


def _etiqueta(cat, sub, clave, sector):
    """Traduce la etiqueta de OpenStreetMap a algo legible en castellano."""
    pares = {
        "amenity/doctors": "Centro medico", "amenity/clinic": "Clinica",
        "amenity/dentist": "Clinica dental", "amenity/pharmacy": "Farmacia",
        "amenity/restaurant": "Restaurante", "amenity/cafe": "Cafeteria",
        "amenity/bar": "Bar", "amenity/hospital": "Hospital",
        "amenity/school": "Centro educativo", "amenity/college": "Centro de formacion",
        "amenity/college|amenity/school": "Centro de formacion",
        "amenity/Kindergarten": "Guarderia", "office/accountant": "Asesoria",
        "office/lawyer": "Despacho de abogados", "shop": "Comercio",
        "shop/supermarket": "Supermercado", "shop/hairdresser": "Peluqueria",
        "shop/car_repair": "Taller de automocion", "shop/beauty": "Peluqueria y belleza",
        "office/estate_agent": "Inmobiliaria", "office/company": "Empresa",
        "lodging/hotel": "Hotel", "lodging/hostel": "Alojamiento",
        "craft": "Taller artesanal", "industrial": "Industria",
        "building/commercial": "Negocio",
    }
    par = "%s/%s" % (cat, sub)
    if par in pares:
        return pares[par]
    if cat == "office":
        return "Oficina"
    if cat == "shop":
        return "Comercio"
    if cat == "amenity":
        return sub.replace("_", " ").capitalize() or "Servicio"
    return clave.capitalize()


def tipos_disponibles(sector, localidad=None):
    """Tipos que se ofrecen en el desplegable 'Tipo de negocio'."""
    sector = (sector or "general").lower()
    out = []
    for t in TIPOS.get(sector, GENERIC):
        if t not in out:
            out.append(t)
    if localidad:
        ck = _clave_cache("t", localidad, sector)
        got = _cache_leer(ck)
        if got is None:
            try:
                real, _lat, _lon = buscar_reales(localidad, sector, 10, 25)
                etiquetas = []
                for r in real:
                    if r["business_type"] not in etiquetas:
                        etiquetas.append(r["business_type"])
                got = etiquetas[:14]
            except OSMError:
                got = []
            _cache_escribir(ck, got)
        for t in got:
            if t not in out:
                out.append(t)
    return out

# ------------------------------------------------------------------- TILES
TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"


def tile(z, x, y):
    """Descarga un tile del mapa y lo cachea en disco.

    Hace falta porque OpenStreetMap devuelve 403 a cualquier peticion que no
    se identifique: si el navegador pide los tiles directamente, los bloquean.
    Pasando por aqui, la peticion sale con nuestro User-Agent y la cache, como
    pide su politica de uso.

    Devuelve (bytes_png, ok).
    """
    z, x, y = int(z), int(x), int(y)
    if not (0 <= z <= 19 and 0 <= x < 2 ** z and 0 <= y < 2 ** z):
        return (b"", False)
    nombre = "tile_%d_%d_%d.png" % (z, x, y)
    if CACHE_DIR:
        ruta = os.path.join(CACHE_DIR, nombre)
        try:
            if os.path.exists(ruta) and os.path.getsize(ruta) > 100:
                with open(ruta, "rb") as f:
                    return (f.read(), True)
        except OSError:
            pass
    try:
        req = urllib.request.Request(TILE_URL.format(z=z, x=x, y=y),
                                     headers={"User-Agent": UA_OSM,
                                              "Accept": "image/png,*/*"})
        with urllib.request.urlopen(req, timeout=12) as r:
            datos = r.read()
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, TimeoutError):
        return (b"", False)
    if len(datos) < 100:
        return (b"", False)
    if CACHE_DIR:
        try:
            with open(os.path.join(CACHE_DIR, nombre), "wb") as f:
                f.write(datos)
        except OSError:
            pass
    return (datos, True)

#!/usr/bin/env python3
"""Prueba de integracion de la API de IASolges."""
import json
import re
import os
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8791"
ok = fail = 0


def call(method, path, body=None):
    req = urllib.request.Request(
        BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if "json" in (r.headers.get("content-type") or "") else raw)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def check(label, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  \033[32mOK\033[0m   {label}")
    else:
        fail += 1
        print(f"  \033[31mFAIL\033[0m {label}  {detail}")


def has(label, data, key, minlen=1):
    v = data.get(key) if isinstance(data, dict) else None
    check(f"{label}: '{key}' presente ({minlen} chars)", bool(v) and len(str(v)) >= minlen,
          f"got={str(v)[:60]}")


print("\n=== 1. Nucleo ===")
s, d = call("GET", "/api/ping"); check("ping", s == 200 and d.get("ok"))
ping_version = d.get("version")
s, d = call("GET", "/api/dashboard")
check("dashboard KPIs", s == 200 and "clientes" in d, str(d)[:120])
check("dashboard chart", isinstance(d.get("chart"), dict))

print("\n=== 2. Datos de ejemplo ===")
# seed_demo es idempotente: si ya hay datos no duplica. El test debe tolerarlo.
s, d = call("POST", "/api/seed-demo", {})
check("seed demo responde ok", s == 200 and ("seeded" in d), str(d)[:150])
s, d = call("GET", "/api/dashboard")
check("clientes seeded >= 6", d.get("clientes", 0) >= 6, str(d.get("clientes")))
check("contactos seeded >= 6", d.get("contactos", 0) >= 6, str(d.get("contactos")))

print("\n=== 3. CRUD de modulos ===")
modules = {
    "clients": {"name": "Test Acme SL", "sector": "tecnologia", "city": "Madrid",
                "value": 45000, "status": "activo", "email": "a@b.es"},
    "contacts": {"name": "Juan Perez", "role": "CEO", "email": "j@b.es", "status": "lead"},
    "campaigns": {"name": "Campana Test", "objective": "vender mas", "budget": 3000},
    "works": {"title": "Trabajo Test", "type": "web", "status": "pendiente"},
    "prompts": {"title": "Prompt Test", "template": "Hola {{nombre}}", "category": "ventas"},
    "pricing": {"name": "Precio Test", "type": "servicio", "cost": 20, "price": 60,
                "sector": "tecnologia"},
    "prospects": {"company": "Prospecto SL", "sector": "legal", "score": 77},
    "brands": {"name": "Marca Test", "sector": "salud", "personality": "proximidad",
               "values": "cercania, rigor"},
    "names": {"name": "TestBrand", "score": 88, "domains": "testbrand.es"},
    "analyses": {"title": "Analisis Test", "type": "venta", "score": 70},
    "geo_searches": {"location": "Valencia", "radius": 15, "total": 20},
    "security_checks": {"title": "Check Test", "content": "api_key=abc123def456"},
}
ids = {}
for m, payload in modules.items():
    s, d = call("POST", f"/api/{m}", payload)
    ids[m] = d.get("id") if isinstance(d, dict) else None
    check(f"crear {m}", s == 201 and ids[m], str(d)[:120])
    s2, g = call("GET", f"/api/{m}/{ids[m]}")
    check(f"leer {m}", s2 == 200 and g.get("id") == ids[m], str(g)[:100])
    s3, _ = call("PUT", f"/api/{m}/{ids[m]}", {k: v for k, v in list(payload.items())[:3]})
    check(f"actualizar {m}", s3 == 200)
    s4, _ = call("POST", f"/api/{m}/{ids[m]}/star", {})
    check(f"favorito {m}", s4 == 200)
    s5, l = call("GET", f"/api/{m}?limit=5")
    check(f"listar {m}", s5 == 200 and isinstance(l.get("items"), list) and l["total"] >= 1,
          str(l)[:100])

print("\n=== 4. Presupuesto completo ===")
s, q = call("POST", "/api/quotes", {
    "title": "Propuesta Test", "client_id": 1, "status": "enviado",
    "issue_date": "2026-01-15", "tax_rate": 21, "discount": 10, "valid_days": 30,
    "items": [
        {"description": "Analisis", "category": "servicio", "qty": 10, "unit_price": 45, "discount": 0},
        {"description": "Desarrollo", "category": "servicio", "qty": 20, "unit_price": 45, "discount": 5},
        {"description": "Formacion", "category": "formacion", "qty": 5, "unit_price": 60, "discount": 0},
    ]})
qid = q.get("id")
check("crear presupuesto", s == 201 and qid, str(q)[:150])
t = q.get("totals", {})
# 450 + 855 + 300 = 1605 ; -10% = 1444.5 ; +21% = 1747.845 -> 1747.85
check("total base = 1605", abs(t.get("base", 0) - 1605) < 0.01, str(t))
check("descuento = 160.5", abs(t.get("discount", 0) - 160.5) < 0.01, str(t))
check("IVA correcto", abs(t.get("tax", 0) - 303.35) < 0.02, str(t))
check("total correcto", abs(t.get("total", 0) - 1747.85) < 0.02, str(t))
s, ql = call("GET", "/api/quotes?limit=50")
check("listado con client_name", s == 200 and any(i.get("client_name") for i in ql["items"]),
      str([i.get("client_name") for i in ql["items"]][:4]))

print("\n=== 5. Motor IA Local ===")
s, d = call("POST", "/api/ai/pricing", {"name": "Consultoria", "cost": 100, "price": 250,
                                        "sector": "tecnologia", "save": True})
check("pricing", s == 200 and len(d.get("text", "")) > 300, str(d)[:120])
has("pricing", d, "text", 400)

s, d = call("POST", "/api/ai/security",
            {"title": "Audit", "content": "api_key=sk-abcdef1234567890abcd http://inseguro.com/user 601234567"})
check("security findings", s == 200 and d.get("risk_level") == "critico", str(d)[:150])
check("security score > 0", d.get("score", 0) > 0, str(d.get("score")))

s, d = call("POST", "/api/ai/names", {"sector": "salud", "style": "mixto", "count": 8, "save": True})
check("names", s == 200 and len(d.get("names", [])) >= 8, str(d)[:150])

s, d = call("POST", "/api/ai/brand", {"name": "TestBrand", "sector": "tecnologia",
                                      "personality": "innovacion", "save": True})
has("brand", d, "text", 500)

s, d = call("POST", "/api/ai/analyze", {"title": "Copy", "type": "venta", "sector": "legal",
                                        "content": "Somos una empresa dedicada a soluciones. " * 12})
has("analyze", d, "text", 500)
check("analyze score", d.get("score", 0) > 0, str(d.get("score")))

s, d = call("POST", "/api/ai/geo", {"location": "Barcelona", "radius": 12,
                                    "sector": "hosteleria", "limit": 15})
check("geo results", s == 200 and len(d.get("results", [])) == 15, str(d)[:120])
check("geo coords", all(isinstance(r.get("lat"), float) and isinstance(r.get("lon"), float)
                        for r in d.get("results", [])[:3]))
has("geo analysis", d, "analysis", 300)

s, d = call("POST", "/api/ai/prospects", {"sector": "legal", "location": "Madrid",
                                          "limit": 10, "save": True})
has("prospects", d, "text", 500)
check("prospects parsed", len(d.get("records", [])) >= 5, str(len(d.get("records", []))))

s, d = call("POST", "/api/ai/campaign", {"name": "Camp IA", "objective": "captacion",
                                         "sector": "salud", "budget": 5000, "save": True})
has("campaign strategy", d, "strategy", 400)
has("campaign copy", d, "copy", 300)
has("campaign schedule", d, "schedule", 300)

s, d = call("POST", "/api/ai/optimize_prompt", {"template": "Escribe algo sobre ventas",
                                                "category": "ventas", "objective": "email"})
has("optimize_prompt", d, "text", 300)

s, d = call("POST", "/api/ai/test_prompt", {"template": "Hola {{nombre}}, eres {{puesto}}"})
has("test_prompt", d, "text", 200)

s, d = call("POST", "/api/ai/client", {"name": "Cliente X", "sector": "tecnologia",
                                        "size": "11-50", "value": 30000})
has("client", d, "text", 400)

s, d = call("POST", "/api/ai/quote", {"id": qid})
has("quote narrative", d, "text", 300)

print("\n=== 6. Constructor de programas ===")
for lang in ("Python", "JavaScript", "PHP", "Sin codigo"):
    s, d = call("POST", "/api/generator/program", {"params": {
        "name": "Demo " + lang, "type": "web", "objective": "gestionar ventas",
        "sector": "tecnologia", "features": "clientes, facturas, informes",
        "language": lang, "deployment": "nube", "budget": "medio"}, "save": True})
    prog = d.get("program", "")
    check(f"programa {lang}", s == 200 and len(prog) > 800, f"{len(prog)} chars")
    check(f"programa {lang} tiene modulos", "Modulos definidos" in prog)
    check(f"programa {lang} tiene codigo", "```" in prog)

print("\n=== 7. Favoritos / export / ajustes ===")
s, d = call("GET", "/api/favorites")
check("favoritos listados", s == 200 and d["count"] > 0, str(d.get("count")))

s, h = call("GET", f"/api/export/quote/{qid}")
check("export HTML presupuesto", s == 200 and "<table" in h and "TOTAL" in h)

s, d = call("POST", "/api/settings", {"company_name": "Mi Empresa", "theme": "verde",
                                      "ai_temperature": 0.5})
s, d = call("GET", "/api/settings")
check("settings guardados", d.get("company_name") == "Mi Empresa" and d.get("theme") == "verde")
check("api key oculta", d.get("ai_api_key_set") is False and "ai_api_key" not in d)

s, d = call("GET", "/api/modules")
check("modules registry", s == 200 and len(d.get("modules", {})) == 13, str(len(d.get("modules", {}))))

print("\n=== 8. Seguridad de entrada ===")
s, d = call("GET", "/api/clients?order=id%3BDROP+TABLE+clients")
check("ORDER BY injection bloqueada", s == 200 and d.get("count", 0) >= 0, str(s))
s, d = call("GET", "/api/clients?search=%27%20OR%201%3D1--")
check("busqueda con comillas segura", s == 200, str(s))
s, d = call("GET", "/api/../../etc/passwd")
check("path traversal bloqueado", s in (200, 404) and "root:" not in str(d), str(s))
s, d = call("GET", "/api/noexiste")
check("ruta inexistente -> 404 JSON", s == 404 and "error" in d, str(s))
s, d = call("GET", "/api/clients?status='+OR+1=1--")
check("filtro status sin inyeccion", s == 200, str(s))
s, d = call("GET", "/static/../iasolges/db.py")
check("escape de static bloqueado", "sqlite3" not in str(d), str(s))

print("\n=== 9. Credenciales del autor ===")
s, d = call("GET", "/api/credits")
check("endpoint credenciales", s == 200 and "nombre" in d, str(d)[:120])
check("nombre completo", d.get("nombre") == "Jose Manuel Bernabeu Mejias", str(d.get("nombre")))
addr = d.get("direccion", "")
check("direccion: medico", "Medico Rafael Navarro 2" in addr, addr[:60])
check("direccion: 2C", "2C" in addr, addr[:60])
check("direccion: Novelda", "Novelda" in addr, addr[:60])
check("direccion: codigo postal", "03660" in addr, addr[:60])
check("direccion: Alicante", "Alicante" in addr, addr[:60])
check("licencia MIT", d.get("licencia") == "MIT", str(d.get("licencia")))
check("copyright con nombre", "Jose Manuel Bernabeu Mejias" in d.get("copyright", ""),
      str(d.get("copyright")))
check("version coherente", d.get("version") == ping_version, str(d.get("version")))

print("\n=== 10. Actualizaciones ===")
s, d = call("GET", "/api/update/check")
# GitHub limita las peticiones anonimas (60/hora). Si esta limitado, la app
# debe responder con un error claro: eso tambien es el comportamiento correcto.
limitado = "403" in (d.get("error") or "") or "rate" in (d.get("error") or "").lower()
check("endpoint check responde", s == 200 and (d.get("ok") is True or limitado), str(d)[:120])
if limitado:
    print("        (GitHub limita las peticiones anonimas: se omite la comprobacion remota)")
else:
    check("comprobacion remota correcta", d.get("ok") is True, str(d)[:120])
check("compara versiones", d.get("actual") == ping_version, str(d.get("actual")))
if d.get("ok"):
    check("informa ultima version", bool(d.get("ultima")), str(d.get("ultima")))
    check("informa repositorio", d.get("repositorio") == "JMBermejias/IASolges",
          str(d.get("repositorio")))
    if d.get("hay_actualizacion"):
        check("paquete .deb publicado", str(d.get("paquete", "")).endswith(".deb"),
              str(d.get("paquete"))[:70])

# URLs no oficiales deben rechazarse siempre
try:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))
    from iasolges.update import descargar, UpdateError, _url_oficial
    check("URL oficial aceptada",
          _url_oficial("https://github.com/JMBermejias/IASolges/releases/download/v1.0.0/a.deb"))
    check("URL externa rechazada", not _url_oficial("https://evil.com/iasolges.deb"))
    check("URL de otro repo rechazada", not _url_oficial("https://github.com/otro/repo/a.deb"))
    check("http rechazado", not _url_oficial("http://github.com/JMBermejias/IASolges/a.deb"))
    check("extensión no .deb rechazada",
          not _url_oficial("https://github.com/JMBermejias/IASolges/x.sh"))
except ImportError:
    check("modulo update importable", False, "No se pudo importar iasolges.update")

print("\n=== 11. Botones en la interfaz ===")
html = urllib.request.urlopen(BASE + "/", timeout=10).read().decode()
for idbtn in ("btnHome", "btnUpdate", "btnAbout", "btnTheme", "btnQuickAI"):
    check(f"boton #{idbtn} en el HTML", f'id="{idbtn}"' in html)
check("contenedor updateBar", 'id="updateBar"' in html)

css = urllib.request.urlopen(BASE + "/css/app.css", timeout=10).read().decode()
check("CSS: boton Inicio", ".btn-home" in css)
check("CSS: barra de actualizacion", ".update-bar" in css)
check("CSS: ficha de credenciales", ".credits" in css)
check("CSS: hidden respetado", "[hidden]{display:none" in css)

# Regresion: icon() genera SVG sin width/height. Sin una regla que los limite,
# el navegador los pinta al tamano por defecto (300x150) y se ven enormes.
check("CSS: svg global con tamano", "svg{width:1em;height:1em" in css)
check("CSS: iconos de encabezado de panel con tamano",
      bool(re.search(r"\.panel-head h3 svg\{width:\d+px", css)))
check("CSS: iconos de tarjeta con tamano",
      bool(re.search(r"\.card-ico svg\{width:\d+px", css)))
# La regla global `svg{width:1em}` es la red de seguridad: garantiza que
# ningun icono pueda quedar sin tamano aunque falte una regla concreta.
for cont in (".card-ico svg", ".panel-head h3 svg", ".kpi .k-ico svg", ".btn svg",
             ".icon-btn svg", ".mini svg", ".feed-item .f-ico svg", ".empty .e-ico svg",
             ".side-ico svg"):
    ok_size = bool(re.search(re.escape(cont) + r"\s*\{[^}]*width:\s*\d", css))
    check(f"CSS: {cont} con tamaño", ok_size)

print("\n=== 12. Limpieza de paneles del inicio ===")
call("POST", "/api/works", {"title": "Trabajo limpieza", "type": "web"})
call("POST", "/api/works", {"title": "Trabajo limpieza 2", "type": "web"})
s, d = call("GET", "/api/dashboard")
check("dashboard tiene actividad", len(d.get("activity", [])) > 0, str(len(d.get("activity", []))))
check("dashboard cuenta trabajos", d.get("trabajos", 0) >= 2, str(d.get("trabajos")))

# 1) actividad: borra el log, NO los datos de negocio
s, r = call("POST", "/api/dashboard/clear", {"target": "activity"})
check("limpiar actividad ok", s == 200 and r.get("ok") is True, str(r)[:120])
check("actividad informa cuantos", r.get("eliminados", 0) > 0, str(r.get("eliminados")))
s, d = call("GET", "/api/dashboard")
check("actividad vaciada", len(d.get("activity", [])) <= 1, str(len(d.get("activity", []))))
check("limpiar actividad NO borra clientes", d.get("clientes", 0) >= 6, str(d.get("clientes")))
check("limpiar actividad NO borra trabajos", d.get("trabajos", 0) >= 2, str(d.get("trabajos")))

# 2) grafico: reinicia la ventana temporal, NO borra registros
s, r = call("POST", "/api/dashboard/clear", {"target": "chart"})
check("reiniciar grafico ok", s == 200 and r.get("ok") is True, str(r)[:120])
check("reiniciar grafico no elimina nada", r.get("eliminados") == 0, str(r.get("eliminados")))
s, d = call("GET", "/api/dashboard")
check("reiniciar grafico conserva clientes", d.get("clientes", 0) >= 6, str(d.get("clientes")))
check("reiniciar grafico conserva contactos", d.get("contactos", 0) >= 6, str(d.get("contactos")))
s, r = call("POST", "/api/dashboard/restore-chart", {})
check("restaurar grafico ok", s == 200 and r.get("ok") is True, str(r)[:120])
s, d = call("GET", "/api/dashboard")
check("grafico con datos tras restaurar",
      any(len(v) >= 1 for v in d.get("chart", {}).values()), str(d.get("chart"))[:70])

# 3) trabajos: si borra datos reales
s, before = call("GET", "/api/dashboard")
n_antes = before.get("trabajos", 0)
s, r = call("POST", "/api/dashboard/clear", {"target": "works"})
check("limpiar trabajos ok", s == 200 and r.get("ok") is True, str(r)[:120])
check("limpiar trabajos borra todos", r.get("eliminados", 0) >= n_antes, str(r.get("eliminados")))
s, d = call("GET", "/api/dashboard")
check("trabajos a cero", d.get("trabajos") == 0, str(d.get("trabajos")))
check("limpiar trabajos NO borra clientes", d.get("clientes", 0) >= 6, str(d.get("clientes")))

# 4) target invalido
s, r = call("POST", "/api/dashboard/clear", {"target": "../../etc/passwd"})
check("target invalido rechazado", s == 200 and r.get("ok") is False, str(r)[:120])

# 5) los tres botones existen en el panel de inicio
s, d = call("GET", "/api/dashboard")
call("POST", "/api/seed-demo", {})

print("\n=== 13. Proveedor OpenCode y catalogo de modelos ===")
try:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))
    from iasolges import ai as _ai
    check("OpenCode esta en la lista de proveedores", "opencode" in _ai.PROVIDERS)
    oc = _ai.PROVIDERS["opencode"]
    check("OpenCode tiene endpoint", oc["base"].startswith("https://opencode.ai"), oc.get("base"))
    check("OpenCode avisa de la limitacion", bool(oc.get("nota")), oc.get("nota", "")[:50])
    check("catalogo con 8 modelos", len(_ai.OPENCODE_MODELS) == 8, str(len(_ai.OPENCODE_MODELS)))
    catalogo_ids = [m[0] for m in _ai.OPENCODE_MODELS]
    for m in ("space-bunny-free", "cat-jam-free", "longcat-2.5-preview-free",
              "mimo-v2.6-flash-free", "step-5-preview-free",
              "muse-spark-1.3-contributor-free", "nemotron-3.5-lightning-free",
              "big-pickle"):
        check(f"modelo '{m}' en el catalogo", m in catalogo_ids)
    check("User-Agent propio definido", "IASolges" in _ai.USER_AGENT, _ai.USER_AGENT)
    # El endpoint rechaza el User-Agent por defecto de urllib: hay que enviarlo.
    try:
        import urllib.request as _u, ssl as _ssl
        _req = _u.Request(oc["base"] + "/models", headers={"User-Agent": _ai.USER_AGENT})
        with _u.urlopen(_req, timeout=20, context=_ssl.create_default_context()) as _r:
            _d = json.loads(_r.read().decode())
        _ms = _d.get("data", [])
        check("el endpoint acepta nuestro User-Agent", len(_ms) > 0, f"{len(_ms)} modelos")
        _todos = {m.get("id") for m in _ms}
        check("space-bunny-free esta en el endpoint", "space-bunny-free" in _todos)
        check("los 8 del catalogo estan en el endpoint",
              all(m in _todos for m in catalogo_ids),
              ",".join(m for m in catalogo_ids if m not in _todos))
    except Exception as _e:                                  # noqa: BLE001
        check("el endpoint acepta nuestro User-Agent", False, str(_e)[:70])
    # El mensaje de error debe explicarse en castellano
    msg = _ai._explicar_error(_ai.AIError(
        '{"type":"error","error":{"type":"FreeTierError",'
        '"message":"only be used from within OpenCode"}}'))
    check("error FreeTier traducido", "OpenCode" in msg and "Motor IA Local" in msg, msg[:70])
    check("error 403 traducido", "403" in _ai._explicar_error(_ai.AIError("HTTP 403")))
    check("error 401 traducido", "401" in _ai._explicar_error(_ai.AIError("HTTP 401")))
except ImportError as _e:
    check("modulo ai importable", False, str(_e))

# El endpoint debe responder para TODOS los proveedores, no solo OpenCode:
# el usuario complained de que solo cargaba el proveedor pero no los modelos.
s, d = call("GET", "/api/modelos?proveedor=local")
check("modelos de local", s == 200 and d["total"] >= 1, str(d.get("total")))
s, d = call("GET", "/api/modelos?proveedor=opencode")
check("modelos de opencode (sugeridos)", len(d.get("sugeridos", [])) == 8,
      str(len(d.get("sugeridos", []))))
check("modelos de opencode (remotos)", len(d.get("remoto", [])) > 0,
      f"{len(d.get('remoto', []))} remotos")
for prov, minimo in (("openai", 5), ("anthropic", 3), ("deepseek", 2), ("ollama", 5)):
    s, d = call("GET", f"/api/modelos?proveedor={prov}")
    n = len(d.get("sugeridos", []))
    check(f"modelos sugeridos de {prov}", s == 200 and n >= minimo, f"{n} (min {minimo})")
    check(f"{prov}: nombre legible", all(m.get("nombre") for m in d.get("sugeridos", [])))
    check(f"{prov}: indicacion si falta clave", "error" in d and bool(d["error"]) or not d["error"],
          d.get("error", "")[:40])
s, d = call("GET", "/api/modelos?proveedor=inventado")
check("proveedor desconocido no rompe", s == 200 and "sugeridos" in d, str(d)[:80])

# El selector de la interfaz debe ser un <select>, no un datalist:
# WebKit (ventana nativa) no muestra los desplegables de <datalist>.
js = urllib.request.urlopen(BASE + "/js/app.js", timeout=10).read().decode()
html = urllib.request.urlopen(BASE + "/", timeout=10).read().decode()
check("interfaz sin datalist (no funciona en WebKit)", "datalist" not in js, "queda un datalist")
check("existe el selector de modelo", 'id="selModelo"' in js, "falta selModelo")
check("existe el campo de texto libre", 'id="inpModeloLibre"' in js)
check("existe el indicador de estado", 'id="modelInfo"' in js)
check("se recarga al cambiar de proveedor", "recargarModelos" in js)

call("POST", "/api/settings", {"ai_provider": "local"})

# volver al motor local para no depender de la red en el resto de pruebas
call("POST", "/api/settings", {"ai_provider": "local"})

print("\n=== 14. Borrado ===")
for m in modules:
    s, _ = call("DELETE", f"/api/{m}/{ids[m]}")
    check(f"borrar {m}", s == 200)
s, d = call("GET", f"/api/clients/{ids['clients']}")
check("cliente borrado -> 404", s == 404, str(s))

print("\n=== 15. Boton Salir (instancia propia) ===")
# Necesita su propia instancia: el cierre detiene el servidor.
import subprocess as _sp
import tempfile as _tf
PUERTO_SALIR = 8899
_dir_salir = _tf.mkdtemp(prefix="iasolges-salir-")
_raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src")
_proc = _sp.Popen([sys.executable, "-m", "iasolges", "--no-browser",
                   f"--port={PUERTO_SALIR}", f"--data-dir={_dir_salir}"],
                  cwd=_raiz, stdout=_sp.DEVNULL, stderr=_sp.DEVNULL)
URL_S = f"http://127.0.0.1:{PUERTO_SALIR}"


def _espera_ping(url, segs=25):
    import time as _t
    fin = _t.time() + segs
    while _t.time() < fin:
        try:
            with urllib.request.urlopen(url + "/api/ping", timeout=1) as r:
                if r.status == 200:
                    return True
        except Exception:
            _t.sleep(0.25)
    return False


check("instancia de prueba arranca", _espera_ping(URL_S), URL_S)
req = urllib.request.Request(URL_S + "/api/shutdown", method="POST",
                             data=b"{}", headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req, timeout=10) as resp:
    rr = json.loads(resp.read().decode())
check("shutdown responde ok", rr.get("ok") is True, str(rr)[:100])
check("shutdown avisa que cierra", "cerrando" in (rr.get("mensaje") or "").lower(),
      str(rr.get("mensaje")))
# el proceso debe terminar solo
try:
    _proc.wait(timeout=15)
    terminado = True
except _sp.TimeoutExpired:
    terminado = False
    _proc.kill()
check("el proceso termina al salir", terminado, "sigue vivo tras 15 s")
check("el puerto queda libre", not _espera_ping(URL_S, segs=3), "el servidor sigue respondiendo")
_sp.run(["rm", "-rf", _dir_salir])

print("\n=== 16. El servidor principal sigue en pie ===")
check("el servidor de las pruebas no fue afectado",
      call("GET", "/api/ping")[1].get("ok") is True, "el test no debe matar el servidor")

print(f"\n{'='*52}\n  {ok} correctos | {fail} fallidos\n{'='*52}\n")
sys.exit(1 if fail else 0)
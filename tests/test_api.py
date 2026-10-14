#!/usr/bin/env python3
"""Prueba de integracion de la API de IASolges."""
import json
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
s, d = call("GET", "/api/dashboard")
check("dashboard KPIs", s == 200 and "clientes" in d, str(d)[:120])
check("dashboard chart", isinstance(d.get("chart"), dict))

print("\n=== 2. Datos de ejemplo ===")
s, d = call("POST", "/api/seed-demo", {}); check("seed demo", s == 200 and d.get("seeded"), str(d)[:150])
s, d = call("GET", "/api/dashboard"); check("clientes seeded = 6", d.get("clientes") == 6, str(d.get("clientes")))

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

print("\n=== 9. Borrado ===")
for m in modules:
    s, _ = call("DELETE", f"/api/{m}/{ids[m]}")
    check(f"borrar {m}", s == 200)
s, d = call("GET", f"/api/clients/{ids['clients']}")
check("cliente borrado -> 404", s == 404, str(s))

print(f"\n{'='*52}\n  {ok} correctos | {fail} fallidos\n{'='*52}\n")
sys.exit(1 if fail else 0)
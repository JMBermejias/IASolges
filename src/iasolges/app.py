"""
IASolges - Servidor HTTP y API REST
Implementado solo con la biblioteca estandar de Python (http.server).
"""
import json
import mimetypes
import os
import posixpath
import re
import sys
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

from . import __version__
from . import ai, db
from . import update as upd

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(HERE, "static")
VERSION = __version__   # fuente unica de verdad (src/iasolges/__init__.py)

MODULES = {
    "clients": {"label": "Clientes", "icon": "users", "group": "Plataforma"},
    "contacts": {"label": "Contactos", "icon": "user-check", "group": "Plataforma"},
    "campaigns": {"label": "Campanas", "icon": "megaphone", "group": "Plataforma"},
    "works": {"label": "Mi Trabajo", "icon": "briefcase", "group": "Plataforma"},
    "prompts": {"label": "Generador de Prompts", "icon": "terminal", "group": "Flujo de Trabajo"},
    "security_checks": {"label": "Chequeo de Seguridad", "icon": "shield", "group": "Flujo de Trabajo"},
    "pricing": {"label": "Precios", "icon": "tag", "group": "Flujo de Trabajo"},
    "prospects": {"label": "Prospectores", "icon": "crosshair", "group": "Flujo de Trabajo"},
    "geo_searches": {"label": "Mapa Localizador", "icon": "map", "group": "Flujo de Trabajo"},
    "brands": {"label": "Kit de Marca", "icon": "palette", "group": "Adicionales"},
    "names": {"label": "Nombres", "icon": "sparkles", "group": "Adicionales"},
    "analyses": {"label": "Analizador", "icon": "scan", "group": "Adicionales"},
    "quotes": {"label": "Presupuestos", "icon": "file-text", "group": "Adicionales"},
}


def _f(v, d=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return d


def _i(v, d=0):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return d


ALLOWED_ORDER = {"id DESC", "id ASC", "created_at DESC", "created_at ASC",
                 "updated_at DESC", "updated_at ASC", "value DESC", "value ASC",
                 "price DESC", "price ASC", "score DESC", "score ASC",
                 "name ASC", "title ASC", "number ASC", "progress DESC",
                 "priority ASC", "total DESC"}


def _safe_order(order, fields):
    """Whitelist de columnas ORDER BY: evita SQL injection por query string."""
    order = str(order or "id DESC").strip()
    if order in ALLOWED_ORDER:
        col = order.split()[0]
        if not fields or col in fields:
            return order
    return "id DESC"


# ------------------------------------------------------------------ rutas
class Api:
    def __init__(self, db_path, on_shutdown=None):
        self.db = db_path
        # Se inyecta desde create_server: detiene el servidor al salir.
        self.on_shutdown = on_shutdown or (lambda: None)
        self.puerto = 0

    # ---- dashboard
    def dashboard(self, q):
        s = db.stats(self.db)
        s["ai"] = ai.provider_info(self.db)
        s["activity"] = db.recent_activity(self.db, 10)
        s["version"] = VERSION
        s["recent_works"] = db.list_rows(self.db, "works", "id DESC", 5)
        s["top_clients"] = db.list_rows(self.db, "clients", "value DESC", 5)
        s["pipeline"] = db.list_rows(
            self.db, "quotes", "id DESC", 6,
            where="status IN ('borrador','enviado')")
        s["chart"] = self._chart()
        return s

    def _chart(self):
        conn = db.get_conn(self.db)
        meses = max(1, min(24, _i(db.get_setting(self.db, "chart_months", "6"), 6)))
        out = {}
        with db._db_lock:
            for t, label in (("clients", "Clientes"), ("contacts", "Contactos"),
                             ("campaigns", "Campanas"), ("quotes", "Presupuestos"),
                             ("works", "Trabajos"), ("prospects", "Prospectos")):
                rows = conn.execute(
                    f"SELECT substr(COALESCE(created_at,'2026-01-01'),1,7) m, COUNT(*) c "
                    f"FROM {t} GROUP BY m ORDER BY m DESC LIMIT ?", (meses,)).fetchall()
                out[t] = [{"month": r["m"], "count": r["c"]} for r in rows][::-1]
        return out

    # ---- CRUD generico
    def list(self, module, q):
        where, params = [], []
        search = (q.get("search", [""])[0] or "").strip()
        if search:
            fields = ["name", "title", "company", "sector", "city", "email", "notes", "description"]
            cols = [f for f in fields if f in db.FIELDS.get(module, [])]
            if cols:
                where.append("(" + " OR ".join(f"{c} LIKE ?" for c in cols) + ")")
                params += [f"%{search}%"] * len(cols)
        for key in ("status", "sector", "type", "channel", "priority", "category"):
            v = (q.get(key, [""])[0] or "").strip()
            if v and key in db.FIELDS.get(module, []):
                where.append(f"{key}=?")
                params.append(v)
        if q.get("starred", ["0"])[0] == "1":
            where.append("starred=1")
        w = " AND ".join(where) if where else None
        limit = min(_i(q.get("limit", ["200"])[0], 200), 1000)
        offset = _i(q.get("offset", ["0"])[0], 0)
        order = _safe_order(q.get("order", ["id DESC"])[0], db.FIELDS.get(module, []))
        rows = db.list_rows(self.db, module, order, limit, offset, w, params)
        if module == "quotes":
            names = self._client_names()
            for r in rows:
                r["client_name"] = names.get(r.get("client_id"), "")
                r["items"] = self._quote_items(r["id"])
                r["totals"] = self._quote_totals(r)
        return {"items": rows, "total": db.count_rows(self.db, module, w, params),
                "count": len(rows), "offset": offset, "limit": limit}

    def _client_names(self):
        return {r["id"]: r["name"] for r in db.list_rows(self.db, "clients", "id ASC", 2000)}

    def get(self, module, rid):
        row = db.get_row(self.db, module, rid)
        if row and module == "quotes":
            row["client_name"] = self._client_names().get(row.get("client_id"), "")
            row["items"] = self._quote_items(rid)
            row["totals"] = self._quote_totals(row)
        if row and module == "works":
            row["params_obj"] = db.jload(row.get("params"), {})
            row["output_obj"] = db.jload(row.get("ai_output"), {})
        return row

    def create(self, module, data):
        if module == "quotes":
            return self._quote_save(None, data)
        row = db.create_row(self.db, module, data)
        if module == "geo_searches":
            row["results"] = db.jload(row.get("results"), [])
        if module == "security_checks":
            f, sc, lv = ai.scan_security(row.get("content", ""))
            row["findings"] = f
        return row

    def update(self, module, rid, data):
        if module == "quotes":
            return self._quote_save(rid, data)
        row = db.update_row(self.db, module, rid, data)
        if row and module == "security_checks" and "content" in data:
            f, sc, lv = ai.scan_security(row.get("content", ""))
            row = db.update_row(self.db, module, rid,
                                {"findings": json.dumps(f), "score": sc, "risk_level": lv})
            row["findings"] = f
        return row

    def delete(self, module, rid):
        return db.delete_row(self.db, module, rid)

    def star(self, module, rid):
        return db.toggle_star(self.db, module, rid)

    # ---- quotes
    def _quote_items(self, qid):
        return db.list_rows(self.db, "quote_items", "id ASC", where="quote_id=?", params=[qid])

    def _quote_totals(self, q):
        items = q.get("items") or []
        base = sum(_f(i["qty"], 1) * _f(i["unit_price"]) * (1 - _f(i["discount"]) / 100) for i in items)
        disc = base * _f(q.get("discount")) / 100
        net = base - disc
        tax = net * _f(q.get("tax_rate")) / 100
        return {"base": round(base, 2), "discount": round(disc, 2), "net": round(net, 2),
                "tax": round(tax, 2), "total": round(net + tax, 2),
                "currency": q.get("currency", "EUR")}

    def _quote_save(self, qid, data):
        items = data.pop("items", None)
        conn = db.get_conn(self.db)
        if qid is None:
            count = db.count_rows(self.db, "quotes") + 1
            year = db.now()[:4]
            data.setdefault("number", f"PR-{year}-{count:04d}")
            row = db.create_row(self.db, "quotes", data)
            qid = row["id"]
        else:
            row = db.update_row(self.db, "quotes", qid, data)
        if items is not None:
            with db._db_lock:
                conn.execute("DELETE FROM quote_items WHERE quote_id=?", (qid,))
                conn.commit()
            for it in items:
                db.create_row(self.db, "quote_items", dict(it, quote_id=qid))
        row = db.get_row(self.db, "quotes", qid)
        row["items"] = self._quote_items(qid)
        row["totals"] = self._quote_totals(row)
        return row

    def quote_export(self, qid):
        q = self.get("quotes", qid)
        if not q:
            return None
        return render_quote_html(q)

    # ---- favorites
    def favorites(self, q):
        out = []
        for m in MODULES:
            rows = db.list_rows(self.db, m, "id DESC", 50, where="starred=1")
            for r in rows:
                out.append({"module": m, "module_label": MODULES[m]["label"],
                            "title": r.get("name") or r.get("title") or r.get("location") or f"#{r['id']}",
                            "id": r["id"], "item": r})
        return {"items": out, "count": len(out)}

    # ---- acciones IA
    def ai_action(self, action, data, q):
        dbp = self.db
        out = {"action": action, "engine": ai.provider_info(dbp)}
        if action == "optimize_prompt":
            txt = ai.generate(dbp, data.get("template", ""), fallback_task="prompt_optimize",
                              fallback_ctx={"template": data.get("template", ""),
                                            "category": data.get("category", "general"),
                                            "objective": data.get("objective", ""),
                                            "description": data.get("description", "")})
            out["text"] = txt
            out["codigo"] = ai.codigo_prompt(data.get("template", ""), data.get("category", "general"),
                                             data.get("objective", ""))
        elif action == "test_prompt":
            txt = ai.generate(dbp, "Ejecuta esta plantilla y muestra la salida: " + data.get("template", ""),
                              fallback_task="prompt_test",
                              fallback_ctx={"template": data.get("template", "")})
            out["text"] = txt
        elif action == "security":
            content = data.get("content", "")
            findings, score, level = ai.scan_security(content)
            out["findings"] = findings
            out["score"] = score
            out["risk_level"] = level
            out["text"] = ai.generate(dbp,
                                      f"Analiza estos riesgos de seguridad y redacta un plan de "
                                      f"remediacion. Hallazgos detectados: {json.dumps(findings, ensure_ascii=False)}",
                                      fallback_task="security", fallback_ctx={"content": content})
            rec = db.create_row(dbp, "security_checks", {
                "title": data.get("title") or "Chequeo manual",
                "target_type": data.get("target_type", "texto"),
                "content": content, "risk_level": level, "score": score,
                "findings": json.dumps(findings, ensure_ascii=False), "ai_report": out["text"]})
            out["record"] = rec
        elif action == "pricing":
            ctx = {"name": data.get("name", "Concepto"), "sector": data.get("sector", "general"),
                   "type": data.get("type", "servicio"), "cost": _f(data.get("cost")),
                   "price": _f(data.get("price"))}
            out["text"] = ai.generate(dbp, f"Analiza el pricing de {ctx['name']} en el sector "
                                           f"{ctx['sector']}. Coste {ctx['cost']} y precio {ctx['price']}.",
                                      fallback_task="pricing", fallback_ctx=ctx)
            out["analysis"] = out["text"]
            if data.get("save"):
                out["record"] = db.create_row(dbp, "pricing", dict(ctx, ai_analysis=out["text"]))
        elif action == "brand":
            ctx = {k: data.get(k, "") for k in ("name", "sector", "values", "audience",
                                                "personality", "competitors")}
            out["text"] = ai.generate(dbp, "Crea un kit de marca completo: " + json.dumps(ctx, ensure_ascii=False),
                                      fallback_task="brands", fallback_ctx=ctx)
            out["campos"] = ai.campos_marca(ctx)
            out["resumen"] = ai.resumen_marca(ctx)
            d = ai._try_json(out["text"], {}) or {}
            out["record"] = db.create_row(dbp, "brands", {
                "name": ctx["name"], "sector": ctx["sector"], "values": ctx["values"],
                "audience": ctx["audience"], "personality": ctx["personality"],
                "competitors": ctx["competitors"], "palette": json.dumps(ai.PALETTES.get(
                    (d.get("paleta") or "").lower(), ai.PALETTES["azul"]), ensure_ascii=False),
                "logo_concept": out["text"], "tone_of_voice": ctx["personality"],
                "description": out["text"][:500]})
        elif action == "names":
            ctx = {"sector": data.get("sector", "general"), "style": data.get("style", "mixto"),
                   "keywords": data.get("keywords", ""), "count": _i(data.get("count"), 12)}
            out["text"] = ai.generate(dbp, "Genera nombres de marca: " + json.dumps(ctx, ensure_ascii=False),
                                      fallback_task="names", fallback_ctx=ctx)
            out["names"] = _parse_names(out["text"])
            if data.get("save"):
                for n in out["names"]:
                    db.create_row(dbp, "names", n)
        elif action == "analyze":
            ctx = {"content": data.get("content", ""), "sector": data.get("sector", "general"),
                   "type": data.get("type", "general")}
            out["text"] = ai.generate(dbp, f"Analiza en profundidad este contenido ({ctx['type']}):\n\n"
                                           + ctx["content"][:8000],
                                      fallback_task="analyze", fallback_ctx=ctx)
            m = re.search(r"Puntuacion global:\s*\*\*(\d+)/100", out["text"])
            score = _i(m.group(1)) if m else 0
            summ = re.search(r"## Resumen\n(.*?)\n", out["text"]) or re.search(r"## Debilidades", out["text"])
            out["score"] = score
            out["record"] = db.create_row(dbp, "analyses", {
                "title": data.get("title") or "Analisis",
                "type": ctx["type"], "content": ctx["content"][:20000],
                "summary": (out["text"][:600]), "result": out["text"], "score": score})
        elif action == "geo":
            ctx = {"location": data.get("location", "Madrid"), "radius": _i(data.get("radius"), 10),
                   "sector": data.get("sector", "general"),
                   "business_type": data.get("business_type", ""),
                   "limit": _i(data.get("limit"), 20)}
            res = ai.local_generate("geo", "", ctx)
            txt = ai.generate(dbp, f"Analiza el mercado local de {ctx['location']} en el sector "
                                   f"{ctx['sector']} con {res['total']} resultados.",
                              fallback_task="geo", fallback_ctx=ctx)
            res["analysis"] = txt
            out.update(res)
            out["record"] = db.create_row(dbp, "geo_searches", {
                "location": ctx["location"], "radius": ctx["radius"], "sector": ctx["sector"],
                "business_type": res["results"][0]["business_type"] if res["results"] else "",
                "filters": json.dumps(ctx, ensure_ascii=False),
                "results": json.dumps(res["results"], ensure_ascii=False),
                "total": res["total"], "ai_analysis": txt})
        elif action == "geo_detail":
            res = data.get("resultados", []) or []
            if not isinstance(res, list) or not res:
                return {"ok": False, "error": "No hay resultados seleccionados."}
            res = res[:60]
            ctx = {"resultados": res,
                   "localidad": res[0].get("address", "").split(",")[-1].strip(),
                   "tipos": sorted({str(r.get("business_type", "")) for r in res if r.get("business_type")})}
            txt = ai.generate(dbp, "Analiza estos resultados de prospeccion local y di que "
                                   "tienen y que les falta para convertirlos en cliente:\n"
                                   + json.dumps(ctx, ensure_ascii=False, indent=2),
                              fallback_task="geo_detail", fallback_ctx=ctx)
            out["text"] = txt
            out["analizados"] = len(res)
        elif action == "prospects":
            ctx = {"sector": data.get("sector", "general"), "location": data.get("location", "Madrid"),
                   "limit": _i(data.get("limit"), 15)}
            txt = ai.generate(dbp, "Genera una lista de prospectos cualificados: "
                                   + json.dumps(ctx, ensure_ascii=False),
                              fallback_task="prospects", fallback_ctx=ctx)
            out["text"] = txt
            out["records"] = _parse_prospects(txt, ctx)
            if data.get("save"):
                for r in out["records"]:
                    db.create_row(dbp, "prospects", r)
        elif action == "campaign":
            ctx = {"name": data.get("name", "Campana"), "objective": data.get("objective", ""),
                   "channel": data.get("channel", "multicanal"), "sector": data.get("sector", "general"),
                   "budget": _f(data.get("budget")), "city": data.get("city", ""),
                   "company": data.get("company", "")}
            txt = ai.generate(dbp, "Genera estrategia, copy y calendario para esta campana: "
                                   + json.dumps(ctx, ensure_ascii=False),
                              fallback_task="campaign", fallback_ctx=ctx)
            parsed = ai._try_json(txt, {}) or {}
            loc = ai.local_generate("campaign", "", ctx)
            out["strategy"] = parsed.get("strategy") or loc["strategy"]
            out["copy"] = parsed.get("copy") or loc["copy"]
            out["schedule"] = parsed.get("schedule") or loc["schedule"]
            out["text"] = out["strategy"]
            if data.get("save"):
                out["record"] = db.create_row(dbp, "campaigns", {
                    "name": ctx["name"], "objective": ctx["objective"], "channel": ctx["channel"],
                    "sector": ctx["sector"], "city": ctx["city"], "budget": ctx["budget"],
                    "status": "borrador", "ai_strategy": out["strategy"],
                    "ai_copy": out["copy"], "ai_schedule": out["schedule"]})
        elif action == "client":
            ctx = {"name": data.get("name", "Cliente"), "sector": data.get("sector", "general"),
                   "size": data.get("size", ""), "value": _f(data.get("value"))}
            txt = ai.generate(dbp, f"Analiza el cliente {ctx['name']} del sector {ctx['sector']}.",
                              fallback_task="client", fallback_ctx=ctx)
            out["text"] = txt
            if data.get("save"):
                out["record"] = db.update_row(dbp, "clients", _i(data.get("id")), {"ai_analysis": txt}) \
                    if _i(data.get("id")) else None
        elif action == "quote":
            q = self.get("quotes", _i(data.get("id")))
            if not q:
                out["error"] = "Presupuesto no encontrado"
            else:
                cli = db.get_row(dbp, "clients", q.get("client_id")) or {}
                ctx = {"title": q.get("title", "Presupuesto"), "items": q.get("items", []),
                       "currency": q.get("currency", "EUR"), "valid_days": q.get("valid_days", 30),
                       "city": cli.get("city", ""), "sector": cli.get("sector", "general"),
                       "client_name": cli.get("name", "el cliente")}
                txt = ai.generate(dbp, "Redacta la narrativa de una propuesta comercial: "
                                       + json.dumps(ctx, ensure_ascii=False),
                                  fallback_task="quote", fallback_ctx=ctx)
                out["text"] = txt
                db.update_row(dbp, "quotes", q["id"], {"ai_narrative": txt})
                out["record"] = db.get_row(dbp, "quotes", q["id"])
        elif action == "program":
            params = data.get("params", {}) or {}
            out["program"] = ai.build_program(params, dbp)
            out["params"] = params
            if data.get("save"):
                client_id = _i(data.get("client_id")) or None
                out["record"] = db.create_row(dbp, "works", {
                    "title": params.get("name", "Programa generado"), "client_id": client_id,
                    "type": params.get("type", "web"), "status": "en_proceso", "priority": "media",
                    "description": params.get("objective", ""),
                    "params": json.dumps(params, ensure_ascii=False),
                    "ai_output": out["program"]})
        elif action == "dashboard_insights":
            s = db.stats(dbp)
            prompt = (f"Analiza estos indicadores de mi negocio y da 5 recomendaciones "
                      f"concretas y priorizadas:\n{json.dumps(s, ensure_ascii=False)}")
            out["text"] = ai.generate(dbp, prompt, fallback_task="general",
                                      fallback_ctx={"sector": "general"})
        else:
            out["error"] = f"Accion no reconocida: {action}"
        return out

    # ---- ajustes
    def get_settings(self, q):
        s = db.all_settings(self.db)
        key = s.pop("ai_api_key", "")
        s["ai_api_key_set"] = bool(key)
        s["ai_api_key_hint"] = ("*" * 4 + key[-4:]) if len(key) >= 4 else ""
        s["ai_provider_info"] = ai.provider_info(self.db)
        s["providers"] = ai.PROVIDERS
        s["version"] = VERSION
        return s

    def save_settings(self, data):
        for k, v in data.items():
            if k.startswith("_") or k in ("providers", "ai_provider_info",
                                          "ai_api_key_set", "ai_api_key_hint", "version"):
                continue
            if k == "ai_api_key":
                if v == "":
                    continue
            db.set_setting(self.db, k, v)
        db.log_activity(self.db, "configuracion", "actualizado", ", ".join(data.keys())[:200])
        return self.get_settings({})

    def backup(self, q):
        return {"db_path": self.db, "stats": db.stats(self.db), "version": VERSION}

    # ---- actualizaciones
    def update_check(self, q):
        try:
            return {"ok": True, **upd.comprobar(VERSION)}
        except upd.UpdateError as e:
            return {"ok": False, "error": str(e), "actual": VERSION,
                    "hay_actualizacion": False}

    def update_apply(self, data, q):
        url = (data.get("url") or "").strip()
        if not url:
            try:
                info = upd.comprobar(VERSION)
                if not info.get("hay_actualizacion"):
                    return {"ok": False, "error": "Ya tienes la ultima version."}
                url = info.get("paquete", "")
            except upd.UpdateError as e:
                return {"ok": False, "error": str(e)}
        try:
            ruta = upd.descargar(url)
            res = upd.instalar(ruta)
            res["ruta"] = ruta
            res["reiniciar"] = True
            return res
        except upd.UpdateError as e:
            return {"ok": False, "error": str(e)}

    # ---- catalogo de modelos
    def modelos(self, q):
        s = db.all_settings(self.db)
        # Permite consultar el catalogo de un proveedor sin llegar a guardarlo.
        pid = (q.get("proveedor", [""])[0] or s.get("ai_provider", "local")).strip()
        p = ai.PROVIDERS.get(pid, ai.PROVIDERS["local"])
        usar_ajustes = pid == s.get("ai_provider", "local")
        base = (s.get("ai_base_url") if usar_ajustes else "") or p.get("base", "")
        key = (s.get("ai_api_key") if usar_ajustes else "") or p.get("default_key", "")
        sugeridos = ai.SUGERIDOS.get(pid, [])

        remoto, error = [], ""
        if base:
            try:
                remoto = ai.listar_modelos(base, key).get("modelos", [])
            except ai.AIError as e:
                error = str(e)
        return {"ok": not error,
                "proveedor": pid,
                "etiqueta": p.get("label", pid),
                "base": base,
                "nota": p.get("nota", ""),
                "necesita_clave": bool(p.get("needs_key")),
                "sugeridos": [{"id": a, "nombre": b} for a, b in sugeridos],
                "remoto": remoto,
                "total": len(sugeridos) + len(remoto),
                "error": error}

    # ---- limpieza de paneles del inicio
    def limpiar_panel(self, target):
        """
        target:
          activity -> vacia el registro de actividad (es un log, no datos de negocio)
          works    -> elimina los registros de Mi Trabajo
          chart    -> reinicia la ventana del grafico de crecimiento (no borra datos)
        """
        conn = db.get_conn(self.db)
        if target == "activity":
            with db._db_lock:
                n = conn.execute("SELECT COUNT(*) c FROM activity").fetchone()["c"]
                conn.execute("DELETE FROM activity")
                conn.commit()
            db.log_activity(self.db, "inicio", "limpiado", f"actividad vaciada ({n})")
            return {"ok": True, "target": target, "eliminados": n,
                    "mensaje": f"Se han borrado {n} registros de actividad."}

        if target == "works":
            with db._db_lock:
                n = conn.execute("SELECT COUNT(*) c FROM works").fetchone()["c"]
                conn.execute("DELETE FROM works")
                conn.commit()
            db.log_activity(self.db, "inicio", "limpiado", f"trabajos eliminados ({n})")
            return {"ok": True, "target": target, "eliminados": n,
                    "mensaje": f"Se han eliminado {n} trabajos."}

        if target == "chart":
            db.set_setting(self.db, "chart_months", "1")
            return {"ok": True, "target": target, "eliminados": 0,
                    "mensaje": "Grafico reiniciado: solo muestra el mes actual. "
                               "No se ha borrado ningun registro."}

        return {"ok": False, "error": f"Panel desconocido: {target}"}

    def restaurar_chart(self):
        db.set_setting(self.db, "chart_months", "6")
        return {"ok": True, "mensaje": "Grafico restaurado a los ultimos 6 meses."}

    # ---- salida de la aplicacion
    def cerrar(self):
        """
        Detiene el servidor. Se responde primero y se corta despues, para que
        el navegador reciba la respuesta antes de quedarse sin conexion.
        """
        def parar():
            try:
                self.on_shutdown()
            except Exception:                                  # noqa: BLE001
                pass
        threading.Timer(0.5, parar).start()
        return {"ok": True, "mensaje": "Cerrando IASolges...",
                "url": self.url_actual()}

    def url_actual(self):
        return f"http://127.0.0.1:{getattr(self, 'puerto', 0) or 0}/"

    # ---- ficha del autor
    def creditos(self, q):
        s = db.all_settings(self.db)
        return {
            "nombre": s.get("author_name", "Jose Manuel Bernabeu Mejias"),
            "direccion": s.get("author_address",
                               "Medico Rafael Navarro 2, 2C\nNovelda, 03660 Alicante\nEspana"),
            "email": s.get("author_email", ""),
            "licencia": "MIT",
            "copyright": f"(c) {db.now()[:4]} Jose Manuel Bernabeu Mejias",
            "version": VERSION,
            "repositorio": upd.REPO_SLUG,
        }

    def import_csv(self, module, text, q):
        import csv
        import io as _io
        rows = list(csv.DictReader(_io.StringIO(text or "")))
        created, errors = 0, []
        for i, r in enumerate(rows):
            clean = {k: v for k, v in r.items() if k in db.FIELDS.get(module, [])}
            if not clean:
                continue
            try:
                db.create_row(self.db, module, clean)
                created += 1
            except Exception as e:
                errors.append(f"fila {i + 2}: {e}")
        return {"created": created, "errors": errors, "total": len(rows)}

    def seed_demo(self, q):
        if db.count_rows(self.db, "clients") > 0:
            return {"seeded": False, "msg": "Ya existen datos. No se toco nada."}
        demo_clients = [
            ("Clinica Dental Sonrisa", "Sonrisa S.L.", "salud", "Madrid", "11-50", 42000, "activo"),
            ("NovaTech Solutions", "NovaTech S.L.", "tecnologia", "Barcelona", "51-200", 96000, "activo"),
            ("Despacho Ruiz & Asociados", "Ruiz Legal S.L.", "legal", "Valencia", "1-10", 18000, "potencial"),
            ("Construcciones Roble", "Roble S.A.", "construccion", "Sevilla", "51-200", 150000, "activo"),
            ("Aula Abierta FP", "Aula Abierta S.L.", "educacion", "Bilbao", "11-50", 32000, "activo"),
            ("Restaurante Casa Mar", "Casa Mar S.L.", "hosteleria", "Malaga", "1-10", 12500, "potencial"),
        ]
        for n, c, s, city, size, val, st in demo_clients:
            db.create_row(self.db, "clients", {
                "name": n, "company": c, "sector": s, "city": city, "country": "España",
                "size": size, "value": val, "status": st,
                "email": f"info@{n.split()[0].lower()}.es", "phone": "+34 910 000 000",
                "website": f"www.{n.split()[0].lower()}.es",
                "tags": s, "segment": "pyme"})
        cids = [r["id"] for r in db.list_rows(self.db, "clients", "id ASC")]
        for i, (cid, n) in enumerate(zip(cids, ["Dra. Elena Mar", "Carlos Nova", "Marta Ruiz",
                                               "Javier Roble", "Ana Aulest", "Luis Casa"])):
            db.create_row(self.db, "contacts", {
                "name": n, "role": ["Direction comercial", "CTO", "Socia directora",
                                    "Gerente de obras", "Coordinadora formacion",
                                    "Chef propietario"][i], "client_id": cid,
                "status": ["lead", "contactado", "cualificado", "cliente", "lead", "contactado"][i],
                "email": f"{n.split()[0].lower()}@empresa.es", "phone": f"+34 6{i:02d}111222",
                "source": "linkedin", "tags": "demo"})
        db.create_row(self.db, "pricing", {"name": "Consultoria IT (hora)", "type": "servicio",
                                           "cost": 18, "price": 45, "unit": "hora",
                                           "sector": "tecnologia"})
        db.create_row(self.db, "pricing", {"name": "Plan Pro mensual", "type": "suscripcion",
                                           "cost": 9, "price": 29, "unit": "mes"})
        q1 = self._quote_save(None, {"title": "Implantacion CRM", "client_id": cids[0] if cids else None,
                                     "status": "enviado", "valid_days": 30, "tax_rate": 21,
                                     "items": [{"description": "Analisis y diseno", "category": "servicio",
                                                "qty": 12, "unit_price": 45, "tax_rate": 21},
                                               {"description": "Desarrollo e integracion", "category": "servicio",
                                                "qty": 60, "unit_price": 45, "tax_rate": 21},
                                               {"description": "Formacion", "category": "formacion",
                                                "qty": 8, "unit_price": 45, "tax_rate": 21}]})
        db.log_activity(self.db, "demo", "creado", "Datos de ejemplo cargados")
        return {"seeded": True, "msg": "Datos de ejemplo cargados", "quote": q1["number"]}


def _parse_names(text):
    out = []
    for m in re.finditer(r"###\s+(.+?)\n(.*?)(?=\n### |\n>|\Z)", text, re.S):
        name = m.group(1).strip()
        body = m.group(2)
        g = lambda p: (re.search(p, body, re.I).group(1).strip()
                       if re.search(p, body, re.I) else "")
        out.append({"name": name, "category": "marca", "meaning": g(r"Significado:\s*(.+)"),
                    "rationale": g(r"Por que funciona:\s*(.+)"),
                    "domains": g(r"Dominio sugerido:\s*`?([^`\n]+)`?"),
                    "score": _f(g(r"Puntuacion:\s*([\d.]+)")), "availability": "pendiente",
                    "ai_notes": body[:800]})
    return out


def _parse_prospects(text, ctx):
    out = []
    for m in re.finditer(r"^\d+\.\s+\*\*(.+?)\*\*\s*-\s*(.+?),\s*(.+?)$", text, re.M):
        out.append({"company": m.group(1).strip(), "contact": m.group(2).strip(),
                    "role": m.group(3).strip(), "city": ctx.get("location", ""),
                    "sector": ctx.get("sector", "general"), "status": "nuevo",
                    "source": "IA", "criteria": json.dumps(ctx, ensure_ascii=False),
                    "score": 75.0})
    return out


def render_quote_html(q):
    t = q.get("totals", {})
    cur = t.get("currency", "EUR")
    rows = "".join(
        f"<tr><td>{i.get('description','')}</td><td>{i.get('category','')}</td>"
        f"<td class='n'>{i.get('qty',0):g}</td><td class='n'>{i.get('unit_price',0):,.2f}</td>"
        f"<td class='n'>{_f(i.get('unit_price'))*_f(i.get('qty'),1):,.2f}</td></tr>"
        for i in q.get("items", []))
    return f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>{q.get('number','')} - Presupuesto</title><style>
body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#1f2937}}
h1{{color:#0b3c5d;margin-bottom:4px}} .meta{{color:#6b7280;margin-bottom:28px}}
table{{width:100%;border-collapse:collapse;margin:20px 0}}
th,td{{padding:10px;border-bottom:1px solid #e5e7eb;text-align:left}}
th{{background:#f3f4f6;font-size:13px;text-transform:uppercase;letter-spacing:.4px}}
.n{{text-align:right}} .tot{{margin-left:auto;width:320px}}
.tot div{{display:flex;justify-content:space-between;padding:6px 0}}
.tot .grand{{border-top:2px solid #0b3c5d;font-weight:700;font-size:18px;margin-top:8px;padding-top:12px}}
.box{{background:#f9fafb;border-left:4px solid #0b3c5d;padding:16px;margin:20px 0;white-space:pre-wrap}}
@media print{{body{{margin:0}}}}
</style></head><body>
<h1>Presupuesto {q.get('number','')}</h1>
<div class="meta">{q.get('title','')} &middot; Emitido {q.get('issue_date','')} &middot; Validez {q.get('valid_days',30)} dias</div>
<table><thead><tr><th>Concepto</th><th>Categoria</th><th class="n">Cant.</th>
<th class="n">Precio</th><th class="n">Importe</th></tr></thead><tbody>{rows}</tbody></table>
<div class="tot">
<div><span>Base imponible</span><span>{t.get('base',0):,.2f} {cur}</span></div>
<div><span>Descuento ({q.get('discount',0)}%)</span><span>-{t.get('discount',0):,.2f} {cur}</span></div>
<div><span>Base tras descuento</span><span>{t.get('net',0):,.2f} {cur}</span></div>
<div><span>IVA ({q.get('tax_rate',21)}%)</span><span>{t.get('tax',0):,.2f} {cur}</span></div>
<div class="grand"><span>TOTAL</span><span>{t.get('total',0):,.2f} {cur}</span></div></div>
{f'<div class="box">{q.get("ai_narrative","")}</div>' if q.get('ai_narrative') else ''}
{f'<div class="box"><strong>Notas:</strong>\\n{q.get("notes","")}</div>' if q.get('notes') else ''}
{f'<div class="box"><strong>Condiciones:</strong>\\n{q.get("terms","")}</div>' if q.get('terms') else ''}
<p style="margin-top:40px;color:#9ca3af;font-size:12px">Generado con IASolges v{VERSION}</p>
</body></html>"""


# ------------------------------------------------------------- HTTP handler
class Handler(BaseHTTPRequestHandler):
    server_version = f"IASolges/{VERSION}"
    protocol_version = "HTTP/1.1"
    api = None

    def log_message(self, fmt, *a):
        if os.environ.get("IASOLGES_DEBUG"):
            sys.stderr.write("[iasolges] " + (fmt % a) + "\n")

    # ---- helpers
    def _send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, ensure_ascii=False, default=str))

    def _body(self):
        n = _i(self.headers.get("Content-Length"), 0)
        if n <= 0:
            return {}
        raw = self.rfile.read(n)
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}

    # ---- routing
    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def do_PUT(self):
        self._route("PUT")

    def do_PATCH(self):
        self._route("PATCH")

    def do_DELETE(self):
        self._route("DELETE")

    def do_OPTIONS(self):
        self._send(204, b"", "text/plain")

    def _route(self, method):
        u = urlparse(self.path)
        path = unquote(u.path)
        q = parse_qs(u.query)
        try:
            if path.startswith("/api/"):
                return self._api(method, path[5:].strip("/"), q)
            return self._static(path)
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e), "type": type(e).__name__}, 500)

    def _api(self, method, path, q):
        parts = [p for p in path.split("/") if p]
        if not parts:
            return self._json({"ok": True, "app": "IASolges", "version": VERSION})
        a = self.api

        if parts[0] == "ping":
            return self._json({"ok": True, "version": VERSION, "ai": ai.provider_info(a.db)})
        if parts[0] == "credits":
            return self._json(a.creditos(q))
        if parts[0] == "modelos" and method == "GET":
            return self._json(a.modelos(q))
        if parts[0] == "shutdown" and method == "POST":
            return self._json(a.cerrar())
        if parts[0] == "dashboard":
            if parts[1:2] == ["clear"] and method == "POST":
                return self._json(a.limpiar_panel((self._body() or {}).get("target", "")))
            if parts[1:2] == ["restore-chart"] and method == "POST":
                return self._json(a.restaurar_chart())
        if parts[0] == "update":
            if parts[1:2] == ["check"] and method == "GET":
                return self._json(a.update_check(q))
            if parts[1:2] == ["apply"] and method == "POST":
                return self._json(a.update_apply(self._body(), q))
        if parts[0] == "dashboard" and method == "GET":
            return self._json(a.dashboard(q))
        if parts[0] == "favorites" and method == "GET":
            return self._json(a.favorites(q))
        if parts[0] == "settings":
            if method == "GET":
                return self._json(a.get_settings(q))
            if method in ("POST", "PUT"):
                return self._json(a.save_settings(self._body()))
        if parts[0] == "ai" and len(parts) >= 2:
            if method != "POST":
                return self._json({"error": "Usa POST"}, 405)
            accion = parts[1].replace("-", "_")
            return self._json(a.ai_action(accion, self._body(), q))
        if parts[0] == "generator":
            if parts[1] == "program" and method == "POST":
                return self._json(a.ai_action("program", self._body(), q))
        if parts[0] == "seed-demo" and method == "POST":
            return self._json(a.seed_demo(q))
        if parts[0] == "export":
            if parts[1] == "quote" and len(parts) >= 3:
                html = a.quote_export(_i(parts[2]))
                if not html:
                    return self._json({"error": "No encontrado"}, 404)
                return self._send(200, html, "text/html; charset=utf-8")
        if parts[0] == "backup" and method == "GET":
            return self._json(a.backup(q))
        if parts[0] == "import":
            mod = parts[1]
            data = self._body()
            if mod not in MODULES:
                return self._json({"error": "Modulo desconocido"}, 400)
            return self._json(a.import_csv(mod, data.get("csv", ""), q))
        if parts[0] == "modules" and method == "GET":
            return self._json({"modules": MODULES, "version": VERSION})

        if parts[0] in MODULES:
            mod = parts[0]
            if len(parts) == 1:
                if method == "GET":
                    return self._json(a.list(mod, q))
                if method == "POST":
                    return self._json(a.create(mod, self._body()), 201)
                return self._json({"error": "Metodo no permitido"}, 405)
            rid = _i(parts[1])
            if len(parts) == 3 and parts[2] == "star":
                row = a.star(mod, rid)
                return self._json(row) if row else self._json({"error": "No encontrado"}, 404)
            if method == "GET":
                row = a.get(mod, rid)
                return self._json(row) if row else self._json({"error": "No encontrado"}, 404)
            if method in ("PUT", "PATCH"):
                return self._json(a.update(mod, rid, self._body()))
            if method == "DELETE":
                return self._json({"deleted": a.delete(mod, rid)})
            if method == "POST":
                return self._json({"error": "Metodo no permitido"}, 405)
        return self._json({"error": "Ruta no encontrada: /api/" + path}, 404)

    def _static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        rel = posixpath.normpath(path).lstrip("/")
        full = os.path.normpath(os.path.join(STATIC_DIR, rel))
        if not full.startswith(STATIC_DIR):
            return self._send(403, "Prohibido", "text/plain")
        if not os.path.isfile(full):
            return self._send(404, "No encontrado", "text/plain")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "image/svg+xml"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            data = f.read()
        self._send(200, data, ctype)


def find_free_port(preferred=8765):
    import socket
    for p in [preferred] + list(range(8766, 8800)):
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


def create_server(db_path, port=8765):
    db.init_db(db_path)
    api = Api(db_path)
    Handler.api = api
    httpd = ThreadingHTTPServer(("127.0.0.1", find_free_port(port)), Handler)
    httpd.daemon_threads = True
    api.puerto = httpd.server_address[1]
    api.on_shutdown = httpd.shutdown
    return httpd
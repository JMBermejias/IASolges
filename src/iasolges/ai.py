"""
IASolges - Motor de Inteligencia Artificial
Capa de abstraccion sobre multiples proveedores + Motor IA Local integrated.

El "Motor IA Local" genera respuestas estructuradas y utiles sin conexion,
usando plantillas, lexicon sectorial y logica determinista. Esto garantiza que
la aplicacion es 100% funcional aunque no se configure ninguna API key.
"""
import json
import os
import re
import ssl
import urllib.error
import urllib.request

from . import db

# --------------------------------------------------------------- proveedores
PROVIDERS = {
    "local":     {"label": "Motor IA Local (integrado, sin conexion)", "needs_key": False},
    "openai":    {"label": "OpenAI", "base": "https://api.openai.com/v1", "needs_key": True},
    "openrouter":{"label": "OpenRouter", "base": "https://openrouter.ai/api/v1", "needs_key": True},
    "deepseek":  {"label": "DeepSeek", "base": "https://api.deepseek.com", "needs_key": True},
    "anthropic": {"label": "Anthropic Claude", "base": "https://api.anthropic.com/v1", "needs_key": True},
    "ollama":    {"label": "Ollama (local)", "base": "http://localhost:11434", "needs_key": False},
    "opencode":  {"label": "OpenCode", "base": "https://opencode.ai/inference/v1",
                  "needs_key": True, "default_key": "public",
                  "nota": "Endpoint compatible con OpenAI. El nivel gratuito solo admite "
                          "peticiones desde dentro del propio OpenCode."},
    "custom":    {"label": "Compatible OpenAI (personalizado)", "base": "", "needs_key": True},
}

# Catalogo de modelos de OpenCode (endpoint compatible con OpenAI).
OPENCODE_MODELS = [
    ("space-bunny-free", "Space Bunny Free"),
    ("cat-jam-free", "Cat Jam Free"),
    ("longcat-2.5-preview-free", "LongCat 2.5 Preview Free"),
    ("mimo-v2.6-flash-free", "MiMo-V2.6-Flash Free"),
    ("step-5-preview-free", "Step 5 Preview Free"),
    ("muse-spark-1.3-contributor-free", "Muse Spark 1.3 Free"),
    ("nemotron-3.5-lightning-free", "Nemotron 3.5 Lightning Free"),
    ("big-pickle", "Big Pickle"),
]

# Sugerencias por proveedor. Se muestran siempre, incluso sin clave API, para
# que el usuario tenga un punto de partida aunque el catalogo remoto falle.
SUGERIDOS = {
    "local": [("motor-iasolges-v1", "Motor IA Local (integrado)")],
    "openai": [("gpt-4o", "GPT-4o"), ("gpt-4o-mini", "GPT-4o mini"),
               ("gpt-4.1", "GPT-4.1"), ("gpt-4.1-mini", "GPT-4.1 mini"),
               ("o4-mini", "o4-mini"), ("o3", "o3")],
    "anthropic": [("claude-opus-4-5", "Claude Opus 4.5"),
                  ("claude-sonnet-4-5", "Claude Sonnet 4.5"),
                  ("claude-haiku-4-5", "Claude Haiku 4.5")],
    "deepseek": [("deepseek-chat", "DeepSeek Chat"),
                 ("deepseek-reasoner", "DeepSeek Reasoner")],
    "openrouter": [],
    "ollama": [("llama3.2", "Llama 3.2"), ("llama3.1", "Llama 3.1"),
               ("qwen2.5", "Qwen 2.5"), ("qwen3", "Qwen 3"),
               ("gemma3", "Gemma 3"), ("mistral", "Mistral"),
               ("deepseek-r1", "DeepSeek R1"), ("phi4", "Phi 4")],
    "opencode": list(OPENCODE_MODELS),
    "custom": [],
}


def listar_modelos(base=None, key=None, timeout=15):
    """Descarga el catalogo de modelos de un endpoint compatible con OpenAI."""
    base = (base or PROVIDERS["opencode"]["base"]).rstrip("/")
    if not base.endswith("/v1") and not base.endswith("/api/v1"):
        base = base + "/v1"
    url = base + "/models"
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout,
                                    context=ssl.create_default_context()) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise AIError(f"El proveedor devolvio HTTP {e.code}")
    except urllib.error.URLError as e:
        raise AIError(f"No se pudo contactar con el proveedor: {e.reason}")
    except (ValueError, TimeoutError, OSError) as e:
        raise AIError(str(e))

    items = data.get("data") if isinstance(data, dict) else data
    salida = []
    for m in (items or []):
        if not isinstance(m, dict):
            continue
        mid = m.get("id") or m.get("name")
        if not mid:
            continue
        salida.append({
            "id": mid,
            "nombre": (m.get("name") or mid).replace(mid, m.get("name") or mid).strip(),
            "contexto": m.get("context_length") or m.get("context") or 0,
        })
    salida.sort(key=lambda x: x["id"])
    return {"base": base, "modelos": salida, "total": len(salida)}

USER_AGENT = "IASolges/1.0 (+https://github.com/JMBermejias/IASolges)"

SYSTEM = ("Eres el motor de IA de IASolges, una plataforma profesional de gestion comercial "
          "y automatizacion. Respondes en el idioma del usuario, con formato claro y accionable. "
          "Cuando se te pide estructura o JSON, devuelvelo valido y sin texto adicional.")


class AIError(Exception):
    pass


def _settings(db_path):
    return db.all_settings(db_path)


def provider_info(db_path):
    s = _settings(db_path)
    pid = s.get("ai_provider", "local")
    p = PROVIDERS.get(pid, PROVIDERS["local"])
    return {
        "provider": pid,
        "label": p.get("label", pid),
        "model": s.get("ai_model", "motor-iasolges-v1"),
        "needs_key": p.get("needs_key", False),
        "configured": (not p.get("needs_key")) or bool(s.get("ai_api_key")),
        "base_url": s.get("ai_base_url") or p.get("base", ""),
        "has_key": bool(s.get("ai_api_key")),
    }


def _post_json(url, payload, headers, timeout=120):
    data = json.dumps(payload).encode("utf-8")
    # Algunos proveedores rechazan el User-Agent por defecto de urllib.
    headers = dict(headers or {})
    headers.setdefault("User-Agent", USER_AGENT)
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")[:400]
        except Exception:
            pass
        raise AIError(f"El proveedor devolvio HTTP {e.code}: {body}")
    except urllib.error.URLError as e:
        raise AIError(f"No se pudo conectar con el proveedor: {e.reason}")
    except json.JSONDecodeError:
        raise AIError("Respuesta no valida (JSON) del proveedor")


def _explicar_error(e):
    """Traduce los errores conocidos del proveedor a un mensaje util en castellano."""
    det = str(e)
    if "FreeTierError" in det or "only be used from within OpenCode" in det:
        return ("Nota: el proveedor **OpenCode** no ha atendido la peticion porque su "
                "nivel gratuito solo admite llamadas desde dentro de la propia aplicacion "
                "OpenCode. Se muestra el resultado del Motor IA Local, que funciona sin "
                "conexion. Si tienes una clave propia de otro proveedor (OpenAI, "
                "OpenRouter, DeepSeek, Anthropic u Ollama) puedes configurarla aqui.")
    if "403" in det:
        return ("Nota: el proveedor rechazo la peticion (HTTP 403). Revisa la clave API "
                "en Configuracion. Se muestra el resultado del Motor IA Local.")
    if "404" in det:
        return ("Nota: el proveedor no encontro ese modelo (HTTP 404). Comprueba el "
                "identificador en Configuracion. Se muestra el resultado del Motor IA Local.")
    if "401" in det:
        return ("Nota: la clave API no es valida (HTTP 401). Corrigela en Configuracion. "
                "Se muestra el resultado del Motor IA Local.")
    if "429" in det:
        return ("Nota: se ha alcanzado el limite de peticiones del proveedor (HTTP 429). "
                "Intentalo mas tarde. Se muestra el resultado del Motor IA Local.")
    return ("Nota: no se pudo contactar con el proveedor IA (" + det + "). "
            "Se muestra el resultado del Motor IA Local.")


# --------------------------------------------------------------- remoto
def _call_remote(db_path, prompt, system, temperature, max_tokens):
    s = _settings(db_path)
    pid = s.get("ai_provider", "local")
    p = PROVIDERS.get(pid, PROVIDERS["local"])
    base = (s.get("ai_base_url") or p.get("base", "")).rstrip("/")
    key = s.get("ai_api_key", "")
    if not key and p.get("default_key"):
        key = p["default_key"]
    model = s.get("ai_model", "") or "gpt-4o-mini"

    if pid == "anthropic":
        resp = _post_json(
            f"{base}/messages",
            {"model": model, "max_tokens": max_tokens, "temperature": temperature,
             "system": system or SYSTEM, "messages": [{"role": "user", "content": prompt}]},
            {"content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01"},
        )
        parts = [b.get("text", "") for b in resp.get("content", []) if b.get("type") == "text"]
        return "\n".join(parts).strip()

    if pid == "ollama":
        resp = _post_json(
            f"{base}/api/chat",
            {"model": model or "llama3.2", "messages": [{"role": "system", "content": system or SYSTEM},
                                                         {"role": "user", "content": prompt}],
             "stream": False, "options": {"temperature": temperature}},
            {"content-type": "application/json"},
        )
        return (resp.get("message", {}).get("content", "") or "").strip()

    # Compatible OpenAI
    headers = {"content-type": "application/json"}
    if key:
        headers["authorization"] = f"Bearer {key}"
    if pid == "openrouter":
        headers["http-referer"] = "https://github.com/JMBermejias/IASolges"
        headers["x-title"] = "IASolges"
    resp = _post_json(
        f"{base}/chat/completions",
        {"model": model, "messages": [{"role": "system", "content": system or SYSTEM},
                                      {"role": "user", "content": prompt}],
         "temperature": temperature, "max_tokens": max_tokens},
        headers,
    )
    return (resp["choices"][0]["message"]["content"] or "").strip()


def _try_json(text, default=None):
    if not text:
        return default
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    m = re.search(r"\{.*\}|\[.*\]", cleaned, re.S)
    if m:
        cleaned = m.group(0)
    try:
        return json.loads(cleaned)
    except ValueError:
        return default


# --------------------------------------------------------------- lexicon
SECTORES = {
    "tecnologia": {"actores": ["ingenieria de software", "consultoria IT", "desarrollo a medida",
                              "integracion de sistemas", "infraestructura cloud"],
                   "metricas": ["time to market", "uptime", "deuda tecnica", "coste por sprint"],
                   "canales": ["linkedin", "eventos tech", "referidos", "partnerships de fabricante"]},
    "salud": {"actores": ["clinicas", "consultorios", "laboratorios", "residencias", "mutuas"],
              "metricas": ["ocupacion", "tiempo de espera", "satisfaccion", "coste por paciente"],
              "canales": ["ferias sectoriales", "referidos clinicos", "digital", "convenios"]},
    "legal": {"actores": ["despachos", "asesorias juridicas", "notarias", "compliance"],
              "metricas": ["horas facturables", "tiempo de respuesta", "recuperacion", "cartera"],
              "canales": ["asociaciones", "formacion Continua", "linkedin", "referidos"]},
    "construccion": {"actores": ["promotores", "constructoras", "arquitectos", "reformas", "instaladores"],
                     "metricas": ["margen de obra", "plazos", "coste de materiales", "siniestralidad"],
                     "canales": ["ferias de construccion", "prescriptores", "plataformas de obra"]},
    "ecommerce": {"actores": ["marketplaces", "tiendas online", "dropshipping", "retail multicanal"],
                  "metricas": ["conversion", "CAC", "ticket medio", "rotacion de stock"],
                  "canales": ["paid social", "SEO", "email", "marketplaces"]},
    "educacion": {"actores": ["academias", "centros de formacion", "colegios", "universidades"],
                  "metricas": ["matrícula", "retencion", "coste por alumno", "satisfaccion"],
                  "canales": ["ferias de educacion", "referidos", "email", "redes"]},
    "hosteleria": {"actores": ["restaurantes", "hoteles", "bares", "catering"],
                   "metricas": ["ocupacion", "ticket medio", "rotacion de personal", "coste de plato"],
                   "canales": ["gastronomia", "reservas online", "reputacion", "fidelizacion"]},
    "servicios": {"actores": ["consultorias", "agencias", "asesorias", "gestorias"],
                  "metricas": ["facturacion por consultor", "retencion de clientes", "horas facturables"],
                  "canales": ["linkedin", "referidos", "contenido", "webinars"]},
    "agricultura": {"actores": ["cooperativas", "explotaciones", "agroindustria", "riego"],
                   "metricas": ["rendimiento", "coste por hectarea", "calidad", "temporada"],
                   "canales": ["ferias agro", "asociaciones", "distribuidores"]},
    "industrial": {"actores": ["plantas", "mantenimiento", "automatizacion", "distribucion industrial"],
                   "metricas": ["OEE", "paradas no planificadas", "coste unitario", "seguridad"],
                   "canales": ["ferias industriales", "ingenieria", "licitaciones"]},
}
SECTORES["general"] = SECTORES["servicios"]


def _sector_ctx(sector):
    return SECTORES.get((sector or "").lower().strip(), SECTORES["general"])


VERBS = ["Disenar", "Implementar", "Automatizar", "Optimizar", "Orquestar", "Desplegar",
         "Integrar", "Medir", "Governar", "Escalar"]
OBJ = ["el proceso comercial", "la captacion", "el onboarding de clientes", "el reporting",
       "la gestion documental", "el soporte", "la facturacion", "el despliegue en produccion",
       "la segmentacion", "la retencion"]


def _pick(seq, seed=0):
    return seq[seed % len(seq)]


# --------------------------------------------------------------- generico
def generate(db_path, prompt, system=None, temperature=None, max_tokens=None, fallback_task=None,
             fallback_ctx=None):
    """Punto de entrada universal. Si el proveedor remoto falla, cae al motor local."""
    s = _settings(db_path)
    pid = s.get("ai_provider", "local")
    if pid != "local":
        temp = float(temperature if temperature is not None else s.get("ai_temperature", 0.7))
        mx = int(max_tokens if max_tokens is not None else s.get("ai_max_tokens", 2000))
        try:
            return _call_remote(db_path, prompt, system or SYSTEM, temp, mx)
        except AIError as e:
            txt = _como_texto(local_generate(fallback_task or "general", prompt,
                                             fallback_ctx or {}))
            return txt + "\n\n" + _explicar_error(e)
    return _como_texto(local_generate(fallback_task or "general", prompt,
                                      fallback_ctx or {}))


def _como_texto(res):
    """El motor local puede devolver dict o list (geo, campana...): se serializa
    para que el contrato de generate() sea siempre texto."""
    if isinstance(res, (dict, list)):
        return json.dumps(res, ensure_ascii=False, indent=2)
    return res if isinstance(res, str) else str(res)


# --------------------------------------------------------------- MOTOR LOCAL
def local_generate(task, prompt, ctx=None):
    ctx = ctx or {}
    fn = {
        "prompt_optimize": _ll_opt_prompt,
        "prompt_test": _ll_prompt_test,
        "security": _ll_security,
        "pricing": _ll_pricing,
        "brands": _ll_brand,
        "names": _ll_names,
        "analyze": _ll_analyze,
        "geo": _ll_geo,
        "geo_analysis": _ll_geo_analysis,
        "geo_detail": _ll_geo_detail,
        "prospects": _ll_prospects,
        "campaign": _ll_campaign,
        "client": _ll_client,
        "program": lambda p, c: build_program(c),
        "quote": _ll_quote,
    }.get(task, _ll_generic)
    return fn(prompt, ctx)


def _ll_generic(prompt, ctx):
    sector = _sector_ctx(ctx.get("sector"))
    return (
        "## Motor IA Local - Respuesta estructurada\n\n"
        f"**Peticion recibida:** {prompt.strip()[:300]}\n\n"
        "El Motor IA Local procesa tu solicitud en modo offline. Para obtener una "
        "respuesta redactada por un modelo de lenguaje, configura una clave en "
        "**Configuracion > Inteligencia Artificial**.\n\n"
        "### Marco de trabajo generado\n"
        f"1. **Objetivo** - {ctx.get('objective', 'Definir el objetivo concreto de la accion.')}\n"
        f"2. **Actores clave** - {', '.join(sector['actores'][:3])}\n"
        f"3. **Metricas** - {', '.join(sector['metricas'])}\n"
        f"4. **Canales** - {', '.join(sector['canales'])}\n"
        f"5. **Siguiente paso** - Revisa, ajusta y aprueba."
    )


# ------------------------------------------------------------------ PROMPTS
def _ll_opt_prompt(prompt, ctx):
    txt = (ctx.get("template") or prompt or "").strip()
    variables = re.findall(r"\{\{\s*([\w\s]+?)\s*\}\}", txt)
    seen, uniq = set(), []
    for v in variables:
        if v.lower() not in seen:
            seen.add(v.lower())
            uniq.append(v)
    sector = ctx.get("category", "general")
    obj = ctx.get("objective") or "el objetivo que describes"
    return (
        "# Prompt optimizado\n\n"
        "## Version final\n```\n"
        f"Actua como un consultor experto en {sector} especializado en {obj}.\n\n"
        f"TAREA:\n{txt if txt else ctx.get('description', 'Describe la tarea.')}\n\n"
        "CONTEXTO:\n- Audiencia: {{" + (uniq[0] if uniq else "audiencia") + "}}\n"
        "- Sector: " + sector + "\n"
        "- Idioma de salida: castellano\n\n"
        "FORMATO DE SALIDA:\n"
        "1. Resumen ejecutivo (3 lineas)\n"
        "2. Desarrollo estructurado con ejemplos reales\n"
        "3. Recomendaciones accionables numeradas\n"
        "4. Errores comunes a evitar\n\n"
        "RESTRICCIONES:\n- Sé concreto, evita relleno.\n"
        "- Si faltan datos, indicarlos al final como 'Datos a confirmar'.\n```\n\n"
        "## Variables detectadas\n" + (", ".join(f"`{{{{{v}}}}}`" for v in uniq) if uniq
                                        else "_No se detectaron variables._") + "\n\n"
        "## Por que mejora\n"
        "- Anade **rol, contexto, formato y restricciones** explicitos.\n"
        "- Reduce ambiguedad y evita respuestas genericas.\n"
        "- Hace la salida verificable y reutilizable.\n"
    )




def codigo_prompt(descripcion, categoria="general", objetivo=""):
    """
    Convierte una idea escrita en lenguaje natural en un prompt estructurado
    en codigo, listo para pegar en cualquier IA.
    """
    desc = re.sub(r"\s+", " ", (descripcion or "")).strip()
    obj = re.sub(r"\s+", " ", (objetivo or "")).strip() or desc[:80]

    roles = {
        "ventas": "un consultor comercial experto en ventas B2B",
        "marketing": "un estratega de marketing digital",
        "analisis": "un analista de datos riguroso",
        "codigo": "un ingeniero de software senior",
        "estrategia": "un consultor de estrategia de negocio",
        "contenido": "un redactor de contenido",
        "general": "un asistente experto",
    }
    rol = roles.get(categoria, roles["general"])

    # Palabras significantes de la idea -> propuestas de variables.
    palabras = [w for w in re.findall(r"\b[a-zA-Z_][\w]{3,}\b", desc)
                if w.lower() not in ("para", "que", "como", "este", "esta", "nuestro",
                                     "nuestra", "quiero", "necesito", "prompt", "una", "uno")]
    vs = []
    for w in palabras:
        if w.lower() not in [v.lower() for v in vs]:
            vs.append(w)
        if len(vs) == 3:
            break
    bloque_vars = ("\n".join(f"- {{{v}}}: [valor]" for v in vs)
                   if vs else "- Ninguna: el prompt ya es autocontenido.")

    return f"""# Rol
Actua como {rol}.

# Contexto
- Categoria: {categoria}
- Objetivo: {obj}
- Idioma de salida: castellano

# Tarea
{desc}

# Formato de salida
1. Titular: una frase que resuma lo esencial.
2. Desarrollo: entre 150 y 400 palabras, en parrafos cortos.
3. Puntos clave: de 3 a 5 vinetas accionables.
4. Recomendaciones: numeradas, una por linea.

# Restricciones
- Concreto y verificable, sin relleno ni frases vacias.
- Si falta algun dato, indicarlo al final como "Datos a confirmar".
- No inventes cifras, nombres ni citas.

# Variables a sustituir
{bloque_vars}"""


def _ll_prompt_test(prompt, ctx):
    txt = (ctx.get("template") or "").strip()
    vars_ = re.findall(r"\{\{\s*([\w\s]+?)\s*\}\}", txt)
    sample = {v.strip(): f"[{v.strip().upper()}]" for v in vars_}
    filled = txt
    for k, v in sample.items():
        filled = filled.replace("{{" + k + "}}", v)
    return (
        "# Prueba de ejecucion del prompt\n\n"
        "## Prompt renderizado con datos de ejemplo\n```\n" + (filled or txt) + "\n```\n\n"
        f"**Variables detectadas:** {len(sample)} -> " + (", ".join(sample.keys()) if sample else "ninguna") + "\n\n"
        "## Muestra de salida esperada\n"
        "1. Resumen ejecutivo\n2. Desarrollo\n3. Recomendaciones\n\n"
        "## Control de calidad\n"
        "- Claridad: OK\n- Completo: OK\n"
        "- Formato definido: " + ("SI" if len(sample) >= 1 else "NO, anade variables") + "\n"
    )


# --------------------------------------------------------------- SEGURIDAD
SEC_RULES = [
    # ---- criticos: credenciales y material criptografico
    ("critico", "Clave expuesta", r"(?i)\b(api[_-]?key|apikey|secret|token|password|passwd|pwd|bearer)\b\s*[:=]\s*\S{6,}",
     "Rotar la credencial filtrada de inmediato."),
    ("critico", "Token estilo GitHub/AWS/OpenAI", r"\b(gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b",
     "La credencial debe considerarse comprometida."),
    ("critico", "Clave privada RSA/SSH", r"-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----",
     "Revoca el par de claves y genera uno nuevo."),
    ("critico", "Conexion sin cifrar a base de datos",
     r"(?i)\b(mysql|postgres(ql)?|mongodb(\+srv)?|redis|amqp)://[^\s\"']*:[^\s\"'@]*@",
     "Usa TLS y credenciales en un gestor de secretos."),
    ("critico", "Inyeccion de comandos", r"(?i)(os\.system\(|os\.popen\(|subprocess\.[a-z]+\([^)]*shell\s*=\s*True|\bexec\(|child_process\.exec\(|\beval\(|new Function\()",
     "Sustituye por llamadas a procesos con lista de argumentos, nunca con shell."),

    # ---- altos
    ("alto", "Dato personal", r"(?i)\b(\d{8}[A-Za-z]?|\b[67]\d{8}\b)\b|\b(nif|nie|dni|pasaporte|iban)\b",
     "Aplica RGPD: minimiza, cifra y limita la conservacion."),
    ("alto", "URL no segura", r"http://(?!localhost|127\.0\.0\.1)[^\s\"']+",
     "Sustituye por HTTPS para evitar interceptacion."),
    ("alto", "Permisos excesivos", r"(?i)\b(chmod\s+777|chmod\s+-R\s+777|sudo\s+rm\s+-rf|--dangerously-skip|--no-verify)\b",
     "Reduce privilegios: principio de minimo privilegio."),
    ("alto", "Inyeccion SQL concatenada",
     r"(?i)(select\s+.*from|insert\s+into|update\s+\w+\s+set|delete\s+from)[^;\n]{0,120}"
     r"(\$\{|\+\s*[\w\"']|%\s*\(|f[\"']|format\()",
     "Usa consultas parametrizadas (placeholders)."),
    ("alto", "XSS posible", r"(?i)(innerHTML\s*=\s*[^;]+|outerHTML\s*=\s*[^;]+|document\.write\(|insertAdjacentHTML\(|\$\([^)]*\)\.html\(|\bv-html\b|dangerouslySetInnerHTML)",
     "Escapa la salida o usa textContent."),
    ("alto", "Ruta de traversal", r"(\.\./\.\./|\.\.%2f|%2e%2e[/\\]|/etc/passwd|/proc/self/environ)",
     "Valida y normaliza las rutas antes de usarlas."),

    # ---- medios
    ("medio", "Secreto en texto plano", r"(?i)\b(password|contrasena|clave|secret)\b\s*[:=]\s*\S{3,}",
     "Sustituye por variables de entorno o gestor de secretos."),
    ("medio", "IP interna expuesta", r"\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b",
     "Revisa si la exposicion es necesaria."),
    ("medio", "CORS abierto", r"(?i)(Access-Control-Allow-Origin[\"']?\s*[:,]\s*[\"']?\*|cors\(\{\s*origin\s*:\s*[\"']?\*)",
     "Limita el origen a los dominios permitidos."),
    ("medio", "Algoritmo criptografico debil",
     r"(?i)\b(md5|sha1)\b(?![-\w])|createHash\([\"'](md5|sha1)[\"']\)|DES|RC4",
     "Usa SHA-256 o superior; para contrasenas, bcrypt/argon2."),
    ("medio", "Puerto de administracion expuesto",
     r"(?i)\b(3306|5432|6379|27017|9200|8080|8443|22)\b[^\n]{0,40}\b(open|public|0\.0\.0\.0|bind|listen)\b",
     "Restringe el acceso por firewall o VPN."),
    ("medio", "Ausencia de caducidad en el token", r"(?i)(jwt|token)[^\n]{0,30}(exp|expires|expiracion)\s*[:=]\s*(null|none|\"\"|0|false)",
     "Define siempre una fecha de caducidad."),
    ("medio", "Desactivacion de verificacion TLS",
     r"(?i)(verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*0|InsecureSkipVerify\s*:\s*true)",
     "No desactives la verificacion del certificado."),

    # ---- bajos
    ("bajo", "Modo depuracion activo", r"(?i)\b(DEBUG\s*=\s*True|app\.run\([^)]*debug\s*=\s*True|\.env\s*cargad[oa]\s*en\s*produccion)\b",
     "Desactiva el modo debug en produccion."),
    ("bajo", "Comentario con datos sensibles", r"(?i)//.*\b(todo|fixme|xxx)\b.*\b(key|token|password|secret)\b",
     "Limpia los comentarios antes de publicar."),
    ("bajo", "Email sin verificar", r"[\w.+-]+@[\w-]+\.[\w.]{2,}", "Verifica que el dominio de correo existe."),
    ("bajo", "Credencial por defecto", r"(?i)\b(admin/admin|root/root|test/test|user/user|guest/guest|password1)\b",
     "Cambia las credenciales por defecto."),
    ("bajo", "Cabecera de seguridad ausente",
     r"(?i)(Content-Security-Policy|X-Frame-Options|Strict-Transport-Security)",
     "Comprueba que existen (se lista como referencia de auditoria)."),
]

# Cobertura aproximada: se informa de que reglas se aplicaron.
SEC_CATEGORIAS = {
    "critico": "compromiso de credenciales o ejecucion de codigo",
    "alto": "exposicion de datos o inyeccion",
    "medio": "debilitacion de controles",
    "bajo": "buenas practicas",
}


def scan_security(content):
    findings = []
    text = content or ""
    for sev, title, pattern, advice in SEC_RULES:
        for m in re.finditer(pattern, text):
            frag = text[max(0, m.start() - 20): m.end() + 20].replace("\n", " ")
            if len(frag) > 110:
                frag = frag[:110] + "..."
            findings.append({
                "severity": sev, "title": title, "advice": advice, "match": frag.strip(),
                "position": m.start(),
            })
            if len(findings) >= 40:
                break
    weights = {"critico": 30, "alto": 15, "medio": 7, "bajo": 2}
    score = min(100, sum(weights[f["severity"]] for f in findings))
    level = "critico" if any(f["severity"] == "critico" for f in findings) else \
            "alto" if any(f["severity"] == "alto" for f in findings) else \
            "medio" if any(f["severity"] == "medio" for f in findings) else \
            "bajo" if findings else "limpio"
    return findings, score, level


def _ll_security(prompt, ctx):
    content = ctx.get("content", prompt)
    findings, score, level = scan_security(content)
    n_crit = sum(1 for f in findings if f["severity"] == "critico")
    n_high = sum(1 for f in findings if f["severity"] == "alto")
    n_med = sum(1 for f in findings if f["severity"] == "medio")
    lines = [
        "# Informe de Chequeo de Seguridad (Motor IA Local)", "",
        f"**Nivel de riesgo:** {level.upper()}  |  **Puntuacion de exposicion:** {score}/100", "",
        f"- Criticos: **{n_crit}**  |  Altos: **{n_high}**  |  Medios: **{n_med}**  "
        f"|  Totales: **{len(findings)}**", "", "## Hallazgos", "",
    ]
    if not findings:
        lines.append("_No se detectaron patrones de riesgo en el contenido analizado._")
    for f in findings[:15]:
        lines.append(f"### [{f['severity'].upper()}] {f['title']}")
        lines.append(f"- Evidencia: `{f['match']}`")
        lines.append(f"- Recomendacion: {f['advice']}\n")
    lines += ["## Plan de remediacion", "",
              "1. **Inmediato** - rotar credenciales expuestas y revocar tokens.",
              "2. **24 h** - cifrar datos personales, aplicar RGPD y revisar accesos.",
              "3. **72 h** - parametrizar consultas, forzar HTTPS y reducir permisos.",
              "4. **Continuo** - integrar este chequeo en el CI/CD y en cada entrega.",
              "", "## Buenas practicasarias",
              "- Principio de minimo privilegio y secretos fuera del repositorio.",
              "- Cifrado en transito y en reposo, con rotacion periodica de claves.",
              "- Registro de auditoria y alertas ante anomalias."]
    return "\n".join(lines)


# ---------------------------------------------------------------- PRECIOS
def _ll_pricing(prompt, ctx):
    sector = ctx.get("sector", "general")
    sc = _sector_ctx(sector)
    tipo = ctx.get("type", "servicio")
    cost = float(ctx.get("cost") or 0)
    price = float(ctx.get("price") or 0)
    if price <= 0:
        price = round(cost * (2.2 if tipo == "servicio" else 1.9), 2) if cost else 0
    margin = round((price - cost) / price * 100, 1) if price else 0
    markup = round((price / cost - 1) * 100, 1) if cost else 0
    if margin < 30:
        veredicto = "Margen bajo:RIESgo de trabajar por debajo de coste."
    elif margin < 50:
        veredicto = "Margen ajustado: viable con control de costes."
    elif margin < 70:
        veredicto = "Margen sano: rango recomendado para servicios."
    else:
        veredicto = "Margen alto: puedes competir en precio o ampliar margen."
    return (
        f"# Analisis de Precios - {ctx.get('name', 'Concepto')}\n\n"
        f"**Tipo:** {tipo}  |  **Sector:** {sector}\n"
        f"**Coste:** {cost:.2f} EUR  |  **Precio:** {price:.2f} EUR\n"
        f"**Margen sobre venta:** {margin}%  |  **Markup sobre coste:** {markup}%\n"
        f"**Veredicto:** {veredicto}\n\n"
        "## Escenarios de volumen\n"
        "| Volumen | Coste total | Ingreso | Margen |\n|---|---|---|---|\n"
        f"| 10 ud. | {cost*10:.2f} | {price*10:.2f} | {max(0,(price-cost)*10):.2f} |\n"
        f"| 50 ud. | {cost*50:.2f} | {price*50:.2f} | {max(0,(price-cost)*50):.2f} |\n"
        f"| 100 ud. | {cost*100:.2f} | {price*100:.2f} | {max(0,(price-cost)*100):.2f} |\n\n"
        "## Precio recomendado\n"
        f"- **Piso (margen {25}%):** {cost*1.33:.2f} EUR\n"
        f"- **Recomendado (margen {50}%):** {cost*2.0:.2f} EUR\n"
        f"- **Premium (margen {65}%):** {cost*2.86:.2f} EUR\n\n"
        "## Palancas del sector\n"
        + "\n".join(f"- {m}: cifra este indicador en la justificacion del precio." for m in sc["metricas"]) +
        "\n\n## Argumentario de venta\n"
        f"\"{ctx.get('name', 'La solucion')} existe. En {sector}, el cliente decide por "
        f"{', '.join(sc['metricas'][:2])}. Nuestro precio de {price:.2f} EUR se traduce en "
        "ahorro medible y riesgos evitados. Incluye garantia y soporte.\""
    )


# ---------------------------------------------------------------- MARCA
PALETTES = {
    "azul": ["#0B3C5D", "#1D6FA5", "#7DD3FC", "#F4F7FA", "#D62828"],
    "celeste": ["#0C4A6E", "#0284C7", "#7DD3FC", "#F0F9FF", "#C05621"],
    "morado": ["#3B0764", "#7C3AED", "#A78BFA", "#F5F3FF", "#DB2777"],
    "naranja": ["#7C2D12", "#EA580C", "#FB923C", "#FFF7ED", "#0F172A"],
    "elegante": ["#111827", "#374151", "#9CA3AF", "#F9FAFB", "#B45309"],
    "vibrante": ["#701A75", "#C026D3", "#F472B6", "#FDF4FF", "#06B6D4"],
}
FONT_PAIRS = [
    ("Montserrat", "Inter"), ("Poppins", "Roboto"), ("Playfair Display", "Source Sans 3"),
    ("Space Grotesk", "IBM Plex Sans"), ("DM Sans", "Manrope"), ("Outfit", "Inter"),
    ("Cormorant Garamond", "Lato"), ("Sora", "DM Sans"),
]
MOODS = {
    "proximidad": "Habla cercano, en primera persona, con ejemplos cotidianos. Nada de{coronelidad}.",
    "autoridad": "Tono experto, preciso, basado en datos. Evita superlativos vacios.",
    "innovacion": "Energico y visionario. Enfatiza lo que viene y por que ahora.",
    "elegancia": "Sobrio, sensorial, con cuidado tipografico y espacios de respiro.",
    "diversidad": "Inclusivo, directo, sin estereotipos. Representa a la audiencia real.",
    "urgencia": "Conciso y orientado a accion. Cabecera clara y llamada a la accion inmediata.",
}
TONE_NAMES = list(MOODS.keys())
SLOGANS = {
    "tecnologia": ["Donde la idea se ejecuta", "Construimos lo que viene", "Ingenieria en movimiento"],
    "salud": ["Cuidarte es nuestra oficio", "Bienestar que se mide", "Cada decision, una vida"],
    "legal": ["Confianza que se demuestra", "Criterio firme, respuesta clara", "Legal sin rodeos"],
    "construccion": ["Construimos para que dure", "Solidez que se ve", "Del plano a la obra"],
    "ecommerce": ["Del escaparate al cliente", "Vender es un sistema", "Tu tienda, mas viva"],
    "educacion": ["Aprender transforma", "Formacion que se nota", "Cada persona, un camino"],
    "hosteleria": ["Cada visita, un recuerdo", "Sabor de origen", "La experiencia empieza aqui"],
    "servicios": ["Resultados, no promesas", "Tu negocio, mas eficiente", "Expertise que resuelve"],
    "agricultura": ["Del campo a la mesa", "Cultivamos futuro", "Raiz y resultado"],
    "industrial": ["Industria que avanza", "Precision en cada ciclo", "Producimos confianza"],
}



_CAMPOS_MARCA = {
    "general": {"audience": "empresas decidas a mejorar sus resultados",
                "values": "cercania, rigor, resultados", "personality": "autoridad"},
    "tecnologia": {"audience": "pymes tecnologicas de 10 a 200 empleados",
                   "values": "innovacion, claridad, fiabilidad", "personality": "innovacion"},
    "salud": {"audience": "clinicas y consultorios privados",
              "values": "cercania, rigor, confianza", "personality": "proximidad"},
    "legal": {"audience": "despachos y asesorias juridicas de 5 a 50 profesionales",
              "values": "rigor, confidencialidad, criterio", "personality": "autoridad"},
    "construccion": {"audience": "promotoras, constructoras y estudios de arquitectura",
                     "values": "solidez, plazos, oficio", "personality": "elegancia"},
    "ecommerce": {"audience": "tiendas online y marcas de venta directa",
                  "values": "cercania, conversione, simplicidad", "personality": "proximidad"},
    "educacion": {"audience": "academias y centros de formacion",
                  "values": "aprendizaje, confianza,inclusion", "personality": "proximidad"},
    "hosteleria": {"audience": "restaurantes, hoteles y cafes con clientela local",
                   "values": "oficio, hospitalidad, tradicion", "personality": "elegancia"},
    "servicios": {"audience": "pymes y autonomos que buscan un socio externo",
                  "values": "cercania, rigor, resultados", "personality": "autoridad"},
    "agricultura": {"audience": "explotaciones y cooperativas agricolas",
                    "values": "raiz, oficio, temporada", "personality": "elegancia"},
    "industrial": {"audience": "plantas y empresas industriales",
                   "values": "precision, seguridad, continuidad", "personality": "autoridad"},
}
_CAMPOS_MARCA["educacion"]["values"] = "aprendizaje, confianza, inclusion"
_CAMPOS_MARCA["hosteleria"]["audience"] = "restaurantes, hoteles y cafes con publico local"
_CAMPOS_MARCA["servicios"]["audience"] = "pymes y autonomos que buscan un socio externo"


def campos_marca(ctx):
    """Rellena los campos del formulario con lo que la IA deduce del contexto."""
    base = dict(_CAMPOS_MARCA.get((ctx.get("sector") or "general").lower(),
                                 _CAMPOS_MARCA["general"]))
    if ctx.get("audience"):
        base["audience"] = ctx["audience"]
    if ctx.get("values"):
        base["values"] = ctx["values"]
    if ctx.get("personality"):
        base["personality"] = ctx["personality"]
    base["sector"] = ctx.get("sector") or "general"
    return base


def resumen_marca(ctx):
    """Una frase de posicionamiento para el campo de descripcion."""
    sector = (ctx.get("sector") or "general").lower()
    act = _pick(_sector_ctx(sector)["actores"], 0)
    aud = ctx.get("audience") or _CAMPOS_MARCA.get(sector, {}).get(
        "audience", "empresas que buscan resultados")
    return (f"Marca del sector {sector} dirigida a {aud}. "
            f"Se posiciona como {_pick(['la opción más fiable', 'la más sencilla', 'la más rápida'], 0)} "
            f"para {act}, con foco en {_pick(_sector_ctx(sector)['metricas'], 0)}.")

def _ll_brand(prompt, ctx):
    sector = ctx.get("sector", "general")
    mood = (ctx.get("personality") or "autoridad").lower()
    mood = mood if mood in MOODS else _pick(TONE_NAMES, len(sector))
    palette_name = _pick(list(PALETTES.keys()), len(sector) + len(mood))
    pal = PALETTES[palette_name]
    headline, body = _pick(FONT_PAIRS, len(sector))
    slogans = _sector_ctx(sector).get("canales", ["x"]) and SLOGANS.get(sector, ["Menos ruido, mas resultado"])
    slogan = _pick(slogans, len(mood))
    aud = ctx.get("audience") or "empresas decidas a mejorar sus resultados"
    vals = ctx.get("values") or "cercania, rigor, resultados"
    return (
        f"# Kit de Marca - {ctx.get('name') or 'Marca'}\n\n"
        f"**Sector:** {sector}  |  **Personalidad:** {mood}  |  **Audiencia:** {aud}\n\n"
        "## 1. Concepto de logotipo\n"
        f"Símbolo geometrico que combina una forma de {mood} con un elemento que evoque "
        f"{_pick(_sector_ctx(sector)['actores'], 1)}. Tipografia sans-serif personalizada, "
        "version con y sin isotipo, y area de proteccion igual al 15% del alto.\n\n"
        "## 2. Paleta de color\n"
        f"Estilo **{palette_name}**\n\n"
        "| Rol | Color | Uso |\n|---|---|---|\n"
        f"| Primario | `{pal[0]}` | Color de marca, titulos |\n"
        f"| Secundario | `{pal[1]}` | Acentos, enlaces |\n"
        f"| Acento | `{pal[2]}` | CTAs, highlights |\n"
        f"| Neutro claro | `{pal[3]}` | Fondos, superficies |\n"
        f"| Alerta | `{pal[4]}` | Errores y avisos |\n\n"
        f"**Contraste:** comprueba WCAG AA (4.5:1). El par `{pal[0]}` sobre `{pal[3]}` "
        f"supera el umbral en cuerpo de texto.\n\n"
        "## 3. Tipografia\n"
        f"- **Titulares:** {headline} (700/800)\n- **Cuerpo:** {body} (400/500)\n"
        f"- Escala 1.25 (1.25 / 1.56 / 1.95 / 2.44)\n\n"
        "## 4. Tono de voz\n"
        f"**{mood.title()}.** {MOODS[mood]}\n"
        f"- Si/no: affirmativo\n- Voz: activa\n- Trato: de usted a tu segun el canal\n\n"
        "## 5. Propuesta de valor\n"
        f"Para {aud}, {ctx.get('name') or 'la marca'} es la forma mas sencilla de "
        f"{_pick(['resolver', 'acelerar', 'ordenar', 'potenciar'], len(mood))} "
        f"sin ser un experto.\n\n"
        "## 6. Eslogan\n"
        f"**\"{slogan}\"**\n\n"
        "## 7. Valores y atributos\n"
        + "\n".join(f"- {v.strip().capitalize()}" for v in str(vals).split(",") if v.strip()) +
        "\n\n## 8. Aplicaciones\n"
        "- Web responsive, plantillas de correo, firma de correo.\n"
        "- Tarjetas, plantillas de propuesta y presupuesto.\n"
        "- Publicidad, redes sociales y packaging.\n"
    )


# ---------------------------------------------------------------- NOMBRES
PREFIX = {
    "tecnologia": ["Nova", "Nexo", "Bit", "Data", "Cloud", "Volt", "Pixel", "Quantum", "Flux", "Node"],
    "salud": ["Vita", "Medi", "Cura", "Vital", "Salu", "Bio", "Clara"],
    "legal": ["Lex", "Just", "Dura", "Lexis", "Praxis", "Firme"],
    "construccion": ["Obra", "Solida", "Piedra", "Nexo", "Estruc", "Base"],
    "ecommerce": ["Shop", "Tienda", "Cart", "Punto", "Vitrina", "Nego"],
    "educacion": ["Aula", "Saber", "Forma", "Dida", "Escuela", "Mente"],
    "hosteleria": ["Sabor", "Mesa", "Casa", "Cocina", "Truco", "Gastro"],
    "servicios": ["Alto", "Nexo", "Faro", "Clara", "Impulso", "Vector"],
    "agricultura": ["Campo", "Raiz", "Sembr", "Cosecha", "Prima"],
    "industrial": ["Acero", "Fase", "Motor", "Riel", "Engran"],
    "general": ["Alfa", "Nova", "Nexo", "Vive", "Onda", "Aura", "Lumen", "Orbe"],
}
SUFFIX = {
    "tecnologia": ["lab", "soft", "works", "systems", "tech", "hub", "io", "apps"],
    "salud": ["care", "health", "med", "clinic", "vital"],
    "legal": ["law", "legal", "advocates", "& partners"],
    "construccion": ["build", "construct", "group", "obra"],
    "ecommerce": ["shop", "store", "market", "outlet"],
    "educacion": ["academy", "school", "ed", "campus"],
    "hosteleria": ["kitchen", "table", "bar", "house"],
    "servicios": ["partners", "group", "advisory", "consulting"],
    "agricultura": ["agro", "farm", "campo", "rural"],
    "industrial": ["ind", "works", "industries", "pro"],
    "general": ["co", "studio", "group", "collective", "lab", "& co"],
}
DOMAINS = [".com", ".es", ".io", ".net", ".app", ".co"]


def _ll_names(prompt, ctx):
    sector = ctx.get("sector", "general").lower()
    sector = sector if sector in PREFIX else "general"
    pre, suf = PREFIX[sector], SUFFIX[sector]
    style = (ctx.get("style") or "mixto").lower()
    kw = (ctx.get("keywords") or "").strip()
    count = int(ctx.get("count") or 12)
    extra = kw.split()
    used = set()
    out = []
    for i in range(count):
        mode = i % 3
        if style == "compuesto":
            a, b = pre[i % len(pre)], suf[i % len(suf)]
        elif style == "evocativo":
            a, b = _pick(pre + SUFFIX.get("general", []), i), ""
        else:
            if mode == 0:
                a, b = pre[i % len(pre)], suf[i % len(suf)]
            elif mode == 1:
                a, b = (extra[i % len(extra)] if extra else pre[i % len(pre)]), _pick(SUFFIX.get("general", ["co"]), i)
            else:
                a, b = _pick(SUFFIX.get("general", ["co"]), i).capitalize(), pre[i % len(pre)].lower()
        name = (a + b).strip().capitalize() if b else a.capitalize()
        if name.lower() in used:
            name += " " + _pick(SUFFIX.get("general", ["group"]), i)
        used.add(name.lower())
        base = name.lower().replace(" ", "").replace("&", "and")
        dom = f"{base}{_pick(DOMAINS, i)}"
        score = round(72 + ((i * 7) % 27), 1)
        meaning = (f"Raiz del sector ({sector}) + sufijo que aporta "
                   f"{'modernidad y mercado digital' if b in ('io','lab','soft','tech') else 'solidez y confianza'}.")
        rationale = (f"Evoca {', '.join(_sector_ctx(sector)['actores'][:2])} y memoriza por "
                     f"su {len(name)} caracteres. Easy de pronunciar y escribir.")
        out.append(f"### {name}\n"
                   f"- **Categoria:** marca comercial\n"
                   f"- **Significado:** {meaning}\n"
                   f"- **Por que funciona:** {rationale}\n"
                   f"- **Dominio sugerido:** `{dom}`\n"
                   f"- **Puntuacion:** {score}/100\n"
                   f"- **Disponibilidad:** Pendiente de verificar en el registro y el dominio.\n")
    return ("# Generador de Nombres\n\n"
            f"**Sector:** {ctx.get('sector', 'general')} | **Estilo:** {style} | "
            f"**Palabras clave:** {kw or '—'}\n\n" + "\n".join(out) +
            "\n> Para comprobar disponibilidad real de dominio, usa el campo de pago.\n")


# -------------------------------------------------------------- ANALIZADOR
def _ll_analyze(prompt, ctx):
    content = ctx.get("content") or prompt
    words = re.findall(r"[\w'\u00C0-\u00FF]+", content)
    n = len(words)
    sentences = [s for s in re.split(r"[.!?\n]+", content) if s.strip()]
    avg_len = round(sum(len(s.split()) for s in sentences) / len(sentences), 1) if sentences else 0
    readability = max(10, min(95, round(100 - (avg_len - 8) * 4.5)))
    q = content.count("?")
    hashtags = len(re.findall(r"#\w+", content))
    ctas = len(re.findall(r"(?i)\b(descubre|solicita|contacta|reserva|descarga|apuntate|mas info|llama)\b", content))
    links = len(re.findall(r"https?://\S+", content))
    numerics = len(re.findall(r"\b\d+([.,]\d+)?\s*(%|eur|€|euros|clientes|anos|meses)\b", content, re.I))

    dim = {
        "Claridad": min(100, readability),
        "Estructura": min(100, 45 + len(sentences) * 4 + (10 if "\n" in content else 0)),
        "Persuasión": min(100, 30 + ctas * 14 + numerics * 8 + q * 6),
        "Datos y credibilidad": min(100, 25 + numerics * 15 + (20 if "http" in content else 0)),
        "Llamada a la accion": min(100, 20 + ctas * 22 + (15 if q else 0)),
        "Adaptabilidad a redes": min(100, 30 + hashtags * 6 + (25 if n < 280 else 8) + links * 5),
    }
    score = int(sum(dim.values()) / len(dim))
    top = sorted(dim.items(), key=lambda x: x[1])
    sector = ctx.get("sector", "general")
    sc = _sector_ctx(sector)
    return (
        "# Informe de Analisis\n\n"
        f"**Extension:** {n} palabras | {len(sentences)} frases | {avg_len} palabras/frase\n"
        f"**Interrogaciones:** {q} | **Hashtags:** {hashtags} | **Enlaces:** {links} | **Cifras:** {numerics}\n\n"
        f"## Puntuacion global: **{score}/100**\n\n"
        "## Desglose por dimension\n\n| Dimension | Puntuacion | Lectura |\n|---|---|---|\n"
        + "\n".join(f"| {k} | {v}/100 | {'Excelente' if v >= 80 else 'Bien' if v >= 65 else 'Mejorable' if v >= 45 else 'Debil'} |"
                    for k, v in dim.items()) +
        f"\n\n## Debilidades detectadas\n"
        + "\n".join(f"- **{k}** ({v}/100): " +
                    {"Claridad": "frases largas; divide ideas y usa puntos y vinetas.",
                     "Estructura": "falta jerarquia visual; añade titulos y separaciones.",
                     "Persuasión": "pocas llamadas a la acción; refuerza el cierre.",
                     "Datos y credibilidad": "sin pruebas; anade cifras, casos o fuentes.",
                     "Llamada a la accion": "no es claro qué hacer después; usa un verbo único.",
                     "Adaptabilidad a redes": "no optimizado; acorta y anade hashtags relevantes."}[k]
                    for k, v in top[:3]) +
        "\n\n## Recomendaciones\n"
        "1. Abre con el beneficio en la primera frase (no con el producto).\n"
        f"2. Sustituye afirmaciones por pruebas: en {sector} funcionan {', '.join(sc['metricas'][:2])}.\n"
        "3. Una sola llamada a la acción, repetida al inicio, mitad y cierre.\n"
        "4. Reduce un 20% el texto y comprueba el contraste AA.\n"
        "5. Adapta por canal: correo (corto), web (estructurado), social (visual).\n\n"
        "## Variantes sugeridas\n"
        f"- **Titular 1:** {sector.capitalize()} sin ser un experto\n"
        f"- **Titular 2:** 3 {sc['metricas'][0]} que {sector} ya domina\n"
        f"- **Titular 3:** Tu negocio, tus numeros, en una sola vista\n\n"
        "## Veredicto\n"
        + ("Listo para publicar. Solo ajusta detalles de estilo." if score >= 75 else
           "Base solida; aplica las 3 recomendaciones de mayor peso." if score >= 55 else
           "Requiere reescritura. Empieza por el titular y la llamada a la accion.")
    )


# -------------------------------------------------------------------- GEO
ZONAS = {
    "madrid": (40.4168, -3.7038), "barcelona": (41.3874, 2.1686),
    "valencia": (39.4699, -0.3763), "sevilla": (37.3891, -5.9845),
    "zaragoza": (41.6488, -0.8891), "malaga": (36.7213, -4.4214),
    "bilbao": (43.2630, -2.9350), "alicante": (38.3452, -0.4810),
}
TIPOS = {
    "tecnologia": ["Consultoria IT", "Agencia de desarrollo", "SaaS B2B", "Empresa de software",
                  "Proveedor de cloud", "Consultor de datos"],
    "salud": ["Clinica privada", "Consultorio dental", "Laboratorio de analisis", "Centro de fisioterapia",
              "Nutricion clinica", "Residencia"],
    "legal": ["Despacho de abogados", "Asesoria fiscal", "Gestoria", "Oficina de compliance"],
    "construccion": ["Constructora", "Promotora inmobiliaria", "Arquitecto", "Empresa de reformas",
                     "Ingenieria de obra civil"],
    "ecommerce": ["Tienda online", "Marketplace", "Agencia Shopify", "Distribuidor multicanal"],
    "hosteleria": ["Restaurante", "Hotel boutique", "Catering", "Bar de copas", "Cafeteria"],
    "educacion": ["Academia", "Centro de formacion", "Escuela de negocios", "Instituto"],
    "servicios": ["Asesoria", "Consultora", "Agencia de marketing", "Gestion administrativa"],
    "agricultura": ["Cooperativa agricola", "Explotacion agricola", "Industria agroalimentaria"],
    "industrial": ["Planta industrial", "Mantenimiento industrial", "Distribuidor tecnico"],
}
GENERIC = ["Empresa de servicios", "Negocio local", "Comercio", "Profesional independiente"]


def _texto_geo_real(loc, sector, radius, reales, lat, lon):
    """Informe para datos reales. A diferencia del de muestra, aqui los nombres
    y direcciones existen de verdad y lo que falta es el contacto."""
    sc = _sector_ctx(sector)
    tipos = {}
    for r in reales:
        tipos[r["business_type"]] = tipos.get(r["business_type"], 0) + 1
    top = sorted(tipos.items(), key=lambda kv: -kv[1])[:5]
    filas = "\n".join("| %s | %d |" % (k, v) for k, v in top)
    nearby = min(r["distance"] for r in reales)
    lejos = max(r["distance"] for r in reales)
    return f"""# Lectura del mercado: {loc}

**Sector:** {sector} · **Radio:** {radius} km · **Resultados:** {len(reales)}
**Fuente:** OpenStreetMap (nombres y ubicaciones reales)

## Que hay en la zona

Estos {len(reales)} negocios existen de verdad: el nombre y la direccion estan
verificados en OpenStreetMap. El mas cercano esta a **{nearby:.1f} km** y el mas
lejano a **{lejos:.1f} km**.

| Tipo de actividad | Cuántos |
|---|---|
{filas}

## Que tienen y que les falta

Lo que **si** tienes de cada uno: nombre, tipo de actividad, direccion exacta y
coordenadas precisas en el mapa.

Lo que **no** tienes, y hay que completar antes de escribirles:

- **Telefono y correo.** OpenStreetMap es un mapa, no una guia comercial: no los
  publica. Hay que buscarlos en la web del negocio o en un directorio.
- **Web propia.** Solo aparece si el negocio la ha declarado en el mapa.
- **Punto de contacto.** No se sabe quien decide ni cuando cambia de proveedor.

## Orden de trabajo recomendado

1. **Verificar primero** los {min(5, len(reales))} mas cercanos: son los que
   vas a poder visitar en una misma mañana.
2. **Buscar el telefono** de esos, uno a uno. Es el trabajo de verdad.
3. **Anotarlos como cliente** en el modulo Clientes para no perderlos.
4. **No mandar correos en frío**: sin telefono no hay conversacion.

## Aviso importante

Estos datos son **reales** pero ** incompletos**: viene de una base colaborativa
de mapas. Un negocio puede haber cerrado, cambiado de nombre o de actividad.
Confirma siempre antes de desplazarte o de escribir. Metros que decide la venta:
{_pick(sc["metricas"], 0)} y {_pick(sc["metricas"], 1)}."""


def _ll_geo(prompt, ctx):
    loc = (ctx.get("location") or "Madrid").strip()
    sector = (ctx.get("sector") or "general").lower()
    tipos = TIPOS.get(sector, GENERIC)
    radius = int(ctx.get("radius") or 10)
    n = int(ctx.get("limit") or 20)
    ftype = (ctx.get("business_type") or "").strip()
    btype = ftype if ftype in tipos else tipos[0]

    # Primero, datos REALES de OpenStreetMap. Los de muestra quedan como
    # respaldo, pero avisando: un negocio inventado con un telefono inventado es
    # peor que no tener nada, porque se acaba llamando.
    motivo = ""
    if (ctx.get("origin") or "real").lower() != "muestra":
        try:
            from . import osm
            reales, clat, clon = osm.buscar_reales(loc, sector, radius, n, ftype)
        except Exception as e:
            from . import osm as _osm
            reales, motivo = [], _osm.motivo_amigable(e)
        if reales:
            if len(reales) < min(n, 5):
                aviso = ("Solo se han encontrado **%d** negocios reales de este sector en "
                         "un radio de %d km. OpenStreetMap es un mapa, no una guia "
                         "comercial: los negocios que no estan en el no aparecen. Prueba "
                         "con otro sector o con la opcion **Muestra del Motor IA** para "
                         "planificar." % (len(reales), radius))
            else:
                aviso = ""
            return {
                "location": loc, "radius": radius, "sector": sector,
                "center": {"lat": clat, "lon": clon},
                "results": reales, "total": len(reales),
                "real": True, "fuente": "OpenStreetMap", "aviso": aviso,
                "analysis": _texto_geo_real(loc, sector, radius, reales, clat, clon),
            }
        motivo = motivo or ("no hay negocios reales de '%s' catalogados en OpenStreetMap "
                            "cerca de '%s'" % (sector, loc))

    key = next((k for k in ZONAS if k in loc.lower()), "general")
    base = ZONAS.get(key, ZONAS["madrid"])
    lat, lon = base
    # Aunque no haya negocios reales, el mapa tiene que estar en la localidad
    # escrita. Antes se caia a la tabla de 8 ciudades y Novelda salia en
    # Madrid. La geolocalizacion es lo mismo que ya se usa para los datos
    # reales, asi que no cuesta nada mas.
    try:
        from . import osm
        lat, lon, _nombre = osm.geocodificar(loc)
    except Exception:
        pass
    needs = {"Digitalizacion y automatizacion", "Presupuestos profesionales", "Marketing y captacion",
             "Analisis y diagnostico", "Formacion del equipo"}
    fails = ["presupuestos lentos", "seguimiento manual", "datos dispersos", "sin medicion",
             "dependencia de personas clave"]
    results = []
    streets = ["de la constitution", "mayor", "del mercado", "de la Paz", "real", "de espana",
               "de cataluna", "del norte", "de san juan", "de la libertad"]
    for i in range(n):
        name = f"{btype} {['S.L.', 'S.A.', 'Grupo', '& Asociados', 'Solutions', 'Studio'][i % 6]} {i+1}"
        ang = (i * 137.5) % 360
        import math
        dlat = (radius / 111.0) * math.sin(math.radians(ang)) * 0.85
        dlon = (radius / (111.0 * math.cos(math.radians(lat)) or 1)) * math.cos(math.radians(ang)) * 0.85
        score = round(max(35.0, min(98.0, 88 - (i * 2.3) + (i % 4) * 3.1)), 1)
        results.append({
            "id": i + 1,
            "name": name,
            "business_type": btype,
            "address": f"Calle {_pick(streets, i).title()}, {i*7+3}, {loc}",
            "lat": round(lat + dlat, 6), "lon": round(lon + dlon, 6),
            "distance": round(abs(radius / 2 * math.sin(math.radians(ang))), 2),
            "phone": f"+34 6{i:02d} {i*13+10:02d} {i*77+20:02d}",
            "email": f"contacto@{name.split()[0].lower()}-{i+1}.es",
            "website": f"www.{name.split()[0].lower()}{i+1}.es",
            "score": score,
            "pain": _pick(fails, i),
            "size": ["1-10", "11-50", "51-200", "10-500"][i % 4],
        })
    return {
        "location": loc, "radius": radius, "sector": sector, "center": {"lat": lat, "lon": lon},
        "results": results, "total": len(results),
        "real": False, "fuente": "Muestra del Motor IA Local",
        "aviso": ("**Estos NO son negocios reales.** Son inventados para planificar, "
                  "con telefonos y correos tambien falsos: no los llames. Motivo: %s. "
                  "Si tenes conexion, revisa la conexion y prueba otro sector." % motivo),
        "analysis": (
            f"# Mapa Localizador de Clientes - {loc}\n\n"
            f"**Radio:** {radius} km | **Sector:** {sector} | **Resultados:** {len(results)}\n\n"
            "## Lectura del mercado\n"
            f"Con un radio de {radius} km alrededor de {loc} el sector {sector} muestra una "
            f"densidad alta de {_pick(_sector_ctx(sector)['actores'], 0)} y "
            f"{_pick(_sector_ctx(sector)['actores'], 1)}. Los negocios con menos de 50 empleados "
            "son el objetivo optimo: tienen presupuesto y decisor accesible.\n\n"
            "## Deteccion de oportunidades\n"
            "- Los 10 primeros resultados concentran la mayor necesidad no cubierta.\n"
            f"- Dolor dominante detectado: **{_pick(fails, 0)}**.\n"
            "- Valor por cliente estimado segun tamano medio.\n\n"
            "## Secuencia de contacto sugerida\n"
            "1. Dia 1-2 - Llamada de descubrimiento (5 min).\n"
            "2. Dia 3-5 - Email con caso de exito del sector.\n"
            "3. Dia 6-9 - Visita de 20 min con mini-diagnostico gratuito.\n"
            "4. Dia 10 - Propuesta rapida de 1 pagina.\n\n"
            "## Aviso\n"
            "_Datos de muestra generados por el Motor IA Local para planificacion. "
            "Verifica siempre antes de contactar._"
        ),
    }


# ------------------------------------------------------------ PROSPECTORES
PAINS = ["el seguimiento manual", "los presupuestos lentos", "la dispersion de datos",
         "la falta de visibilidad", "los procesos repetitivos", "el churn de clientes",
         "la captacion impredecible", "el trabajo duplicado"]




def _ll_geo_analysis(prompt, ctx):
    """Informe de mercado en Markdown. Devuelve solo texto (nunca un dict)."""
    sector = (ctx.get("sector") or "general").lower()
    ubic = ctx.get("location") or "la zona"
    radius = ctx.get("radius") or 10
    sc = _sector_ctx(sector)
    tipos = TIPOS.get(sector, GENERIC)[:4]

    return f"""# Lectura del mercado: {ubic}

**Sector:** {sector} · **Radio:** {radius} km

## Densidad de oportunidades

Con un radio de {radius} km alrededor de {ubic} el sector {sector} concentra
negocios de {_pick(tipos, 0).lower()}, {_pick(tipos, 1).lower()} y
{_pick(tipos, 2).lower()}. El perfil mas rentable es el de **10 a 50 empleados**:
tiene presupuesto suficiente y decide el mismo dueño, sin comites.

## Tipos de negocio objetivo

| Tipo | Por que interesa |
|---|---|
{chr(10).join(f"| {_pick(tipos, i)} | {motivo} |" for i, motivo in enumerate([
    "Ticket medio alto y decision rapida",
    "Margen ajustado por costes, cabe la propuesta",
    "Necesita ordenar procesos internos",
    "Crece y todavia no tiene equipo de sistemas"], 4))}

## Senales que deberian buscar

- **No tienen web o la tienen parada** → necesitan presencia digital.
- **Cuentas en redes sociales sin actividad desde hace meses** → presupuesto
  libertad y competitor directo.
- **No responden a reseñas** → marca sin community manager.
- **Cobran en efectivo o sin TPV** → gestion digitalizada pendiente.

## Metrica que decide la venta

Medir antes de proponer: {_pick(sc["metricas"], 0)} y {_pick(sc["metricas"], 1)}.
Si el negocio no mide esas dos variables, la primera propuesta no debe ser
tecnica: debe ser un panel que las mida.

## Secuencia de contacto sugerida

1. **Dia 1-2** — Llamada de descubrimiento de 3 minutos. Objetivo: saber quien decide.
2. **Dia 3-5** — Email con un caso del sector, no con tu catalogo.
3. **Dia 6-9** — Visita de 20 minutos con mini-diagnostico gratuito.
4. **Dia 10** — Propuesta de una pagina, con precio cerrado.
5. **Dia 21** — Seguimiento con fecha concreta, no con "te escribo".

## Aviso importante

Estos datos son de muestra, generados para **planificar**, no para contactar.
Verifica siempre telefono, email y web antes de escribir: un contacto erroneo
quema la relacion en el primer envio."""

def _ll_geo_detail(prompt, ctx):
    """Que tienen y que les falta a los resultados de prospeccion."""
    res = ctx.get("resultados") or []
    if not res:
        return "# Sin resultados\n\nSelecciona al menos un resultado del mapa."
    scores = [float(r.get("score") or 0) for r in res]
    tipos, pains, sizes = {}, {}, {}
    for r in res:
        tipos[r.get("business_type") or "sin tipo"] = tipos.get(r.get("business_type") or "sin tipo", 0) + 1
        pains[r.get("pain") or "sin senal"] = pains.get(r.get("pain") or "sin senal", 0) + 1
        sizes[r.get("size") or "sin dato"] = sizes.get(r.get("size") or "sin dato", 0) + 1
    media = sum(scores) / len(scores) if scores else 0
    top = max(res, key=lambda r: float(r.get("score") or 0))
    weak = min(res, key=lambda r: float(r.get("score") or 0))
    ubic = ctx.get("localidad") or "la zona"

    def mas(d, n=3):
        return ", ".join(f"{k} ({v})" for k, v in sorted(d.items(), key=lambda x: -x[1])[:n]) or "sin datos"

    return f"""# Analisis de los resultados seleccionados

Se han analizado **{len(res)}** resultados de **{ubic}**.

| Indicador | Valor |
|---|---|
| Puntuacion media | **{media:.0f} / 100** |
| Puntuacion mas alta | {float(top.get('score') or 0):.0f} — {top.get('name')} |
| Puntuacion mas baja | {float(weak.get('score') or 0):.0f} — {weak.get('name')} |
| Tipos de negocio | {mas(tipos)} |
| Tamano medio | {mas(sizes)} |
| Problemas detectados | {mas(pains)} |

## Que tienen estos resultados

- **Datos de contacto completos**: {sum(1 for r in res if r.get('phone'))} de {len(res)} tienen telefono
  y {sum(1 for r in res if r.get('email'))} tienen email.
- **Ubicacion verificable**: todos estan dentro del radio buscado, con coordenadas.
- **Perfil de negocio identificado**: tipo de actividad y tamano aproximado de plantilla.
- **Senal de dolor concreta**: cada resultado tiene un problema tipico asignado.

## Que les falta

1. **Conocimiento del decisor.** No consta quien decide ni con que presupuesto:
   esto es lo primero que hay que averiguar en la primera llamada.
2. **Estado digital.** No sabemos si tienen web, si la actualizan ni si responden a un formulario.
   Sin web, la oportunidad de venta es mucho mayor.
3. **Historial comercial.** No hay datos de si ya trabajan con un competidor
   ni de cuando se renovo su proveedor actual.
4. **Valorificacion economica.** Falta estimar cuanto factura cada negocio para
   saber cuanto presupuesto pueden asumir.
5. **Canal de contacto valido.** Correos y telefonos generados por patron: hay que
   verificarlos antes de escribir, o se pierde credibilidad.

## Por donde empezar

1. **Empieza por los de mayor puntuacion** ({top.get('name')}, {float(top.get('score') or 0):.0f}/100):
   concentra aqui el 60% del esfuerzo inicial.
2. **Descarta o aparca los mas debiles** ({weak.get('name')}, {float(weak.get('score') or 0):.0f}/100):
   no gastes tiempo en ellos hasta tener señales nuevas.
3. **Verifica contactos antes de contactar.** Un email que no existe quema la
   relacion en el primer envio.
4. **Prepara una propuesta de valor por tipo de negocio.** {_pick(list(tipos)[:1], 0) or 'cada segmento'}
   necesita un mensaje propio, no uno generico.
5. **Mide por semanas:** contactos realizados, respuestas y reuniones. Sin ese
   dato no sabes si el metodo funciona.

## Siguiente paso recomendado

Haz una **llamada de descubrimiento de 3 minutos** a los tres resultados con mayor
puntuacion. El objetivo no es vender: es averiguar presupuesto, decisor y plazo.
Con esos tres datos, el resto de la estrategia se decide sola."""

def _ll_prospects(prompt, ctx):
    sector = (ctx.get("sector") or "general").lower()
    sc = _sector_ctx(sector)
    loc = ctx.get("location") or "Madrid"
    n = int(ctx.get("limit") or 15)
    roles = ["Director/a General", "Gerente Comercial", "Responsable de Marketing",
             "Director/a de Operaciones", "Responsable de Sistemas", "Dueño/a"]
    names = ["Garcia Lopez", "Martinez Sanchez", "Rodriguez Perez", "Fernandez Lopez",
             "Gomez Ruiz", "Diaz Moreno", "Sanchez Navarro", "Ramirez Torres",
             "Vazquez Ortiz", "Jimenez Molina", "Morales Cruz", "Castillo Rojas"]
    cnames = ["Grupo Avant", "Nova Soluciones", "Almendro Servicios", "Delta Consulting",
              "Cibeles Tech", "Aurora Gestion", "Roble & Asociados", "Meridiano Global",
              "Aranda & Co", "Lumen Business", "Sierra Tech", "Quimera Lab"]
    out = []
    for i in range(n):
        who = _pick(names, i)
        comp = _pick(cnames, i + 3)
        fit = round(max(40.0, min(97.0, 92 - (i * 2.6) + (i % 3) * 2.4)), 1)
        out.append(
            f"{i+1}. **{comp}** - {who}, {_pick(roles, i)}\n"
            f"   - Sector: {sector} | Ubicacion: {loc} | Tamano: {['1-10','11-50','51-200'][i%3]} empleados\n"
            f"   - Puntuacion de ajuste: **{fit}/100**\n"
            f"   - Señal detectada: {_pick(sc['metricas'], i)}\n"
            f"   - Canal recomendado: {_pick(sc['canales'], i)}\n"
            f"   - Pitch de 15 s: \"{comp}, sois {_pick(['3-8', '10-25', '25-100'], i % 3)} empresas de {sector} en {loc} "
            f"que ya han resuelto {_pick(PAINS, i)}. "
            f"Mismo reto, menos horas.\"\n"
            f"   - Objetivo: decision de reunion en 10 dias"
        )
    return (
        f"# Prospectores IA - {sector} en {loc}\n\n"
        f"**Prospectos generados:** {n}\n\n"
        "## Lista de prospectos\n\n" + "\n".join(out) +
        "\n\n## Criterio de segmentacion aplicado\n"
        f"- **ICP:** {_pick(sc['actores'], 0)} de 1 a 200 empleados en {loc}.\n"
        f"- **Disparador:** {_pick(sc['metricas'], 0)} es su activo comercial principal.\n"
        f"- **Objecion habitual:** \"ya tenemos proveedor\" -> responder con diagnostico gratuito.\n"
        f"- **Presupuesto medio:** segun {_pick(sc['metricas'], 1)}.\n\n"
        "## Secuencia multicanal (21 dias)\n"
        "| Dia | Canal | Accion |\n|---|---|---|\n"
        "| 1 | LinkedIn | Conexion con nota personalizada |\n"
        "| 3 | Email | Presentacion de 50 palabras |\n"
        "| 7 | Llamada | Descubrimiento de 5 min |\n"
        "| 12 | Contenido | Caso de exito del sector |\n"
        "| 16 | Email | Propuesta de mini-diagnostico |\n"
        "| 21 | Cierre | Seguimiento con fecha concreta |\n\n"
        "## Metricas objetivo\n"
        "- Respuesta: >20% | Reuniones: >8% | Cierre: >15%\n\n"
        "> Prospectos de muestra del Motor IA Local. Conecta un proveedor de IA o "
        "enriquece con datos reales para produccion."
    )


# ------------------------------------------------------------- CAMPAÑAS
def _ll_campaign(prompt, ctx):
    sector = ctx.get("sector", "general")
    sc = _sector_ctx(sector)
    obj = ctx.get("objective") or "aumentar la captacion"
    ch = ctx.get("channel") or "multicanal"
    budget = float(ctx.get("budget") or 0)
    copy = (
        f"Asi funciona el nuevo {sector}:\n\n"
        f"- Reduce {_pick(sc['metricas'], 0)} sin cambiar de equipo.\n"
        f"- Se integra con lo que ya usas.\n"
        f"- Decision clara en {_pick(['48 horas', 'una semana', '30 dias'], int(budget) % 3)}.\n\n"
        f"Solicita una demostracion gratuita y comparamos tu {_pick(sc['metricas'], 1)} "
        f"de hoy con el de manana.\n\n"
        f"— {ctx.get('company') or 'Equipo comercial'}"
    )
    return {
        "strategy": (
            f"# Estrategia de campana - {ctx.get('name', 'Campana')}\n\n"
            f"**Objetivo:** {obj}\n**Sector:** {sector} | **Canal principal:** {ch} | "
            f"**Presupuesto:** {budget:.0f} EUR\n\n"
            "## Diagnostico\n"
            f"El sector {sector} mide su exito por {', '.join(sc['metricas'])}. "
            f"La campana debe hablar de esas metricas, no de funcionalidades.\n\n"
            "## publico objetivo\n"
            f"- Primario: {_pick(sc['actores'], 0)} de 10 a 200 empleados.\n"
            f"- Secundario: {_pick(sc['actores'], 1)} con presupuesto asignado.\n"
            f"- Excluir: empresas sin decisor identificado.\n\n"
            "## Pilares de mensaje\n"
            f"1. **Problema** - {_pick(sc['metricas'], 0)} se degrada sin control.\n"
            f"2. **Prueba** - Caso real de {sector} con numeros.\n"
            f"3. **Oferta** - Diagnostico gratuito de 20 minutos.\n"
            f"4. **Urgencia** - Plazo de respuesta del cierre.\n\n"
            "## Distribucion del presupuesto\n"
            f"- Captacion (paid + SEO): {budget*0.45:.0f} EUR\n"
            f"- Contenido y materiales: {budget*0.20:.0f} EUR\n"
            f"- Eventos y relaciones: {budget*0.20:.0f} EUR\n"
            f"- Medicion y herramientas: {budget*0.15:.0f} EUR\n\n"
            "## KPIs y objetivo\n"
            f"- {sc['metricas'][0].capitalize()}: +20% en 90 dias\n"
            "- Coste por lead: < 15% del valor del contrato\n"
            "- Conversion lead->cliente: 12%\n\n"
            "## Canales secundarios\n" + "\n".join(f"- {c}" for c in sc["canales"]) +
            "\n\n## Experimentos A/B\n"
            "- Titular beneficio vs. caracteristica.\n"
            "- CTA 'Reserva demo' vs. 'Descarga guia'.\n"
            "- Una landings por segmento, no una communa."
        ),
        "copy": (
            f"# Copy listo para publicar\n\n"
            f"## Email de campaña ({ctx.get('name', 'Campana')})\n\n"
            f"**Asunto:** {sector.capitalize()}: {sc['metricas'][0]} en 30 dias\n\n"
            f"{copy}\n\n"
            "## Publicacion LinkedIn\n\n"
            f"Hemos analizado 40 empresas de {sector} en {ctx.get('city') or 'tu ciudad'}.\n\n"
            f"El patron se repite: quien mide bien su {sc['metricas'][0]} crece un 20% mas.\n\n"
            f"{copy.split(chr(10))[2] if len(copy.split(chr(10))) > 2 else ''}\n\n"
            f"# {sector.capitalize()} #Ventas #TransformacionDigital\n\n"
            "## Guion de llamada (60 s)\n\n"
            f"- Apertura: \"Te robo 30 segundos: ayudamos a empresas de {sector} a "
            f"mejorar su {sc['metricas'][0]}.\"\n"
            f"- Descubrimiento: \"Como mides hoy tu {sc['metricas'][0]}?\"\n"
            f"- Prueba: \"El ano pasado un cliente de {sector} redujo su "
            f"{sc['metricas'][1]} un 31%.\"\n"
            f"- Cierre: \"Te mando un mini-diagnostico y lo miras sin compromiso.\"\n\n"
            "## SMS / WhatsApp\n\n"
            f"Hola {{nombre}}, soy de {{empresa}}. Ayudamos a {{empresa}} de {sector} a "
            f"mejorar su {sc['metricas'][0]}. 2 min? Responde SI y te llamo."
        ),
        "schedule": (
            f"# Calendario editorial - 4 semanas\n\n"
            "## Semana 1 - Awareness\n"
            "| Dia | Pieza | Canal |\n|---|---|---|\n"
            "| Lun | Post de problema | LinkedIn |\n"
            "| Mie | Articulo de blog | Web |\n"
            "| Vie | Email 1 (problema) | Email |\n\n"
            "## Semana 2 - Educacion\n"
            "| Dia | Pieza | Canal |\n|---|---|---|\n"
            "| Lun | Infografia de datos | LinkedIn |\n"
            "| Mie | Video 60 s | Web/YouTube |\n"
            "| Vie | Email 2 (prueba) | Email |\n\n"
            "## Semana 3 - Consideracion\n"
            "| Dia | Pieza | Canal |\n|---|---|---|\n"
            "| Lun | Caso de cliente | LinkedIn |\n"
            "| Mie | Webinar gratuito | Online |\n"
            "| Vie | Email 3 (oferta) | Email |\n\n"
            "## Semana 4 - Conversion\n"
            "| Dia | Pieza | Canal |\n|---|---|---|\n"
            "| Lun | Churn-saver / oferta | Email |\n"
            "| Mie | Llamadas de cierre | Telefono |\n"
            "| Vie | Email 4 (urgencia) | Email |"
        ),
    }


# --------------------------------------------------------------- CLIENTES
def _ll_client(prompt, ctx):
    sector = ctx.get("sector", "general")
    sc = _sector_ctx(sector)
    val = float(ctx.get("value") or 0)
    if not val:
        val = {"1-10": 6000, "11-50": 25000, "51-200": 90000, "10-500": 300000}.get(ctx.get("size", ""), 18000)
    fit = 78 if sector in sc else 70
    return (
        f"# Analisis de Cliente - {ctx.get('name', 'Cliente')}\n\n"
        f"**Sector:** {sector} | **Valor estimado anual:** {val:,.0f} EUR\n\n"
        "## Puntuacion de ajuste (ICP)\n"
        f"- **Encaje sectorial:** {fit}/100\n"
        f"- **Potencial de crecimiento:** {min(95, fit + 6)}/100\n"
        f"- **Facilidad de decision:** {max(50, fit - 8)}/100\n"
        f"- **Riesgo de churn:** {max(20, 100 - fit - 4)}/100\n"
        f"- **Global:** **{int((fit + fit+6 + max(50,fit-8) + max(20,100-fit-4)) / 4)}/100**\n\n"
        "## Segmentacion\n"
        f"- **Arquetipo:** {_pick(['constructor', 'optimizador', 'explorador', 'guardian'], int(val) % 4)}\n"
        f"- **Madurez digital:** {'alta' if fit > 78 else 'media' if fit > 68 else 'baja'}\n"
        f"- **Ciclo de compra estimado:** {'45-90 dias' if val > 50000 else '15-45 dias'}\n\n"
        "## Necesidades principales\n"
        + "\n".join(f"- {_pick(sc['metricas'], i)}:_objivo medible." for i in range(3)) +
        "\n\n## objections habituales\n"
        "- \"Es caro\" -> ROI en menos de 3 meses con el calculadora de valor.\n"
        "- \"Ahora no es buen momento\" -> oferta de pago por fases.\n"
        "- \"Ya tengo proveedor\" -> auditoria comparativa gratuita.\n\n"
        "## Siguiente accion\n"
        f"1. Enviar email de descubrimiento mencionando {sc['metricas'][0]}.\n"
        "2. Agendar llamada de 15 min esta semana.\n"
        "3. Preparar mini-diagnostico antes de la reunion.\n\n"
        "## Valor esperado\n"
        f"- Contrato inicial estimado: {val*0.35:,.0f} EUR\n"
        f"- Expansion a 24 meses: {val*1.8:,.0f} EUR"
    )


# ---------------------------------------------------------------- PROGRAMA
def generate_program(params):
    """Genera un programa personalizado completo a partir de los parametros del formulario."""
    tipo = params.get("type", "web")
    objective = params.get("objective", "")
    sector = params.get("sector", "general")
    features = [f.strip() for f in re.split(r"[,\n]", params.get("features", "")) if f.strip()]
    lang = params.get("language", "Python")
    budget = params.get("budget", "medio")
    deploy = params.get("deployment", "local")
    name = params.get("name", "MiPrograma").strip() or "MiPrograma"
    stack_map = {
        "Python": "Python 3.12 (Estandar) + SQLite",
        "JavaScript": "JavaScript ES2023 (Node 18+)",
        "TypeScript": "TypeScript 5 (Node 18+) + React",
        "PHP": "PHP 8.2 + MySQL/MariaDB",
        "Java": "Java 17 + Spring Boot",
        "C#": "C# .NET 8",
        "Sin codigo": "Sin codigo - flujo documentado paso a paso",
    }
    stack = stack_map.get(lang, lang)
    sc = _sector_ctx(sector)

    feats = features or [
        f"Panel de control de {sector}",
        "Gestion de registros con busqueda y filtros",
        "Exportacion de datos",
        "Sistema de roles y permisos",
    ]
    modules = []
    for i, f in enumerate(feats[:8]):
        modules.append({
            "n": i + 1,
            "name": f,
            "desc": f"Modulo **{f}**. Entrada, validacion, persistencia y listado con busqueda.",
            "effort": f"{(i+1)*3} h",
        })
    total_h = sum(int(m["effort"].split()[0]) for m in modules) or 12

    readme = f"""# {name}

Generado automaticamente por **IASolges**.

- **Sector:** {sector}
- **Objetivo:** {objective or 'Automatizar un proceso de negocio'}
- **Stack:** {stack}
- **Despliegue:** {deploy}
- **Presupuesto de esfuerzo:** {budget}

## Como ejecutar

```
{_run_cmd(lang, name)}
```

## Modulos

""" + "\n".join(f"{i}. **{m['name']}** - {m['desc']}" for i, m in enumerate(modules, 1)) + f"""

## Metricas de exito

- {sc['metricas'][0].capitalize()}: objetivo a definir en la reunion de kickoff
- Tiempo de operacion por registro: < 2 minutos
- Errores de entrada: < 1%

## Roadmap

| Fase | Duracion | Entregable |
|---|---|---|
| 1 | 25% | Analisis y diseno de datos |
| 2 | 45% | Desarrollo de modulos |
| 3 | 20% | Pruebas y despliegue |
| 4 | 10% | Formacion y handover |
"""

    code = _program_code(lang, name, feats, params)

    return f"""# Programa generado: {name}

**Motor:** IASolges
**Tipo:** {tipo} | **Sector:** {sector} | **Stack:** {stack}

## 1. Especificacion funcional

**Objetivo:** {objective or 'Automatizar el proceso de negocio indicado'}

### Modulos definidos ({len(modules)})

| # | Modulo | Esfuerzo | Descripcion |
|---|---|---|---|
""" + "\n".join(f"| {m['n']} | {m['name']} | {m['effort']} | {m['desc']} |" for m in modules) + f"""

**Esfuerzo total estimado:** {total_h} horas

## 2. Arquitectura

```
[Interfaz]  ->  [API / Logica]  ->  [Base de datos]
     ^                 |
     +--- [Reportes] <-+
```

- Capa de datos: SQLite (o el motor indicado)
- Capa de logica: {stack}
- Parametros del negocio: {len(params)} configurables desde la interfaz

## 3. Codigo inicial

```{lang.lower()}
{code}
```

## 4. Plan de pruebas

- [ ] Prueba funcional de cada modulo ({len(modules)} modulos)
- [ ] Prueba de validacion de datos de entrada
- [ ] Prueba de permisos y roles
- [ ] Prueba de carga con volumen representativo

## 5. Entregables

1. Codigo fuente documentado
2. Esquema de base de datos
3. Manual de usuario
4. Informe de pruebas

## 6. Estimacion economica

| Concepto | Horas | Importe |
|---|---|---|
| Analisis | {round(total_h*0.25)} | {round(total_h*0.25)*45:,.0f} EUR |
| Desarrollo | {round(total_h*0.45)} | {round(total_h*0.45)*45:,.0f} EUR |
| Pruebas | {round(total_h*0.20)} | {round(total_h*0.20)*45:,.0f} EUR |
| Formacion | {round(total_h*0.10)} | {round(total_h*0.10)*45:,.0f} EUR |
| **Total** | **{total_h}** | **{total_h*45:,.0f} EUR** |

---

### Ficheros del proyecto

```
{name}/
├── README.md
├── requirements.txt
├── src/
│   └── main.{_ext(lang)}
└── data/
    └── .gitkeep
```

---

Generado por IASolges - plataforma de IA para gestion comercial.
"""


def _ext(lang):
    return {"JavaScript": "js", "TypeScript": "ts", "Python": "py", "PHP": "php",
            "Java": "java", "C#": "cs"}.get(lang, "txt")


def _run_cmd(lang, name):
    if lang == "Python":
        return f"python3 -m venv .venv && source .venv/bin/activate\npip install -r requirements.txt\npython src/main.py"
    if lang in ("JavaScript", "TypeScript"):
        return "npm install\nnpm start"
    if lang == "PHP":
        return "php -S localhost:8000 -t public"
    return "#consultar documentacion del stack"


def _program_code(lang, name, feats, params):
    cls = "".join(w.capitalize() for w in re.findall(r"\w+", name)) or "App"
    if lang == "Python":
        return f'''"""Generado por IASolges - {name}"""
import sqlite3
from datetime import datetime

DB = "{name.lower().replace(" ", "_")}.db"
MODULOS = {feats!r}

class {cls}:
    """Nucleo de la aplicacion {name}."""

    def __init__(self, db=DB):
        self.conn = sqlite3.connect(db)
        self.conn.row_factory = sqlite3.Row
        self._init()

    def _init(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS registros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                modulo TEXT NOT NULL,
                datos TEXT NOT NULL,
                creado TEXT NOT NULL
            )""")
        self.conn.commit()

    def crear(self, modulo, datos):
        cur = self.conn.execute(
            "INSERT INTO registros(modulo,datos,creado) VALUES (?,?,?)",
            (modulo, str(datos), datetime.now().isoformat(timespec="seconds")))
        self.conn.commit()
        return cur.lastrowid

    def listar(self, modulo=None, limite=50):
        q = "SELECT * FROM registros"
        args = []
        if modulo:
            q += " WHERE modulo=?"
            args.append(modulo)
        q += " ORDER BY id DESC LIMIT ?"
        args.append(limite)
        return [dict(r) for r in self.conn.execute(q, args)]

    def resumen(self):
        total = self.conn.execute("SELECT COUNT(*) c FROM registros").fetchone()["c"]
        por = dict(self.conn.execute(
            "SELECT modulo, COUNT(*) c FROM registros GROUP BY modulo").fetchall())
        return {{"total": total, "por_modulo": por}}

if __name__ == "__main__":
    app = {cls}()
    print(f"Modulos: {{len(MODULOS)}} -> {{MODULOS}}")
    app.crear(MODULOS[0], {{"estado": "inicial"}})
    print("Resumen:", app.resumen())
'''
    if lang in ("JavaScript", "TypeScript"):
        return f'''// Generado por IASolges - {name}
import {{ createInterface }} from "node:readline";

const MODULOS = {json.dumps(feats, ensure_ascii=False)};

export class {cls} {{
  constructor() {{ this.registros = []; }}

  crear(modulo, datos) {{
    const r = {{ id: this.registros.length + 1, modulo, datos, creado: new Date().toISOString() }};
    this.registros.push(r);
    return r;
  }}

  listar(modulo) {{
    return modulo ? this.registros.filter(r => r.modulo === modulo) : this.registros;
  }}

  resumen() {{
    return {{
      total: this.registros.length,
      porModulo: MODULOS.map(m => ({{ modulo: m, n: this.listar(m).length }})),
    }};
  }}
}}

if (process.argv[1] === "demo") {{
  const app = new {cls}();
  app.crear(MODULOS[0], {{ estado: "inicial" }});
  console.log("Modulos:", MODULOS);
  console.log("Resumen:", app.resumen());
}}
'''
    tbl = name.lower().replace(" ", "_")
    return (f"-- Generado por IASolges - {name}\n"
            f"-- Modulos: {', '.join(feats)}\n\n"
            f"SELECT * FROM {tbl} LIMIT 10;")


# ------------------------------------------------------------ PRESUPUESTOS
def _ll_quote(prompt, ctx):
    items = ctx.get("items", [])
    client = ctx.get("client_name", "el cliente")
    total = sum(float(i.get("qty", 1)) * float(i.get("unit_price", 0)) for i in items)
    return (
        f"# Propuesta comercial - {ctx.get('title', 'Presupuesto')}\n\n"
        f"**Cliente:** {client}\n"
        f"**Conceptos:** {len(items)} | **Importe base:** {total:,.2f} {ctx.get('currency', 'EUR')}\n\n"
        "## Resumen ejecutivo\n"
        f"Proponemos a {client} un proyecto de {ctx.get('title', 'servicio integral')} "
        f"con {len(items)} lineas de trabajo. El alcance cubre {_pick(_sector_ctx(ctx.get('sector','servicios'))['actores'], 0)} "
        "y se entrega en fases milestones para reducir riesgo.\n\n"
        "## Por que nosotros\n"
        "1. Metodologia probada y entregables verificables.\n"
        "2. Equipo asignado con experiencia en el sector.\n"
        "3. Precio cerrado con control de cambios.\n\n"
        "## Alcance y exclusiones\n"
        "- **Incluido:** todo lo detallado en las lineas.\n"
        "- **Excluido:** licencias de terceros, desplazamientos fuera de "
        f"{ctx.get('city', 'la zona')} e integraciones no listadas.\n\n"
        "## Condiciones\n"
        f"- Validez: {ctx.get('valid_days', 30)} dias\n"
        f"- Forma de pago: 40% a la firma, 40% a la entrega intermedia, 20% a la entrega final.\n"
        "- Warranty de 30 dias sobre incidencias de desarrollo.\n\n"
        "## Siguiente paso\n"
        "Confirma la propuesta y agendamos la reunion de arranque en 48 horas."
    )


def build_program(params, db_path=None, use_remote=True):
    """Genera el programa. Con proveedor remoto enhance; si no, motor local."""
    if use_remote and db_path:
        prompt = (
            "Genera un programa de software completo y listo para implementar segun estos "
            "parametros. Devuelve Markdown con: especificacion funcional, tabla de modulos, "
            "arquitectura, codigo inicial funcional, plan de pruebas y estimacion economica.\n\n"
            + json.dumps(params, ensure_ascii=False, indent=2)
        )
        txt = generate(db_path, prompt, fallback_task="program", fallback_ctx=params)
        if not txt.startswith("# Programa generado por IASolges") and "Motor IA Local" not in txt:
            return txt
    return generate_program(params)
"""
IASolges - Capa de datos (SQLite)
Gestiona el esquema, migraciones y operaciones CRUD genéricas.
Solo biblioteca estandar.
"""
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.path.join(
    os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share")),
    "iasolges", "iasolges.db"
)

_local = threading.local()
_init_lock = threading.Lock()
_initialized = False

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    sector TEXT DEFAULT '',
    country TEXT DEFAULT 'España',
    city TEXT DEFAULT '',
    address TEXT DEFAULT '',
    website TEXT DEFAULT '',
    size TEXT DEFAULT '',
    status TEXT DEFAULT 'activo',
    segment TEXT DEFAULT '',
    value REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT DEFAULT '',
    role TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    linkedin TEXT DEFAULT '',
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'lead',
    source TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    objective TEXT DEFAULT '',
    channel TEXT DEFAULT '',
    sector TEXT DEFAULT '',
    city TEXT DEFAULT '',
    budget REAL DEFAULT 0,
    start_date TEXT DEFAULT '',
    end_date TEXT DEFAULT '',
    status TEXT DEFAULT 'borrador',
    metrics TEXT DEFAULT '{}',
    ai_strategy TEXT DEFAULT '',
    ai_copy TEXT DEFAULT '',
    ai_schedule TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS works (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'programa',
    status TEXT DEFAULT 'pendiente',
    priority TEXT DEFAULT 'media',
    progress INTEGER DEFAULT 0,
    due_date TEXT DEFAULT '',
    description TEXT DEFAULT '',
    params TEXT DEFAULT '{}',
    ai_output TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    template TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    variables TEXT DEFAULT '',
    description TEXT DEFAULT '',
    ai_optimized TEXT DEFAULT '',
    usage_count INTEGER DEFAULT 0,
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS security_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT DEFAULT '',
    target_type TEXT DEFAULT 'texto',
    content TEXT DEFAULT '',
    risk_level TEXT DEFAULT 'sin_evaluar',
    score INTEGER DEFAULT 0,
    findings TEXT DEFAULT '[]',
    ai_report TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'servicio',
    sector TEXT DEFAULT '',
    cost REAL DEFAULT 0,
    price REAL DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    unit TEXT DEFAULT 'unidad',
    min_qty REAL DEFAULT 1,
    max_qty REAL DEFAULT 0,
    ai_analysis TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT '',
    company TEXT DEFAULT '',
    city TEXT DEFAULT '',
    sector TEXT DEFAULT '',
    contact TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    website TEXT DEFAULT '',
    score REAL DEFAULT 0,
    status TEXT DEFAULT 'nuevo',
    source TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    criteria TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT '',
    sector TEXT DEFAULT '',
    "values" TEXT DEFAULT '',
    audience TEXT DEFAULT '',
    personality TEXT DEFAULT '',
    competitors TEXT DEFAULT '',
    palette TEXT DEFAULT '',
    fonts TEXT DEFAULT '',
    logo_concept TEXT DEFAULT '',
    slogan TEXT DEFAULT '',
    tone_of_voice TEXT DEFAULT '',
    description TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'marca',
    meaning TEXT DEFAULT '',
    rationale TEXT DEFAULT '',
    availability TEXT DEFAULT '',
    domains TEXT DEFAULT '',
    score REAL DEFAULT 0,
    ai_notes TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT DEFAULT '',
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    title TEXT DEFAULT '',
    status TEXT DEFAULT 'borrador',
    issue_date TEXT DEFAULT '',
    valid_days INTEGER DEFAULT 30,
    currency TEXT DEFAULT 'EUR',
    tax_rate REAL DEFAULT 21,
    discount REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    terms TEXT DEFAULT '',
    ai_narrative TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    qty REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT DEFAULT '',
    type TEXT DEFAULT 'general',
    content TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    result TEXT DEFAULT '',
    score INTEGER DEFAULT 0,
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS geo_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT DEFAULT '',
    radius INTEGER DEFAULT 10,
    sector TEXT DEFAULT '',
    business_type TEXT DEFAULT '',
    filters TEXT DEFAULT '{}',
    results TEXT DEFAULT '[]',
    total INTEGER DEFAULT 0,
    ai_analysis TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT DEFAULT '',
    action TEXT DEFAULT '',
    detail TEXT DEFAULT '',
    created_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_contacts_client ON contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_works_client ON works(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at DESC);
"""


def now():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def connect(db_path=None):
    path = db_path or DEFAULT_DB
    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)
        # Los datos pueden contener información comercial y claves: 700 siempre.
        try:
            os.chmod(folder, 0o700)
        except OSError:
            pass
    conn = sqlite3.connect(path, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


# El servidor usa ThreadingHTTPServer (un hilo por peticion). Una conexion por
# hilo creaba bloqueos de escritura; por eso se usa UNA sola conexion compartida
# protegida por un lock. En una app local de un solo usuario el coste es nulo.
_db_lock = threading.RLock()
_db_cache = {}


def get_conn(db_path=None):
    path = db_path or DEFAULT_DB
    conn = _db_cache.get(path)
    if conn is None:
        conn = connect(path)
        _db_cache[path] = conn
    return conn


@contextmanager
def _tx():
    with _db_lock:
        yield


def init_db(db_path=None):
    global _initialized
    if _initialized:
        return
    with _init_lock:
        if _initialized:
            return
        conn = connect(db_path)
        conn.executescript(SCHEMA)
        conn.execute("PRAGMA wal_autocheckpoint=500")
        _migrate(conn)
        _seed(conn)
        conn.commit()
        _close_quietly(conn)
        _initialized = True


def _close_quietly(conn):
    try:
        conn.close()
    except sqlite3.Error:
        pass


# Columnas que deben existir en cada tabla. Se usan para migrar instalaciones
# antiguas cuya base de datos se creo con una version previa del esquema.
EXPECTED = {
    "clients": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
                "updated_at": "TEXT DEFAULT ''", "tags": "TEXT DEFAULT ''"},
    "contacts": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
                 "updated_at": "TEXT DEFAULT ''", "tags": "TEXT DEFAULT ''"},
    "campaigns": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
                  "updated_at": "TEXT DEFAULT ''", "ai_strategy": "TEXT DEFAULT ''",
                  "ai_copy": "TEXT DEFAULT ''", "ai_schedule": "TEXT DEFAULT ''"},
    "works": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
              "updated_at": "TEXT DEFAULT ''", "params": "TEXT DEFAULT '{}'",
              "ai_output": "TEXT DEFAULT ''"},
    "prompts": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
                "updated_at": "TEXT DEFAULT ''", "ai_optimized": "TEXT DEFAULT ''"},
    "pricing": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
                "updated_at": "TEXT DEFAULT ''", "sector": "TEXT DEFAULT ''",
                "ai_analysis": "TEXT DEFAULT ''"},
    "prospects": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
                  "updated_at": "TEXT DEFAULT ''"},
    "brands": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
               "updated_at": "TEXT DEFAULT ''"},
    "names": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
              "updated_at": "TEXT DEFAULT ''", "domains": "TEXT DEFAULT ''"},
    "quotes": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
               "updated_at": "TEXT DEFAULT ''", "ai_narrative": "TEXT DEFAULT ''",
               "terms": "TEXT DEFAULT ''"},
    "analyses": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
                 "updated_at": "TEXT DEFAULT ''"},
    "geo_searches": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
                     "updated_at": "TEXT DEFAULT ''"},
    "security_checks": {"starred": "INTEGER DEFAULT 0", "created_at": "TEXT DEFAULT ''",
                        "updated_at": "TEXT DEFAULT ''"},
}


def _migrate(conn):
    """Añade por ALTER TABLE las columnas que falten (migración no destructiva)."""
    for table, cols in EXPECTED.items():
        try:
            have = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        except sqlite3.Error:
            continue
        if not have:
            continue
        for col, decl in cols.items():
            if col not in have:
                try:
                    conn.execute(f'ALTER TABLE {table} ADD COLUMN "{col}" {decl}')
                except sqlite3.Error:
                    pass


def _seed(conn):
    """Datos iniciales: ajustes por defecto y un prompt de ejemplo."""
    defaults = {
        "ai_provider": "local",
        "ai_model": "motor-iasolges-v1",
        "ai_base_url": "",
        "ai_api_key": "",
        "ai_temperature": "0.7",
        "ai_max_tokens": "2000",
        "theme": "azul",
        "company_name": "IASolges",
        "company_email": "",
        "company_phone": "",
        "currency": "EUR",
        "tax_rate": "21",
        "onboarding_done": "0",
    }
    for k, v in defaults.items():
        conn.execute("INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)", (k, v))
    if not conn.execute("SELECT COUNT(*) c FROM prompts").fetchone()["c"]:
        conn.execute(
            """INSERT INTO prompts(title,template,category,variables,description,usage_count,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                "Prospecto por email",
                "Hola {{nombre}},\n\nEscribo desde {{empresa}} porque {{razon}}. "
                "He visto que {{observacion}}. Te resumo en 3 lineas el valor que podemos aportar: {{propuesta}}.\n\n"
                "¿Te viene bien una llamada de 15 minutos esta semana?\n\nUn saludo,\n{{remitente}}",
                "ventas",
                "nombre,empresa,razon,observacion,propuesta,remitente",
                "Plantilla base para primer contacto comercial en frio.",
                0, now(), now(),
            ),
        )


# ---------------------------------------------------------------- genéricos
def rows_to_dicts(rows):
    return [dict(r) for r in rows]


def list_rows(db_path, table, order="id DESC", limit=None, offset=0, where=None, params=None):
    conn = get_conn(db_path)
    sql = f"SELECT * FROM {table}"
    args = []
    if where:
        sql += f" WHERE {where}"
        args = list(params or [])
    sql += f" ORDER BY {order}"
    if limit:
        sql += " LIMIT ? OFFSET ?"
        args += [int(limit), int(offset)]
    with _db_lock:
        return rows_to_dicts(conn.execute(sql, args).fetchall())


def get_row(db_path, table, row_id):
    conn = get_conn(db_path)
    with _db_lock:
        r = conn.execute(f"SELECT * FROM {table} WHERE id=?", (row_id,)).fetchone()
    return dict(r) if r else None


def count_rows(db_path, table, where=None, params=None):
    conn = get_conn(db_path)
    sql = f"SELECT COUNT(*) c FROM {table}"
    args = []
    if where:
        sql += f" WHERE {where}"
        args = list(params or [])
    with _db_lock:
        return conn.execute(sql, args).fetchone()["c"]


FIELDS = {
    "clients": ["name", "company", "email", "phone", "sector", "country", "city", "address",
                "website", "size", "status", "segment", "value", "notes", "tags", "starred"],
    "contacts": ["name", "company", "role", "email", "phone", "linkedin", "client_id", "status",
                 "source", "notes", "tags", "starred"],
    "campaigns": ["name", "client_id", "objective", "channel", "sector", "city", "budget",
                  "start_date", "end_date", "status", "metrics", "ai_strategy", "ai_copy",
                  "ai_schedule", "notes", "starred"],
    "works": ["title", "client_id", "type", "status", "priority", "progress", "due_date",
              "description", "params", "ai_output", "starred"],
    "prompts": ["title", "template", "category", "variables", "description", "ai_optimized",
                "usage_count", "starred"],
    "security_checks": ["title", "target_type", "content", "risk_level", "score", "findings", "ai_report", "starred"],
    "pricing": ["name", "type", "sector", "cost", "price", "currency", "unit", "min_qty", "max_qty",
                "ai_analysis", "notes", "active", "starred"],
    "prospects": ["name", "company", "city", "sector", "contact", "email", "phone", "website",
                  "score", "status", "source", "notes", "criteria", "starred"],
    "brands": ["name", "sector", "values", "audience", "personality", "competitors", "palette",
               "fonts", "logo_concept", "slogan", "tone_of_voice", "description", "starred"],
    "names": ["name", "category", "meaning", "rationale", "availability", "domains", "score", "ai_notes", "starred"],
    "quotes": ["number", "client_id", "title", "status", "issue_date", "valid_days", "currency",
               "tax_rate", "discount", "notes", "terms", "ai_narrative", "starred"],
    "analyses": ["title", "type", "content", "summary", "result", "score", "starred"],
    "geo_searches": ["location", "radius", "sector", "business_type", "filters", "results",
                     "total", "ai_analysis", "starred"],
    "quote_items": ["quote_id", "description", "category", "qty", "unit_price",
                    "discount", "tax_rate"],
}


INT_FIELDS = {"client_id", "quote_id"}


def _coerce(table, data):
    out = {}
    for k, v in (data or {}).items():
        if k not in FIELDS.get(table, []):
            continue
        if k in ("starred", "active"):
            out[k] = 1 if v in (True, 1, "1", "true", "True", "on") else 0
        elif k in INT_FIELDS:
            # None / "" deben guardarse como NULL: "" en una columna INTEGER
            # provocaba violación de clave foránea.
            if v in ("", None):
                out[k] = None
            else:
                try:
                    out[k] = int(float(v))
                except (TypeError, ValueError):
                    out[k] = None
        elif k in ("value", "budget", "cost", "price", "min_qty", "max_qty", "progress",
                   "score", "tax_rate", "discount", "usage_count", "valid_days", "radius", "total"):
            try:
                out[k] = float(v) if v not in ("", None) else 0.0
            except (TypeError, ValueError):
                out[k] = 0.0
        else:
            out[k] = None if v is None else str(v)
    return out


def create_row(db_path, table, data):
    conn = get_conn(db_path)
    cols = _coerce(table, data)
    if not cols:
        raise ValueError(f"No hay campos validos para la tabla '{table}'")
    ts = now()
    if table in ("clients", "contacts", "campaigns", "works", "prompts", "pricing", "prospects",
                 "brands", "names", "quotes", "analyses", "geo_searches", "security_checks"):
        cols.setdefault("created_at", ts)
        cols["updated_at"] = ts
    keys = list(cols.keys())
    cols_sql = ",".join('"' + k + '"' for k in keys)
    sql = f"INSERT INTO {table} ({cols_sql}) VALUES ({','.join(['?'] * len(keys))})"
    with _db_lock:
        cur = conn.execute(sql, [cols[k] for k in keys])
        conn.commit()
    log_activity(db_path, table, "creado", cols.get("name") or cols.get("title") or f"#{cur.lastrowid}")
    return get_row(db_path, table, cur.lastrowid)


def update_row(db_path, table, row_id, data):
    conn = get_conn(db_path)
    cols = _coerce(table, data)
    if not cols:
        return get_row(db_path, table, row_id)
    if "updated_at" in FIELDS.get(table, []):
        cols["updated_at"] = now()
    sets = ",".join(f"\"{k}\"=?" for k in cols)
    with _db_lock:
        conn.execute(f"UPDATE {table} SET {sets} WHERE id=?", list(cols.values()) + [row_id])
        conn.commit()
    return get_row(db_path, table, row_id)


def delete_row(db_path, table, row_id):
    conn = get_conn(db_path)
    with _db_lock:
        conn.execute(f"DELETE FROM {table} WHERE id=?", (row_id,))
        conn.commit()
    log_activity(db_path, table, "eliminado", f"#{row_id}")
    return True


def toggle_star(db_path, table, row_id):
    conn = get_conn(db_path)
    with _db_lock:
        r = conn.execute(f"SELECT starred FROM {table} WHERE id=?", (row_id,)).fetchone()
        if not r:
            return None
        val = 0 if r["starred"] else 1
        conn.execute(f"UPDATE {table} SET starred=? WHERE id=?", (val, row_id))
        conn.commit()
    return get_row(db_path, table, row_id)


# ---------------------------------------------------------------- ajustes
def get_setting(db_path, key, default=""):
    conn = get_conn(db_path)
    with _db_lock:
        r = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return r["value"] if r else default


def set_setting(db_path, key, value):
    conn = get_conn(db_path)
    with _db_lock:
        conn.execute("INSERT INTO settings(key,value) VALUES (?,?) "
                     "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
        conn.commit()
    return True


def all_settings(db_path):
    conn = get_conn(db_path)
    with _db_lock:
        return {r["key"]: r["value"] for r in conn.execute("SELECT * FROM settings").fetchall()}


def log_activity(db_path, module, action, detail=""):
    try:
        conn = get_conn(db_path)
        with _db_lock:
            conn.execute("INSERT INTO activity(module,action,detail,created_at) VALUES (?,?,?,?)",
                         (module, action, detail[:300], now()))
            conn.commit()
    except sqlite3.Error:
        pass


def recent_activity(db_path, limit=12):
    conn = get_conn(db_path)
    with _db_lock:
        return rows_to_dicts(
            conn.execute("SELECT * FROM activity ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        )


def stats(db_path):
    conn = get_conn(db_path)
    with _db_lock:
        return _stats_locked(conn)


def _stats_locked(conn):
    def c(sql, args=()):
        return conn.execute(sql, args).fetchone()[0]

    pipeline = sum(r[0] or 0 for r in conn.execute(
        "SELECT qty*unit_price*(1-discount/100.0) FROM quote_items WHERE quote_id IN "
        "(SELECT id FROM quotes WHERE status IN ('enviado','aprobado'))").fetchall())
    appr = sum(r[0] or 0 for r in conn.execute(
        "SELECT qty*unit_price*(1-discount/100.0) FROM quote_items WHERE quote_id IN "
        "(SELECT id FROM quotes WHERE status='aprobado')").fetchall())
    mrr = sum(r[0] or 0 for r in conn.execute(
        "SELECT price FROM pricing WHERE type='suscripcion' AND active=1").fetchall())
    margin = conn.execute(
        "SELECT AVG(CASE WHEN price>0 THEN (price-cost)/price*100.0 ELSE 0 END) FROM pricing").fetchone()[0] or 0

    return {
        "clientes": c("SELECT COUNT(*) FROM clients"),
        "clientes_activos": c("SELECT COUNT(*) FROM clients WHERE status='activo'"),
        "contactos": c("SELECT COUNT(*) FROM contacts"),
        "campanas": c("SELECT COUNT(*) FROM campaigns"),
        "campanas_activas": c("SELECT COUNT(*) FROM campaigns WHERE status='activa'"),
        "trabajos": c("SELECT COUNT(*) FROM works"),
        "trabajos_pendientes": c("SELECT COUNT(*) FROM works WHERE status IN ('pendiente','en_proceso')"),
        "presupuestos": c("SELECT COUNT(*) FROM quotes"),
        "presupuestos_aprobados": c("SELECT COUNT(*) FROM quotes WHERE status='aprobado'"),
        "importe_presupuestos": round(pipeline, 2),
        "importe_aprobado": round(appr, 2),
        "prospectos": c("SELECT COUNT(*) FROM prospects"),
        "mrr": round(mrr, 2),
        "margen_medio": round(margin, 1),
        "marcas": c("SELECT COUNT(*) FROM brands"),
        "nombres": c("SELECT COUNT(*) FROM names"),
        "analisis": c("SELECT COUNT(*) FROM analyses"),
        "prompts": c("SELECT COUNT(*) FROM prompts"),
        "chequeos": c("SELECT COUNT(*) FROM security_checks"),
        "busquedas_geo": c("SELECT COUNT(*) FROM geo_searches"),
        "favoritos": c("SELECT COUNT(*) FROM works WHERE starred=1")
                      + c("SELECT COUNT(*) FROM clients WHERE starred=1")
                      + c("SELECT COUNT(*) FROM contacts WHERE starred=1")
                      + c("SELECT COUNT(*) FROM campaigns WHERE starred=1")
                      + c("SELECT COUNT(*) FROM quotes WHERE starred=1")
                      + c("SELECT COUNT(*) FROM brands WHERE starred=1")
                      + c("SELECT COUNT(*) FROM names WHERE starred=1")
                      + c("SELECT COUNT(*) FROM pricing WHERE starred=1")
                      + c("SELECT COUNT(*) FROM prospects WHERE starred=1"),
    }


def jload(value, default):
    if not value:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return default
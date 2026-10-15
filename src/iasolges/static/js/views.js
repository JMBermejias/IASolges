/* ============================================================
   IASolges - Vistas de cada modulo
   ============================================================ */
"use strict";

const VIEWS = {};
const CFG = {};

/* ------------------------------------------------------------ NAVEGACION */
const NAV = [
  { group: "Plataforma", items: [
    { route: "inicio",        label: "Inicio",        icon: "home" },
    { route: "mi-trabajo",    label: "Mi Trabajo",    icon: "briefcase", module: "works" },
    { route: "clientes",      label: "Clientes",      icon: "users",     module: "clients" },
    { route: "contactos",     label: "Contactos",     icon: "user-check", module: "contacts" },
    { route: "campanas",      label: "Campañas",      icon: "megaphone", module: "campaigns" },
    { route: "favoritos",     label: "Favoritos",     icon: "star" },
  ]},
  { group: "Flujo de Trabajo", items: [
    { route: "mapa",          label: "Mapa Localizador Clientes", icon: "map",      module: "geo_searches" },
    { route: "prompts",       label: "Generador de Prompts",      icon: "terminal", module: "prompts" },
    { route: "seguridad",     label: "Chequeo de Seguridad",      icon: "shield",   module: "security_checks" },
    { route: "precios",       label: "Precios",                   icon: "tag",      module: "pricing" },
    { route: "prospectores",  label: "Prospectores",              icon: "crosshair", module: "prospects" },
  ]},
  { group: "Adicionales", items: [
    { route: "nombres",       label: "Nombres",       icon: "sparkles", module: "names" },
    { route: "kit-marca",     label: "Kit de Marca",  icon: "palette",  module: "brands" },
    { route: "analizador",    label: "Analizador",    icon: "scan",     module: "analyses" },
    { route: "presupuestos",  label: "Presupuestos",  icon: "file-text", module: "quotes" },
  ]},
];

const DASH_CARDS = [
  { route: "inicio", label: "Inicio",       group: "Plataforma",       icon: "home",        desc: "Panel general con KPIs y actividad reciente." },
  { route: "mi-trabajo", label: "Mi Trabajo",   group: "Plataforma",       icon: "briefcase",   desc: "Tus proyectos y programas generados con IA." },
  { route: "clientes", label: "Clientes",     group: "Plataforma",       icon: "users",       desc: "Cartera de clientes, segmentacion y analisis IA." },
  { route: "contactos", label: "Contactos",    group: "Plataforma",       icon: "user-check",  desc: "Personas de contacto vinculadas a cada cliente." },
  { route: "campanas", label: "Campañas",     group: "Plataforma",       icon: "megaphone",   desc: "Estrategia, copy y calendario generados por IA." },
  { route: "favoritos", label: "Favoritos",    group: "Plataforma",       icon: "star",        desc: "Todo lo que has marcado como favorito." },
  { route: "mapa", label: "Mapa Localizador Clientes",         group: "Flujo de Trabajo", icon: "map",         desc: "Localiza clientes potenciales por zona y sector." },
  { route: "prompts", label: "Generador de Prompts",      group: "Flujo de Trabajo", icon: "terminal",    desc: "Biblioteca y optimizador de prompts." },
  { route: "seguridad", label: "Chequeo de Seguridad",    group: "Flujo de Trabajo", icon: "shield",      desc: "Audita textos, credenciales y configuraciones." },
  { route: "precios", label: "Precios",      group: "Flujo de Trabajo", icon: "tag",         desc: "Modelos de precio, margenes y argumentos de venta." },
  { route: "prospectores", label: "Prospectores", group: "Flujo de Trabajo", icon: "crosshair",   desc: "Genera y cualifica prospectos por IA." },
  { route: "nombres", label: "Nombres",      group: "Adicionales",      icon: "sparkles",    desc: "Generador de nombres de marca y dominios." },
  { route: "kit-marca", label: "Kit de Marca",    group: "Adicionales",      icon: "palette",     desc: "Identidad completa: logo, color, tipografia y voz." },
  { route: "analizador", label: "Analizador",   group: "Adicionales",      icon: "scan",        desc: "Analiza contenido y devuelve puntaje y mejoras." },
  { route: "presupuestos", label: "Presupuestos", group: "Adicionales",      icon: "file-text",   desc: "Crea, calcula y exporta propuestas comerciales." },
];

/* ------------------------------------------------------------ HELPERS */
const SECTORS = ["general", "tecnologia", "salud", "legal", "construccion",
                 "ecommerce", "educacion", "hosteleria", "servicios", "agricultura", "industrial"];

async function fetchList(module, q) {
  const r = await Api.list("/api/" + module, q);
  return r.items || [];
}

/** Registra un modulo CRUD reutilizable. */
function mod(route, cfg) {
  CFG[route] = cfg;
  VIEWS[route] = async function (params) {
    const q = Object.assign({ limit: "300" }, params.q || {});
    const rows = await fetchList(cfg.module, q);
    const ai = cfg.ai ? aiPanel(cfg.ai.title, cfg.ai.desc, cfg.ai.btn, cfg.ai.action,
      cfg.ai.extra ? cfg.ai.extra() : "") : "";
    const head = `
      <div class="page-head">
        <div><h2>${esc(cfg.title)}</h2><p>${esc(cfg.desc)}</p></div>
        <div class="spacer"></div>
        ${cfg.tools ? cfg.tools() : ""}
        <button class="btn btn-primary" data-act="new">${icon("plus")} ${esc(cfg.addLabel || "Nuevo")}</button>
      </div>
      ${ai}
      ${cfg.before ? await cfg.before(params) : ""}
      <div class="toolbar">
        <label class="search" style="width:230px">${icon("search")}
          <input type="search" id="modSearch" placeholder="${esc(cfg.searchPh || "Buscar...")}" value="${esc(q.search || "")}"></label>
        ${(cfg.filters || []).map(f => `<select data-filter="${f.key}" style="border:1px solid var(--line);border-radius:9px;padding:7px 11px;background:var(--surface)">
            <option value="">${esc(f.label)}</option>
            ${f.options.map(o => `<option value="${esc(o[0])}"${q[f.key] === o[0] ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`).join("")}
        ${cfg.toolbarRight ? cfg.toolbarRight() : ""}
        <div class="spacer" style="flex:1"></div>
        <span class="muted tiny">${rows.length} registro${rows.length === 1 ? "" : "s"}</span>
      </div>
      <div class="panel"><div class="table-wrap">${table(cfg, rows)}</div></div>`;
    return head;
  };
}

function table(cfg, rows) {
  if (!rows.length) {
    return empty(cfg.emptyIcon || "folder", cfg.emptyTitle || "Sin registros",
      cfg.emptyText || "Crea el primer registro o usa la IA para generar uno automaticamente.",
      `<button class="btn btn-primary" data-act="new">${icon("plus")} ${esc(cfg.addLabel || "Nuevo")}</button>`);
  }
  return `<table><thead><tr>
      ${cfg.columns.map(c => `<th${c.num ? ' class="num"' : ""}>${esc(c.label)}</th>`).join("")}
      <th style="width:96px"></th></tr></thead><tbody>
    ${rows.map(r => `<tr data-id="${r.id}">
      ${cfg.columns.map(c => `<td class="${c.cls || (c.num ? "num" : "")}">${c.render(r)}</td>`).join("")}
      <td><div class="row-actions">
        <button class="mini star${r.starred ? " on" : ""}" data-act="star" title="Favorito">${icon("star")}</button>
        <button class="mini" data-act="edit" title="Editar">${icon("edit")}</button>
        <button class="mini" data-act="del" title="Eliminar">${icon("trash")}</button>
      </div></td></tr>`).join("")}
    </tbody></table>`;
}

function rowTitle(r) {
  const t = r.name || r.title || r.location || ("#" + r.id);
  return `<div style="font-weight:600">${esc(t)}</div>` +
    (r.company ? `<div class="muted tiny">${esc(r.company)}</div>` : "");
}

/* ------------------------------------------------------------ INICIO */
VIEWS["inicio"] = async function () {
  const d = await Api.get("/api/dashboard");
  const ai = d.ai || {};
  const kpis = [
    { l: "Clientes",           v: num(d.clientes),        s: `${d.clientes_activos || 0} activos`,   i: "users",   c: "" },
    { l: "Contactos",          v: num(d.contactos),       s: "personas registradas",                i: "user-check", c: "" },
    { l: "Campañas",           v: num(d.campanas),        s: `${d.campanas_activas || 0} activas`,   i: "megaphone", c: "accent" },
    { l: "Trabajos",           v: num(d.trabajos),        s: `${d.trabajos_pendientes || 0} abiertos`, i: "briefcase", c: "warn" },
    { l: "Presupuestos",       v: money(d.importe_presupuestos), s: `${d.presupuestos || 0} documentos`, i: "file-text", c: "ok" },
    { l: "Aprobado",           v: money(d.importe_aprobado),     s: `${d.presupuestos_aprobados || 0} cerrados`, i: "check", c: "ok" },
    { l: "Prospectos",         v: num(d.prospectos),      s: "en la cartera",                       i: "crosshair", c: "" },
    { l: "Ingresos recurrentes", v: money(d.mrr) + "/mes", s: `Margen medio ${d.margen_medio || 0}%`, i: "euro", c: "accent" },
  ];

  const groups = ["Plataforma", "Flujo de Trabajo", "Adicionales"];
  const cardHtml = g => DASH_CARDS.filter(c => c.group === g).map(c =>
    `<button class="card" data-nav="${c.route}">
       <div class="card-ico">${icon(c.icon)}</div>
       <h4>${esc(c.label)}</h4><p>${esc(c.desc)}</p>
       <span class="go">Abrir ${icon("chevron", 12)}</span>
     </button>`).join("");

  const feed = (d.activity || []).length ? d.activity.map(a =>
    `<div class="feed-item"><div class="f-ico">${icon(moduleIcon(a.module) || "info")}</div>
      <div><b>${esc(a.module)}</b> ${esc(a.action)}${a.detail ? " - " + esc(a.detail.slice(0, 48)) : ""}</div>
      <time>${ago(a.created_at)}</time></div>`).join("")
    : `<p class="muted tiny" style="padding:10px 0">Sin actividad todavia. Crea un cliente o genera un programa con IA.</p>`;

  const works = (d.recent_works || []).map(w =>
    `<div class="feed-item"><div class="f-ico">${icon("cpu")}</div>
      <div><b>${esc(w.title)}</b>${w.description ? " - " + esc(w.description.slice(0, 40)) : ""}</div>
      <span class="badge ${badgeClass(w.status)}">${esc(String(w.status).replace(/_/g, " "))}</span></div>`).join("")
    || `<p class="muted tiny" style="padding:10px 0">Aun no hay trabajos. Usa <b>Generar con IA</b> para crear tu primer programa.</p>`;

  const bars = d.chart ? Object.entries(d.chart).filter(([, v]) => v.length).map(([k, v]) => {
    const max = Math.max(...v.map(x => x.count), 1);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <span class="tiny muted" style="width:82px;text-transform:capitalize">${esc(k)}</span>
      <div class="bar" style="flex:1"><i style="width:${(v[v.length - 1].count / max) * 100}%"></i></div>
      <span class="tiny mono">${v[v.length - 1].count}</span></div>`;
  }).join("") : "";

  return `
  <div class="page-head">
    <div><h2>Bienvenido a IASolges</h2>
      <p>Plataforma de inteligencia artificial para gestionar tu negocio y generar programas
         personalizados de forma automatica.</p></div>
    <div class="spacer"></div>
    <button class="btn btn-ghost" data-act="seed">${icon("sparkles")} Cargar datos de ejemplo</button>
    <button class="btn btn-primary" data-act="quickai">${icon("cpu")} Constructor IA</button>
  </div>

  <div class="kpis">${kpis.map(k =>
    `<div class="kpi ${k.c}"><div class="k-top"><span class="k-label">${esc(k.l)}</span>
      <span class="k-ico">${icon(k.i)}</span></div>
      <div class="k-value">${esc(k.v)}</div><div class="k-sub">${esc(k.s)}</div></div>`).join("")}</div>

  <div class="ai-panel mb">
    <h3>${icon("cpu")} Constructor de programas con IA</h3>
    <p>Describe tu objetivo, el sector y las funciones que necesitas. IASolges genera un programa
       completo: especificacion, arquitectura, codigo inicial, plan de pruebas y presupuesto.</p>
    <div class="flex">
      <button class="btn" data-act="quickai">${icon("sparkles")} Generar programa ahora</button>
      <button class="btn ghost" data-nav="precios">Ver precios</button>
      <button class="btn ghost" data-nav="mi-trabajo">Mis trabajos</button>
    </div>
  </div>

  ${groups.map(g => `
    <div class="section-title"><h3>${esc(g)}</h3><div class="line"></div></div>
    <div class="cards mb">${cardHtml(g)}</div>`).join("")}

  <div class="grid2">
    <div class="panel"><div class="panel-head">
      <h3>${icon("clock")} Actividad reciente</h3>
      ${limpiarBtn("activity", (d.activity || []).length)}
      <button class="mini" data-act="view" data-nav2="mi-trabajo" title="Ver todo">${icon("chevron")}</button>
    </div>
      <div class="panel-body"><div class="feed">${feed}</div></div></div>
    <div class="panel"><div class="panel-head">
      <h3>${icon("briefcase")} Trabajos recientes</h3>
      ${limpiarBtn("works", (d.recent_works || []).length, d.trabajos)}
    </div>
      <div class="panel-body"><div class="feed">${works}</div></div></div>
  </div>

  <div class="panel mt"><div class="panel-head">
    <h3>${icon("trending")} Crecimiento de registros</h3>
    <span class="badge b-info">Motor: ${esc(ai.label || "local")}</span>
    ${limpiarBtn("chart", 0, 0, "Restablecer")}
  </div>
    <div class="panel-body">${bars || '<p class="muted tiny">Sin datos suficientes todavia.</p>'}</div></div>`;
};
function moduleIcon(m) {
  const f = NAV.flatMap(n => n.items).find(i => i.module === m);
  return f ? f.icon : "info";
}

/** Boton de limpieza de un panel del inicio. */
function limpiarBtn(target, visibles, total, etiqueta) {
  return `<button class="mini clean" data-act="limpiar" data-target="${target}"
    title="${esc(etiqueta || "Limpiar panel")}">${icon("eraser")}</button>`;
}

/* ------------------------------------------------------------ MI TRABAJO */
VIEWS["mi-trabajo"] = async function (params) {
  const q = Object.assign({ limit: "300" }, params.q || {});
  const rows = await fetchList("works", q);
  const cards = rows.map(w => {
    let out = w.ai_output;
    try { const o = JSON.parse(out); if (o && o.program) out = o.program; } catch (e) {}
    return `<div class="panel"><div class="panel-head">
        <h3>${icon("cpu")} ${esc(w.title)}</h3>${badge(w.status)}
        <button class="mini star${w.starred ? " on" : ""}" data-act="star" data-id="${w.id}">${icon("star")}</button></div>
      <div class="panel-body">
        ${w.description ? `<p class="muted tiny mb">${esc(w.description)}</p>` : ""}
        <div class="flex-between mb">
          <span class="tiny muted">Prioridad ${esc(w.priority)}</span>
          <span class="tiny mono">${w.progress || 0}%</span></div>
        <div class="bar mb"><i style="width:${Number(w.progress) || 0}%"></i></div>
        <div class="flex">
          <button class="btn btn-ghost btn-sm" data-act="view" data-id="${w.id}">${icon("eye")} Ver programa</button>
          <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${w.id}">${icon("edit")} Editar</button>
          <button class="btn btn-danger btn-sm" data-act="del" data-id="${w.id}">${icon("trash")}</button>
        </div>
      </div></div>`;
  }).join("");

  return `
  <div class="page-head">
    <div><h2>Mi Trabajo</h2><p>Todos tus proyectos y programas generados automaticamente con inteligencia artificial.</p></div>
    <div class="spacer"></div>
    <button class="btn btn-primary" data-act="new">${icon("plus")} Nuevo trabajo</button>
  </div>
  ${aiPanel("Constructor de programas", "Genera un programa completo a partir de tus parametros: sector, objetivo, funciones y stack.", "Generar programa", "program")}
  <div class="toolbar">
    <label class="search" style="width:230px">${icon("search")}
      <input type="search" id="modSearch" placeholder="Buscar trabajo..." value="${esc(q.search || "")}"></label>
    <select data-filter="status" style="border:1px solid var(--line);border-radius:9px;padding:7px 11px;background:var(--surface)">
      <option value="">Todos los estados</option>
      ${["pendiente", "en_proceso", "revision", "completado"].map(s => `<option${q.status === s ? " selected" : ""}>${s.replace("_", " ")}</option>`).join("")}
    </select>
    <div style="flex:1"></div>
    <span class="muted tiny">${rows.length} trabajo${rows.length === 1 ? "" : "s"}</span>
  </div>
  ${rows.length ? `<div class="grid2">${cards}</div>`
    : empty("briefcase", "Sin trabajos", "Genera tu primer programa con el Constructor IA o crea un trabajo manualmente.",
        `<button class="btn btn-primary" data-act="new">${icon("plus")} Nuevo trabajo</button>`)}`;
};

/* ------------------------------------------------------------ CLIENTES */
mod("clientes",{
  module: "clients", title: "Clientes", addLabel: "Nuevo cliente",
  desc: "Cartera de clientes con segmentacion, valor y analisis inteligente.",
  searchPh: "Buscar cliente, sector, ciudad...",
  filters: [{ key: "sector", label: "Todos los sectores", options: SECTORS.map(s => [s, s]) },
            { key: "status", label: "Todos los estados", options: [["activo", "Activo"], ["potencial", "Potencial"], ["inactivo", "Inactivo"]] }],
  emptyIcon: "users", emptyTitle: "Sin clientes",
  emptyText: "Registra tu primer cliente o genera uno con IA.",
  ai: { title: "Analisis de cliente con IA",
        desc: "Puntua el encaje con tu mercado, estima el potencial y prepara la proxima accion comercial.",
        btn: "Analizar cliente", action: "client" },
  columns: [
    { label: "Cliente", render: r => rowTitle(r) },
    { label: "Sector", render: r => `${esc(r.sector || "-")}${r.city ? `<div class="muted tiny">${icon("pin", 11)} ${esc(r.city)}</div>` : ""}` },
    { label: "Contacto", render: r => r.email ? `<div class="trunc">${icon("mail", 11)} ${esc(r.email)}</div>` : `<span class="muted">-</span>` },
    { label: "Tamano", render: r => esc(r.size || "-") },
    { label: "Estado", render: r => badge(r.status) },
    { label: "Valor", num: true, render: r => `<b>${money(r.value)}</b>` },
  ],
  form: [
    field("Nombre *", input("name"), "Nombre comercial o de la empresa", true),
    field("Razon social", input("company")),
    field("Sector", select("sector", "", SECTORS.map(s => [s, s === "general" ? "General" : s]))),
    field("Ciudad", input("city")),
    field("Pais", input("country", "Espana")),
    field("Email", input("email", "", "email")),
    field("Telefono", input("phone", "", "tel")),
    field("Web", input("website", "", "url")),
    field("Direccion", input("address")),
    field("Tamano", select("size", "", [["", "Sin especificar"], ["1-10", "1-10 empleados"], ["11-50", "11-50"], ["51-200", "51-200"], ["10-500", "Mas de 200"]])),
    field("Estado", select("status", "activo", [["activo", "Activo"], ["potencial", "Potencial"], ["inactivo", "Inactivo"]])),
    field("Segmento", input("segment")),
    field("Valor anual (EUR)", input("value", 0, "number", "0", "0.01")),
    field("Etiquetas", input("tags"), "Separadas por comas", true),
    field("Notas", textarea("notes", "", "Notas internas"), null, true),
  ],
});

/* ------------------------------------------------------------ CONTACTOS */
mod("contactos",{
  module: "contacts", title: "Contactos", addLabel: "Nuevo contacto",
  desc: "Personas de contacto vinculadas a tus clientes, con su rol y estado comercial.",
  searchPh: "Buscar nombre, empresa, email...",
  filters: [{ key: "status", label: "Todos los estados",
              options: [["lead", "Lead"], ["contactado", "Contactado"], ["cualificado", "Cualificado"], ["cliente", "Cliente"], ["perdido", "Perdido"]] }],
  emptyIcon: "user-check", emptyTitle: "Sin contactos",
  emptyText: "Anade contactos y vincúlalos a tus clientes.",
  columns: [
    { label: "Contacto", render: r => rowTitle(r) },
    { label: "Cargo", render: r => esc(r.role || "-") },
    { label: "Empresa", render: r => `<div class="trunc">${esc(r.company || (r.client_name || "-"))}</div>` },
    { label: "Email", render: r => r.email ? `<div class="trunc">${esc(r.email)}</div>` : `<span class="muted">-</span>` },
    { label: "Telefono", render: r => esc(r.phone || "-") },
    { label: "Estado", render: r => badge(r.status) },
  ],
  form: [
    field("Nombre *", input("name"), null, true),
    field("Cargo", input("role")),
    field("Empresa", input("company")),
    field("Cliente vinculado", "<select name='client_id' id='fClient'></select>"),
    field("Email", input("email", "", "email")),
    field("Telefono", input("phone", "", "tel")),
    field("LinkedIn", input("linkedin", "", "url")),
    field("Estado", select("status", "lead", [["lead", "Lead"], ["contactado", "Contactado"], ["cualificado", "Cualificado"], ["cliente", "Cliente"], ["perdido", "Perdido"]])),
    field("Origen", input("source", "", null, "linkedin, web, referido...")),
    field("Etiquetas", input("tags"), "Separadas por comas", true),
    field("Notas", textarea("notes"), null, true),
  ],
  afterForm: async (body) => {
    const s = body.querySelector("#fClient");
    if (!s) return;
    const cs = await fetchList("clients", { limit: "500" });
    s.innerHTML = '<option value="">- Sin vincular -</option>' +
      cs.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  },
  ai: { title: "Limpieza y enriquecimiento",
        desc: "Normaliza los datos de contactoloaded antes de usarlos.", btn: "Analizar", action: "analyze" },
});

/* ------------------------------------------------------------ CAMPANAS */
mod("campanas",{
  module: "campaigns", title: "Campañas", addLabel: "Nueva campaña",
  desc: "Estrategia, copy y calendario generado automaticamente con IA.",
  searchPh: "Buscar campaña, objetivo...",
  filters: [{ key: "status", label: "Todos los estados",
              options: [["borrador", "Borrador"], ["programada", "Programada"], ["activa", "Activa"], ["finalizada", "Finalizada"]] }],
  emptyIcon: "megaphone", emptyTitle: "Sin campanas",
  emptyText: "Crea una campaña y deja que la IA genere estrategia, copy y calendario.",
  ai: { title: "Generador de campañas",
        desc: "Describe objetivo, sector y presupuesto. Obtendras estrategia, textos listos para publicar y calendario editorial.",
        btn: "Generar campaña", action: "campaign" },
  columns: [
    { label: "Campaña", render: r => rowTitle(r) },
    { label: "Objetivo", render: r => `<div class="trunc">${esc(r.objective || "-")}</div>` },
    { label: "Canal", render: r => esc(r.channel || "-") },
    { label: "Presupuesto", num: true, render: r => money(r.budget) },
    { label: "Estado", render: r => badge(r.status) },
    { label: "Generado", render: r => r.ai_strategy ? `<span class="badge b-ok">${icon("check", 10)} IA</span>` : `<span class="muted tiny">-</span>` },
  ],
  form: [
    field("Nombre de la campaña *", input("name"), null, true),
    field("Objetivo *", input("objective", "", null, "Aumentar la captacion"), "Que quieres conseguir", true),
    field("Canal", select("channel", "multicanal", ["multicanal", "email", "linkedin", "seo", "paid", "telefono", "eventos"])),
    field("Sector", select("sector", "general", SECTORS.map(s => [s, s]))),
    field("Ciudad", input("city")),
    field("Presupuesto (EUR)", input("budget", 0, "number", "0", "0.01")),
    field("Inicio", input("start_date", today(), "date")),
    field("Fin", input("end_date", "", "date")),
    field("Estado", select("status", "borrador", [["borrador", "Borrador"], ["programada", "Programada"], ["activa", "Activa"], ["finalizada", "Finalizada"]])),
    field("Notas", textarea("notes"), null, true),
  ],
  rowExtra: (r) => (r.ai_strategy ? `
    <button class="mini" data-act="view" data-id="${r.id}" title="Ver resultado">${icon("eye")}</button>` : ""),
});

/* ------------------------------------------------------------ FAVORITOS */
VIEWS["favoritos"] = async function () {
  const r = await Api.get("/api/favorites");
  const by = {};
  r.items.forEach(i => (by[i.module_label] = by[i.module_label] || []).push(i));
  const secs = Object.entries(by).map(([k, list]) => `
    <div class="section-title"><h3>${esc(k)}</h3><div class="line"></div>
      <span class="muted tiny">${list.length}</span></div>
    <div class="grid2 mb">${list.map(i => `
      <div class="panel"><div class="panel-body">
        <div class="flex-between mb"><b>${esc(i.title)}</b>
          <button class="mini star on" data-act="star" data-mod="${i.module}" data-id="${i.id}">${icon("star")}</button></div>
        <div class="flex tiny muted">
          <span>${icon("clock", 11)} ${ago(i.item.created_at)}</span>
          <span>${icon("folder", 11)} ${esc(k)}</span></div>
      </div></div>`).join("")}</div>`).join("");

  return `
  <div class="page-head"><div><h2>Favoritos</h2>
    <p>Todos los elementos que has marcado con la estrella, agrupados por módulo.</p></div>
    <div class="spacer"></div><span class="badge b-brand">${r.count} elementos</span></div>
  ${r.count ? secs : empty("star", "Sin favoritos", "Marca con la estrella cualquier registro para tenerlo aqui siempre a mano.")}`;
};

/* ------------------------------------------------------------ MAPA */
/** Resultados de la busqueda abierta: los necesita afterRender para montar el mapa. */
let GeoPendiente = null;

/* Etiquetas legibles de cada sector en el desplegable. */
const ETIQUETA_SECTOR = {
  general: "Cualquier sector", tecnologia: "Tecnologia y software", salud: "Salud y clinics",
  legal: "Legal y gestorias", construccion: "Construccion y reformas",
  ecommerce: "Comercio electronico", educacion: "Educacion y formacion",
  hosteleria: "Hosteleria y restauracion", servicios: "Servicios profesionales",
  agricultura: "Agricultura", industrial: "Industria y almacen",
};

/* Actividades que se ofrecen en "Tipo de negocio", por sector. Se combina con
   las que devuelve el servidor para que nunca se vea vacio. */
const TIPOS_MAPA = {
  general: [["", "Todos los tipos"], ["Centro", "Centros y servicios"], ["Comercio", "Comercio"],
            ["Oficina", "Oficinas y gestion"], ["Restaurante", "Restaurantes y cafeterias"]],
  tecnologia: [["", "Todos los tipos"], ["Consultoria IT", "Consultoria IT"],
               ["Software", "Software y aplicaciones"], ["Telecomunicaciones", "Telecomunicaciones"],
               ["Informatic", "Servicios informaticos"]],
  salud: [["", "Todos los tipos"], ["Centro de salud", "Centros de salud"],
          ["Clinica", "Clinicas"], ["Fisioterapia", "Fisioterapia"],
          ["Dental", "Clinicas dentales"], ["Farmacia", "Farmacias"],
          ["Laboratorio clinico", "Laboratorios clinicos"], ["Residencia", "Residencias"]],
  legal: [["", "Todos los tipos"], ["Despacho de abogados", "Despachos de abogados"],
          ["Asesoria fiscal", "Asesorias fiscales"], ["Gestoria", "Gestorias"], ["Notario", "Notarias"]],
  construccion: [["", "Todos los tipos"], ["Constructora", "Constructoras"],
                 ["Reformas", "Empresas de reformas"], ["Inmobiliaria", "Inmobiliarias"],
                 ["Arquitectos", "Despachos de arquitectura"], ["Ingenieria", "Ingenierias"]],
  ecommerce: [["", "Todos los tipos"], ["Comercio electronico", "Comercio electronico"],
              ["Tienda online", "Tiendas online"], ["Distribuidor", "Distribuidores"]],
  educacion: [["", "Todos los tipos"], ["Centro de formacion", "Centros de formacion"],
              ["Academia", "Academias"], ["Instituto", "Institutos"],
              ["Escuela de negocios", "Escuelas de negocios"], ["Guarderia", "Guarderias"]],
  hosteleria: [["", "Todos los tipos"], ["Restaurante", "Restaurantes"], ["Hotel", "Hoteles"],
               ["Cafe", "Cafeterias"], ["Bar", "Bares"], ["Catering", "Catering"]],
  servicios: [["", "Todos los tipos"], ["Asesoria", "Asesorias"], ["Gestoria", "Gestorias"],
              ["Agencia", "Agencias"], ["Seguros", "Seguros"], ["Inmobiliaria", "Inmobiliarias"],
              ["Peluqueria", "Peluquerias"], ["Fontaneria", "Fontaneria"],
              ["Lavanderia", "Lavanderias"], ["administracion", "Administracion"]],
  agricultura: [["", "Todos los tipos"], ["Agricola", "Explotaciones agricolas"],
                ["Cooperativa", "Cooperativas"], ["Finca", "Fincas"]],
  industrial: [["", "Todos los tipos"], ["Industrial", "Industrias"],
               ["Almacen", "Almacenes"], ["Mantenimiento", "Mantenimiento industrial"]],
};

VIEWS["mapa"] = async function (params) {
  let sector = (params.sector || "general").toLowerCase();
  let tipoNegocio = params.tipo || "";
  let origen = params.origen || "real";
  const q = params.q || {};
  const rows = await fetchList("geo_searches", { limit: "50" });
  let res = null;
  GeoPendiente = null;
  if (params.id) {
    const g = await Api.get("/api/geo_searches/" + params.id);
    try {
      let centro = null;
      try { centro = JSON.parse(g.filters || "{}").center || null; } catch (e) {}
      res = { results: JSON.parse(g.results), analysis: g.ai_analysis, location: g.location,
              radius: g.radius, sector: g.sector, center: centro,
              real: g.fuente ? /OpenStreetMap/i.test(g.fuente) : false, fuente: g.fuente || "" };
      // Guardamos los resultados para que afterRender monte el mapa y la
      // seleccion: sin esto, al reabrir una busqueda guardada los marcadores
      // no respondian y "Analizar seleccion" no tenia nada que enviar.
      res.aviso = g.aviso || "";
      // El formulario tiene que reflejar la busqueda guardada, no el valor por
      // defecto: si no, al reabrir dice "Cualquier sector" aunque se haya
      // buscado en "construccion".
      sector = (g.sector || "general").toLowerCase();
      tipoNegocio = g.business_type || "";
      origen = /OpenStreetMap/i.test(g.fuente || "") ? "real" : "muestra";
      GeoPendiente = { id: g.id, results: res.results, analysis: g.ai_analysis || "" };
    } catch (e) {}
  }
  return `
  <div class="page-head"><div><h2>Mapa Localizador de Clientes</h2>
    <p>Busca oportunidades por ubicacion, sector y tipo de negocio. La IA analiza el mercado y propone una secuencia de contacto.</p></div></div>

  <div class="grid2 mb">
    <div class="panel"><div class="panel-head"><h3>${icon("map")} Parametros de busqueda</h3></div>
      <div class="panel-body"><form class="form" id="geoForm">
        <div class="form-grid">
          ${field("Localidad *", input("location", res ? res.location : "Madrid", "text", "Ciudad o zona"))}
          ${field("Radio (km)", input("radius", res ? res.radius : 10, "number", "10", "1"))}
          ${field("Sector", select("sector", sector, SECTORS.map(x => [x, ETIQUETA_SECTOR[x] || x])), "", true)}
          ${field("Tipo de negocio", select("business_type", tipoNegocio, TIPOS_MAPA[sector] || []),
                  "Se rellena con las actividades reales de la zona")}
          ${field("Numero de resultados", input("limit", 20, "number", "20", "1"))}
        </div>
        <div class="form-grid">
          ${field("Origen de los datos", select("origin", origen,
              [["real", "Reales (OpenStreetMap)"], ["muestra", "Muestra del Motor IA"]]),
              "Reales trae nombres y direcciones que existen de verdad")}
        </div>
        <button class="btn btn-primary" type="submit">${icon("search")} Buscar y analizar</button>
        <p class="tiny muted" id="geoNota" style="margin-top:8px">Con <b>datos reales</b> salen
          nombres y direcciones que existen de verdad, pero <b>sin teléfono ni correo</b>: hay que
          buscarlos en la web de cada negocio. Sin conexión se usan datos de muestra.</p>
      </form></div></div>

    <div class="panel"><div class="panel-head"><h3>${icon("globe")} Zonas con cobertura</h3></div>
      <div class="panel-body">
        <div class="chips">${["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Malaga", "Bilbao", "Alicante"]
          .map(c => `<button class="chip" data-loc="${c}">${c}</button>`).join("")}</div>
        <p class="tiny muted mt">Pulsa una ciudad para rellenar el formulario. El motor IA Local
          genera un mapa de oportunidad de muestra que puedes usar para planificar.</p>
      </div></div>
  </div>

  <div id="geoResult">${res ? mapHtml(res) : ""}</div>

  <div class="section-title"><h3>Busquedas guardadas</h3><div class="line"></div></div>
  <div class="panel"><div class="table-wrap">${rows.length ? `<table><thead><tr>
      <th>Localidad</th><th>Radio</th><th>Sector</th><th class="num">Resultados</th><th>Fecha</th><th></th>
    </tr></thead><tbody>${rows.map(g => `<tr>
      <td><b>${esc(g.location)}</b></td><td>${g.radius} km</td><td>${esc(g.sector)}</td>
      <td class="num">${g.total}</td><td class="muted tiny">${ago(g.created_at)}</td>
      <td><div class="row-actions">
        <button class="mini" data-act="open" data-id="${g.id}">${icon("eye")}</button>
        <button class="mini" data-act="del" data-id="${g.id}">${icon("trash")}</button></div></td>
    </tr>`).join("")}</tbody></table>`
      : empty("map", "Sin busquedas", "Realiza tu primera busqueda local para ver oportunidades por zona.")}</div></div>`;
};

/* ------------------------------------------------------------ MAPA REAL */
/* Proyeccion Web Mercator: es la misma que usan los tiles de OpenStreetMap,
   asi los puntos caen justo encima de la calle que les toca. */
const _merc = (lat, lon, z) => {
  const n = Math.pow(2, z);
  const s = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
  return {
    x: (lon + 180) / 360 * n * 256,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n * 256,
  };
};

/* Zoom para que el radio pedido ocupe mas o menos el ancho del mapa. */
const _zoom = (lat, radioKm) => {
  const ancho = 1000;
  const mpp = (2 * Math.max(0.5, radioKm) * 1000) / ancho;
  const z = Math.log2(156543.03392 * Math.cos(lat * Math.PI / 180) / mpp);
  return Math.max(9, Math.min(17, Math.round(z)));
};

/* Tiles del mapa de fondo. Si no hay conexion no cargan y se ve la rejilla. */
const TILES = (origen, z, W, H) => {
  const n = Math.pow(2, z);
  const x0 = Math.floor(origen.x / 256), x1 = Math.floor((origen.x + W) / 256);
  const y0 = Math.floor(origen.y / 256), y1 = Math.floor((origen.y + H) / 256);
  const out = [];
  for (let ty = y0; ty <= y1 && out.length < 80; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = x0; tx <= x1 && out.length < 80; tx++) {
      const wx = ((tx % n) + n) % n;
      // Se piden a traves del servidor, no a OpenStreetMap directamente: sus
      // tiles devuelven 403 a quien no se identifica en la politica de uso.
      out.push(`<image href="/api/mapa/tile/${z}/${wx}/${ty}.png"
        x="${tx * 256 - origen.x}" y="${ty * 256 - origen.y}"
        width="256" height="256" />`);
    }
  }
  return out.join("");
};

function mapHtml(res) {
  const pts = res.results || [];
  if (!pts.length) return "";
  const real = res.real !== false;
  const sinPuntuar = p => !p.score && p.score !== 0;
  const conPuntos = pts.filter(p => p.score > 0).length;

  // Centro: el que devuelve el servidor, o la media de los puntos.
  const c = res.center && typeof res.center.lat === "number" ? res.center : null;
  const centro = c || {
    lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length,
    lon: pts.reduce((a, p) => a + p.lon, 0) / pts.length,
  };
  const radio = Math.max(0.5, Number(res.radius) || 10);
  const z = _zoom(centro.lat, radio);
  const W = 1000, H = 620;
  const pc = _merc(centro.lat, centro.lon, z);
  const origen = { x: pc.x - W / 2, y: pc.y - H / 2 };

  const color = p => (p.score >= 80 ? "#5C8C72" : p.score >= 60 ? "#6E9CC4"
                      : p.score > 0 ? "#A9BCCC" : "#8FA3B8");
  const r = p => (p.score > 0 ? 6 + (p.score / 100) * 6 : 6.5);
  const R = 15;

  const markers = pts.map((p, i) => {
    const q = _merc(p.lat, p.lon, z);
    const cx = q.x - origen.x, cy = q.y - origen.y;
    const eti = sinPuntuar(p) ? esc(p.name) : `${esc(p.name)} - ${p.score}/100`;
    return `
    <g class="marker" data-idx="${i}" tabindex="0" role="button" aria-label="${esc(p.name)}">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="${color(p)}" fill-opacity=".16" class="halo"/>
      <circle cx="${cx}" cy="${cy}" r="${r(p)}" fill="${color(p)}" fill-opacity=".94"
              stroke="#fff" stroke-width="1.6"/>
      <title>${eti}\n${esc(p.address || "")}</title>
    </g>`;
  }).join("");

  const capas = res.sinTiles ? "" : TILES(origen, z, W, H);

  return `
  <div class="section-title"><h3>Mapa de resultados</h3><div class="line"></div>
    <span class="badge ${real ? "b-ok" : "b-info"}">${pts.length} ${real ? "reales" : "de muestra"}</span>
    <span class="badge b-info">${esc(res.fuente || (real ? "OpenStreetMap" : "Muestra"))}</span>
    <span class="muted tiny">Pulsa un punto o una fila para ver el detalle</span></div>

  <div class="map-wrap mb">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
      <g class="tiles">${capas}</g>${markers}
    </svg>
    <div class="map-legend">
      ${conPuntos ? `
      <div><i style="background:#5C8C72"></i>Alta prioridad (&gt;80)</div>
      <div><i style="background:#6E9CC4"></i>Media (60–80)</div>
      <div><i style="background:#A9BCCC"></i>Baja (&lt;60)</div>
      <div><i style="background:#8FA3B8"></i>Sin puntuar</div>` : ""}
      <div><i style="background:#CBD5E1;border:1px solid #94A3B8"></i>Mapa: OpenStreetMap</div>
    </div>
    <div class="map-info"><b>${esc(res.location)}</b> — radio ${res.radius} km<br>
      <span class="muted tiny">Sector ${esc(res.sector || "general")} · ${pts.length} ${real ? "negocios reales" : "de muestra"}</span></div>
  </div>

  ${res.aviso ? `<div class="geo-aviso ${res.real ? "leve" : "fuerte"}">
      ${icon(res.real ? "info" : "alert", 16)}
      <div>${md(res.aviso)}</div></div>` : ""}

  <div class="grid2 mb">
    <div class="panel"><div class="panel-head">
        <h3>${icon("crosshair")} Oportunidades</h3>
        <div class="flex">
          <button class="btn btn-ghost btn-sm" data-act="selAll">Seleccionar todo</button>
          <button class="btn btn-ghost btn-sm" data-act="selNone">Ninguno</button>
        </div>
      </div>
      <div class="table-wrap" style="max-height:360px;overflow:auto">
        <table><thead><tr><th style="width:34px"></th><th>Negocio</th>
          <th class="num">Score</th><th style="width:34px"></th></tr></thead>
        <tbody id="geoBody">${pts.map((p, i) => `
          <tr data-idx="${i}" style="cursor:pointer" class="${i === 0 ? "sel" : ""}">
            <td><input type="checkbox" data-chk="${i}" ${i === 0 ? "checked" : ""}
                       style="width:15px;height:15px;accent-color:var(--brand-2);cursor:pointer"></td>
            <td><b>${esc(p.name)}</b>
              <div class="muted tiny">${esc(p.address)}</div>
              <div class="muted tiny">${esc(p.phone)} · ${esc(p.email)}</div></td>
            <td class="num"><span class="badge ${p.score >= 80 ? "b-ok" : p.score >= 60 ? "b-info" : ""}">${p.score}</span></td>
            <td class="num muted tiny">${i === 0 ? "&#9666;" : ""}</td>
          </tr>`).join("")}</tbody></table>
      </div></div>

    <div class="panel" id="geoDetail"><div class="panel-head">
        <h3>${icon("info")} Detalle del resultado</h3></div>
      <div class="panel-body" id="geoDetailBody">${detalleHtml(pts[0])}</div>
      <div class="panel-body" style="border-top:1px solid var(--line)">
        <div class="flex-between mb">
          <button class="btn btn-primary" id="btnGeoAI">${icon("sparkles")} Analizar seleccion con IA</button>
          <span class="muted tiny" id="geoSelCount"></span>
        </div>
        <p class="tiny muted mb">La IA dira que tienen y que les falta a los resultados seleccionados.</p>
        <div id="geoAI"></div>
      </div>
    </div>
  </div>

  <div class="panel"><div class="panel-head"><h3>${icon("sparkles")} Analisis del mercado (IA)</h3>
    <span class="badge b-info">${esc(res.location)}</span></div>
    <div class="panel-body"><div class="output">${md(res.analysis || "")}</div></div></div>`;
}

function detalleHtml(p) {
  if (!p) return `<p class="muted tiny">Selecciona un resultado.</p>`;
  return `
    <div class="flex-between mb">
      <div><b style="font-size:14.5px">${esc(p.name)}</b>
        <div class="muted tiny">${esc(p.business_type || "")}</div></div>
      <span class="badge ${p.score >= 80 ? "b-ok" : p.score >= 60 ? "b-info" : ""}">${
        p.score ? p.score + "/100" : "Sin puntuar"}</span>
    </div>
    <div class="stat-row"><span>Direccion</span><b class="trunc">${esc(p.address)}</b></div>
    <div class="stat-row"><span>Telefono</span><b>${p.phone ? esc(p.phone) : '<span class="muted">Sin dato publico</span>'}</b></div>
    <div class="stat-row"><span>Email</span><b class="trunc">${p.email ? esc(p.email) : '<span class="muted">Sin dato publico</span>'}</b></div>
    <div class="stat-row"><span>Web</span><b>${p.website ? esc(p.website) : '<span class="muted">Sin dato publico</span>'}</b></div>
    ${p.size ? `<div class="stat-row"><span>Tamano</span><b>${esc(p.size)} empleados</b></div>` : ""}
    <div class="stat-row"><span>Distancia</span><b>${p.distance} km</b></div>
    <div class="stat-row"><span>Coordenadas</span><b class="mono tiny">${p.lat}, ${p.lon}</b></div>
    ${p.pain ? `<div class="stat-row"><span>Problema detectado</span><b>${esc(p.pain)}</b></div>` : ""}
    ${p.real ? `<p class="tiny muted" style="margin-top:10px">Nombre, direccion y ubicacion
      verificados en <b>OpenStreetMap</b>. El telefono y el correo no son datos publicos:
      buscalos en la web del negocio antes de escribir.</p>` : ""}`;
}

/* ------------------------------------------------------------ PROMPTS */
mod("prompts",{
  module: "prompts", title: "Generador de Prompts", addLabel: "Nuevo prompt",
  desc: "Biblioteca de prompts con variables y optimizador integrado.",
  searchPh: "Buscar prompt...",
  filters: [{ key: "category", label: "Todas las categorias",
              options: ["general", "ventas", "marketing", "analisis", "codigo", "estrategia", "contenido"] }],
  emptyIcon: "terminal", emptyTitle: "Sin prompts",
  emptyText: "Crea tu primer prompt o deja que la IA lo optimice.",
  ai: { title: "Optimizador de prompts",
        desc: "Pega tu prompt. La IA lo reescribe con rol, contexto, formato de salida y restricciones para obtener respuestas mucho mejores.",
        btn: "Abrir optimizador", action: "__optimize" },
  columns: [
    { label: "Prompt", render: r => rowTitle(r) },
    { label: "Categoria", render: r => badge(r.category) },
    { label: "Variables", render: r => { const v = String(r.variables || "").split(",").filter(Boolean);
        return v.length ? `<div class="chips">${v.slice(0, 4).map(x => `<span class="chip">${esc(x.trim())}</span>`).join("")}</div>` : `<span class="muted">-</span>`; } },
    { label: "Usos", num: true, render: r => `<b>${r.usage_count || 0}</b>` },
    { label: "Modificado", render: r => `<span class="muted tiny">${ago(r.updated_at)}</span>` },
  ],
  rowExtra: (r) => `<button class="mini" data-act="use" data-id="${r.id}" title="Usar">${icon("send")}</button>`,
  form: [
    field("Titulo *", input("title"), null, true),
    field("Categoria", select("category", "general", ["general", "ventas", "marketing", "analisis", "codigo", "estrategia", "contenido"])),
    field("Variables", input("variables", "", null, "nombre, empresa, ciudad"), "Separadas por comas", true),
    field("Plantilla *", textarea("template", "", "Hola {{nombre}}, ...", 8), "Usa {{variable}} para los huecos", true),
    field("Descripcion", textarea("description"), null, true),
  ],
});

/* ------------------------------------------------------------ SEGURIDAD */
VIEWS["seguridad"] = async function (params) {
  const q = Object.assign({ limit: "100" }, params.q || {});
  const rows = await fetchList("security_checks", q);
  return `
  <div class="page-head"><div><h2>Chequeo de Seguridad</h2>
    <p>Audita textos, credenciales, URLs y configuraciones. Detecta secretos expuestos y datos personales,
       y genera un plan de remediacion.</p></div></div>

  <div class="grid2 mb">
    <div class="panel"><div class="panel-head"><h3>${icon("shield")} Analizar contenido</h3></div>
      <div class="panel-body"><form class="form" id="secForm">
        ${field("Tipo de analisis", select("analisis_mode", "auto",
            [["auto", "Automatico con IA"], ["manual", "Manual (yo pulso Analizar)"]]))}
        <div class="sec-modo" id="secEstado" data-modo="auto">
          <span class="sec-modo-dot"></span>
          <span class="sec-modo-txt"><b>Automatico con IA activo.</b> Se analiza solo 1,5 s despues de
            que dejes de escribir. No hace falta que pulses nada.</span>
        </div>
        ${field("Titulo del analisis", input("title", "", "Chequeo de seguridad"))}
        ${field("Tipo de objetivo", select("target_type", "texto",
            [["texto", "Texto / documento"], ["configuracion", "Configuracion"], ["codigo", "Codigo fuente"], ["contrato", "Contrato / legal"]]))}
        ${field("Contenido a analizar *", textarea("content", "", "Pega aqui el texto, codigo o configuracion a revisar...", 9), null, true)}
        <div class="flex">
          <button class="btn btn-primary" type="button" id="btnSecRun">${icon("shield")} Analizar ahora</button>
          <button class="btn btn-ghost" type="button" id="btnSecSample">${icon("sparkles")} Cargar ejemplo</button>
          <button class="btn btn-ghost" type="button" id="btnSecRegla">${icon("refresh")} Reanalizar</button>
        </div>
        <p class="tiny muted">En modo <b>Automatico con IA</b> no hace falta que pulses nada; <b>Analizar ahora</b>
          tambien sirve y no espera. Se aplican ${icon("info", 11)} 23 reglas: credenciales y tokens, claves
          privadas, inyecciones (SQL, comandos, XSS), traversal, CORS, TLS, algoritmos debiles, datos
          personales, permisos, IP internas y buenas practicas.</p>
      </form></div></div>
    <div id="secOut"><div class="panel"><div class="panel-body">
      ${empty("shield", "Sin analisis", "Pega contenido a la izquierda: con el modo \"Automatico con IA\" el analisis se lanza solo, sin que tengas que pulsar nada.")}
    </div></div></div>
  </div>

  <div class="section-title"><h3>Historial de chequeos</h3><div class="line"></div></div>
  <div class="panel"><div class="table-wrap">${rows.length ? `<table><thead><tr>
      <th>Titulo</th><th>Tipo</th><th>Riesgo</th><th class="num">Puntuacion</th><th>Fecha</th><th></th>
    </tr></thead><tbody>${rows.map(r => `<tr>
      <td><b>${esc(r.title || "Sin titulo")}</b><div class="muted tiny trunc">${esc(String(r.content || "").slice(0, 60))}</div></td>
      <td>${esc(r.target_type)}</td><td>${badge(r.risk_level)}</td>
      <td class="num"><b>${r.score}</b>/100</td>
      <td class="muted tiny">${ago(r.created_at)}</td>
      <td><div class="row-actions">
        <button class="mini" data-act="view" data-id="${r.id}">${icon("eye")}</button>
        <button class="mini" data-act="del" data-id="${r.id}">${icon("trash")}</button></div></td>
    </tr>`).join("")}</tbody></table>`
    : empty("shield", "Sin chequeos", "Todavia no has ejecutado ningun analisis de seguridad.")}</div></div>`;
};

/* ------------------------------------------------------------ PRECIOS */
mod("precios",{
  module: "pricing", title: "Precios", addLabel: "Nuevo precio",
  desc: "Modelos de precio, calculo de margen y argumentos de venta generados con IA.",
  searchPh: "Buscar concepto...",
  filters: [{ key: "type", label: "Todos los tipos",
              options: [["servicio", "Servicio"], ["producto", "Producto"], ["suscripcion", "Suscripcion"], ["paquete", "Paquete"]] }],
  emptyIcon: "tag", emptyTitle: "Sin precios",
  emptyText: "Define tus productos y servicios para calcular margenes y generar argumentos de venta.",
  ai: { title: "Analisis de precios con IA",
        desc: "Introduce coste y precio. La IA calcula margen, escenarios de volumen, precio recomendado y un argumentario de venta listo para usar.",
        btn: "Analizar precio", action: "pricing" },
  columns: [
    { label: "Concepto", render: r => rowTitle(r) },
    { label: "Tipo", render: r => badge(r.type) },
    { label: "Coste", num: true, render: r => money(r.cost, r.currency) },
    { label: "Precio", num: true, render: r => `<b>${money(r.price, r.currency)}</b>` },
    { label: "Margen", num: true, render: r => { const m = r.price > 0 ? ((r.price - r.cost) / r.price) * 100 : 0;
        return `<span class="badge ${m >= 50 ? "b-ok" : m >= 30 ? "b-warn" : "b-err"}">${m.toFixed(0)}%</span>`; } },
    { label: "Unidad", render: r => esc(r.unit || "-") },
  ],
  rowExtra: (r) => (r.ai_analysis ? `<button class="mini" data-act="view" data-id="${r.id}">${icon("eye")}</button>` : ""),
  form: [
    field("Concepto *", input("name"), null, true),
    field("Tipo", select("type", "servicio", [["servicio", "Servicio"], ["producto", "Producto"], ["suscripcion", "Suscripcion"], ["paquete", "Paquete"]])),
    field("Sector", select("sector", "general", SECTORS.map(s => [s, s]))),
    field("Coste unitario", input("cost", 0, "number", "0", "0.01")),
    field("Precio unitario", input("price", 0, "number", "0", "0.01")),
    field("Moneda", select("currency", "EUR", ["EUR", "USD", "GBP", "MXN"])),
    field("Unidad", select("unit", "unidad", ["unidad", "hora", "dia", "mes", "ano", "proyecto", "licencia"])),
    field("Cantidad minima", input("min_qty", 1, "number", "1", "1")),
    field("Cantidad maxima", input("max_qty", 0, "number", "0 (sin limite)", "1")),
    field("Notas", textarea("notes"), null, true),
  ],
});

/* ------------------------------------------------------------ PROSPECTORES */
mod("prospectores",{
  module: "prospects", title: "Prospectores", addLabel: "Nuevo prospecto",
  desc: "Genera listas de prospectos cualificados por sector y ubicacion, con pitch y secuencia multicanal.",
  searchPh: "Buscar empresa, contacto...",
  filters: [{ key: "status", label: "Todos los estados",
              options: [["nuevo", "Nuevo"], ["contactado", "Contactado"], ["reunion", "Reunion"], ["propuesta", "Propuesta"], ["cerrado", "Cerrado"]] }],
  emptyIcon: "crosshair", emptyTitle: "Sin prospectos",
  emptyText: "Usa el generador de prospectos para crear tu primera lista cualificada.",
  ai: { title: "Generador de prospectos",
        desc: "Indica sector y localidad. La IA genera prospectos con puntuacion de ajuste, senal detectada, pitch de 15 segundos y secuencia de contacto de 21 dias.",
        btn: "Generar prospectos", action: "prospects" },
  columns: [
    { label: "Empresa", render: r => rowTitle(r) },
    { label: "Contacto", render: r => `${esc(r.contact || "-")}<div class="muted tiny">${esc(r.role || "")}</div>` },
    { label: "Ubicacion", render: r => esc(r.city || "-") },
    { label: "Sector", render: r => esc(r.sector || "-") },
    { label: "Ajuste", num: true, render: r => { const s = Number(r.score) || 0;
        return `<span class="badge ${s >= 80 ? "b-ok" : s >= 60 ? "b-info" : ""}">${s}</span>`; } },
    { label: "Estado", render: r => badge(r.status) },
  ],
  form: [
    field("Empresa *", input("company"), null, true),
    field("Persona de contacto", input("contact")),
    field("Cargo", input("role")),
    field("Ciudad", input("city")),
    field("Sector", select("sector", "general", SECTORS.map(s => [s, s]))),
    field("Email", input("email", "", "email")),
    field("Telefono", input("phone", "", "tel")),
    field("Web", input("website", "", "url")),
    field("Puntuacion de ajuste", input("score", 70, "number", "70", "1")),
    field("Estado", select("status", "nuevo", [["nuevo", "Nuevo"], ["contactado", "Contactado"], ["reunion", "Reunion"], ["propuesta", "Propuesta"], ["cerrado", "Cerrado"]])),
    field("Origen", input("source", "", null, "IA, linkedin, referido...")),
    field("Notas", textarea("notes"), null, true),
  ],
});

/* ------------------------------------------------------------ NOMBRES */
mod("nombres",{
  module: "names", title: "Nombres", addLabel: "Anadir nombre",
  desc: "Generador de nombres de marca con significado, dominio sugerido y puntuacion.",
  searchPh: "Buscar nombre...",
  emptyIcon: "sparkles", emptyTitle: "Sin nombres guardados",
  emptyText: "Genera propuestas de nombre y guarda las que te gusten.",
  ai: { title: "Generador de nombres",
        desc: "Indica sector, estilo (compuesto, evocativo o mixto) y palabras clave. Obtendras propuestas con significado, dominio y puntuacion.",
        btn: "Generar nombres", action: "names" },
  columns: [
    { label: "Nombre", render: r => `<div style="font-weight:700;font-size:15px;letter-spacing:-.3px">${esc(r.name)}</div>` },
    { label: "Significado", render: r => `<div class="trunc muted tiny">${esc(r.meaning || "-")}</div>` },
    { label: "Dominio", render: r => r.domains ? `<span class="mono tiny">${esc(r.domains)}</span>` : `<span class="muted">-</span>` },
    { label: "Puntuacion", num: true, render: r => { const s = Number(r.score) || 0;
        return `<span class="badge ${s >= 80 ? "b-ok" : "b-info"}">${s}</span>`; } },
    { label: "Fecha", render: r => `<span class="muted tiny">${ago(r.created_at)}</span>` },
  ],
  form: [
    field("Nombre *", input("name"), null, true),
    field("Categoria", select("category", "marca", ["marca", "producto", "proyecto", "dominio", "equipo"])),
    field("Significado", input("meaning")),
    field("Dominio", input("domains")),
    field("Puntuacion", input("score", 75, "number", "75", "1")),
    field("Disponibilidad", select("availability", "pendiente", [["pendiente", "Pendiente"], ["libre", "Libre"], ["ocupado", "Ocupado"], ["registrado", "Registrado"]])),
    field("Notas IA", textarea("ai_notes", "", null, 6), null, true),
  ],
});

/* ------------------------------------------------------------ KIT MARCA */
mod("kit-marca",{
  module: "brands", title: "Kit de Marca", addLabel: "Nueva marca",
  desc: "Identidad completa: logo, paleta de color, tipografia, tono de voz y propuesta de valor.",
  searchPh: "Buscar marca...",
  emptyIcon: "palette", emptyTitle: "Sin marcas",
  emptyText: "Crea un kit de marca completo generado por IA.",
  ai: { title: "Generador de kit de marca",
        desc: "Describe la marca, su sector, audiencia y personalidad. La IA devuelve concepto de logo, paleta, tipografia, tono de voz y eslogan.",
        btn: "Generar kit de marca", action: "brand" },
  columns: [
    { label: "Marca", render: r => rowTitle(r) },
    { label: "Sector", render: r => esc(r.sector || "-") },
    { label: "Personalidad", render: r => badge(r.personality) },
    { label: "Audiencia", render: r => `<div class="trunc muted tiny">${esc(r.audience || "-")}</div>` },
    { label: "Colores", render: r => { try { const p = JSON.parse(r.palette || "[]");
        return `<div class="flex" style="gap:4px">${p.slice(0, 5).map(c => `<span title="${esc(c)}" style="width:19px;height:19px;border-radius:5px;background:${esc(c)};border:1px solid var(--line);display:inline-block"></span>`).join("")}</div>`;
      } catch (e) { return `<span class="muted">-</span>`; } } },
  ],
  rowExtra: (r) => `<button class="mini" data-act="view" data-id="${r.id}">${icon("eye")}</button>`,
  form: [
    field("Nombre de marca *", input("name"), null, true),
    field("Sector", select("sector", "general", SECTORS.map(s => [s, s]))),
    field("Personalidad", select("personality", "autoridad",
        ["autoridad", "proximidad", "innovacion", "elegancia", "diversidad", "urgencia"].map(p => [p, p]))),
    field("Audiencia objetivo", input("audience", "", null, "Pymes de 10 a 200 empleados")),
    field("Valores (separados por comas)", input("values", "", null, "cercania, rigor, resultados"), null, true),
    field("Competidores", input("competitors")),
    field("Descripcion", textarea("description", "", "A que se dedica, que problema resuelve, en que se diferencia..."), null, true),
  ],
  formFooter: `<div class="flex" style="margin-top:4px">
      <button type="button" class="btn btn-primary" id="btnBrandAI">
        ${icon("sparkles")} Generar la marca con IA</button>
      <span class="tiny muted">Rellena sola el kit completo con los datos que escribas y previsualiza el resultado.</span>
    </div>`,
});

/* ------------------------------------------------------------ ANALIZADOR */
mod("analizador",{
  module: "analyses", title: "Analizador", addLabel: "Nuevo analisis",
  desc: "Analiza cualquier contenido y devuelve puntuacion, debilidades y recomendaciones accionables.",
  searchPh: "Buscar analisis...",
  filters: [{ key: "type", label: "Todos los tipos",
              options: [["general", "General"], ["texto", "Texto"], ["venta", "Venta"], ["estrategia", "Estrategia"], ["documento", "Documento"], ["web", "Web"], ["email", "Email"]] }],
  emptyIcon: "scan", emptyTitle: "Sin analisis",
  emptyText: "Pega un texto y obtén un informe completo con puntuacion y mejoras.",
  ai: { title: "Analizador de contenido con IA",
        desc: "Pega texto, copy de venta, un email o un documento. Obtendras puntuacion por dimension, debilidades detectadas y recomendaciones.",
        btn: "Analizar contenido", action: "analyze" },
  columns: [
    { label: "Analisis", render: r => rowTitle(r) },
    { label: "Tipo", render: r => badge(r.type) },
    { label: "Puntuacion", num: true, render: r => { const s = Number(r.score) || 0;
        return `<span class="badge ${s >= 75 ? "b-ok" : s >= 55 ? "b-warn" : "b-err"}">${s}/100</span>`; } },
    { label: "Resumen", render: r => `<div class="trunc muted tiny">${esc(String(r.summary || "").replace(/[#*`]/g, "").slice(0, 90))}</div>` },
    { label: "Fecha", render: r => `<span class="muted tiny">${ago(r.created_at)}</span>` },
  ],
  rowExtra: (r) => `<button class="mini" data-act="view" data-id="${r.id}">${icon("eye")}</button>`,
  form: [
    field("Titulo *", input("title")),
    field("Tipo", select("type", "general", ["general", "texto", "venta", "estrategia", "documento", "web", "email"])),
    field("Puntuacion", input("score", 0, "number", "0", "1")),
    field("Contenido *", textarea("content", "", "Pega aqui el contenido a analizar...", 10), null, true),
    field("Resumen", textarea("summary"), null, true),
  ],
});

/* ------------------------------------------------------------ PRESUPUESTOS */
VIEWS["presupuestos"] = async function (params) {
  const q = Object.assign({ limit: "200" }, params.q || {});
  const rows = await fetchList("quotes", q);
  const clients = await fetchList("clients", { limit: "500" });
  window.__clients = clients;

  const t = rows.map(r => r.totals || { total: 0 });
  const sum = t.reduce((a, x) => a + (x.total || 0), 0);
  const appr = rows.filter(r => r.status === "aprobado");
  const apprSum = appr.reduce((a, r) => a + (r.totals ? r.totals.total : 0), 0);

  return `
  <div class="page-head">
    <div><h2>Presupuestos</h2><p>Propuestas comerciales con calculo automatico de impuestos, descuentos y narrativa generada con IA.</p></div>
    <div class="spacer"></div>
    <button class="btn btn-ghost" data-act="exportall">${icon("download")} Exportar CSV</button>
    <button class="btn btn-primary" data-act="new">${icon("plus")} Nuevo presupuesto</button>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="k-top"><span class="k-label">Documentos</span><span class="k-ico">${icon("file-text")}</span></div>
      <div class="k-value">${rows.length}</div><div class="k-sub">presupuestos creados</div></div>
    <div class="kpi accent"><div class="k-top"><span class="k-label">Pipeline</span><span class="k-ico">${icon("trending")}</span></div>
      <div class="k-value">${money(sum)}</div><div class="k-sub">valor total en juego</div></div>
    <div class="kpi ok"><div class="k-top"><span class="k-label">Aprobado</span><span class="k-ico">${icon("check")}</span></div>
      <div class="k-value">${money(apprSum)}</div><div class="k-sub">${appr.length} aceptados</div></div>
  </div>

  <div class="toolbar">
    <label class="search" style="width:230px">${icon("search")}
      <input type="search" id="modSearch" placeholder="Buscar presupuesto..." value="${esc(q.search || "")}"></label>
    <select data-filter="status" style="border:1px solid var(--line);border-radius:9px;padding:7px 11px;background:var(--surface)">
      <option value="">Todos los estados</option>
      ${["borrador", "enviado", "aprobado", "rechazado"].map(s => `<option${q.status === s ? " selected" : ""}>${s}</option>`).join("")}
    </select>
    <div style="flex:1"></div>
    <span class="muted tiny">${rows.length} presupuesto${rows.length === 1 ? "" : "s"}</span>
  </div>

  <div class="panel"><div class="table-wrap">${rows.length ? `<table><thead><tr>
      <th>Numero</th><th>Titulo</th><th>Cliente</th><th class="num">Total</th><th>Estado</th><th>Fecha</th><th></th>
    </tr></thead><tbody>${rows.map(r => `<tr>
      <td><span class="mono">${esc(r.number)}</span></td>
      <td><b>${esc(r.title || "Sin titulo")}</b>${r.items && r.items.length ? `<div class="muted tiny">${r.items.length} lineas</div>` : ""}</td>
      <td>${esc((r.client_name) || "Sin cliente")}</td>
      <td class="num"><b>${money(r.totals ? r.totals.total : 0, r.currency)}</b></td>
      <td>${badge(r.status)}</td>
      <td class="muted tiny">${esc(r.issue_date || ago(r.created_at))}</td>
      <td><div class="row-actions">
        <button class="mini" data-act="view" data-id="${r.id}" title="Ver">${icon("eye")}</button>
        <button class="mini" data-act="narrative" data-id="${r.id}" title="Generar narrativa IA">${icon("sparkles")}</button>
        <button class="mini star${r.starred ? " on" : ""}" data-act="star" data-id="${r.id}">${icon("star")}</button>
        <button class="mini" data-act="del" data-id="${r.id}">${icon("trash")}</button></div></td>
    </tr>`).join("")}</tbody></table>`
    : empty("file-text", "Sin presupuestos", "Crea tu primer presupuesto: anade lineas, calcula el total y genera la narrativa con IA.",
        `<button class="btn btn-primary" data-act="new">${icon("plus")} Nuevo presupuesto</button>`)}</div></div>`;
};
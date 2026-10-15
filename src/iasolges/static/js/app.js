/* ============================================================
   IASolges - Aplicacion: router, eventos, formularios y acciones IA
   ============================================================ */
"use strict";

const State = { route: "inicio", params: {}, engine: { label: "Motor IA Local" }, cache: {} };

/* ------------------------------------------------------------ NAV */
function buildNav() {
  $("#nav").innerHTML = NAV.map(g => `
    <div class="nav-group">
      <div class="nav-label">${esc(g.group)}</div>
      ${g.items.map(i => `<button class="side-item" data-nav="${i.route}" data-module="${i.module || ""}">
          <span class="side-ico">${icon(i.icon)}</span>
          <span class="side-label">${esc(i.label)}</span>
          <span class="side-count" data-count="${i.module || ""}" hidden></span>
        </button>`).join("")}
    </div>`).join("");
}

function markNav(route) {
  $$(".side-item").forEach(b => b.classList.toggle("active", b.dataset.nav === route));
}

/** Rellena los <span data-icon="..."> del HTML estatico con su SVG. */
function pintarIconos(root) {
  $$("[data-icon]", root).forEach(el => {
    const n = el.dataset.icon;
    if (n && !el.querySelector("svg")) el.innerHTML = icon(n);
  });
}

async function refreshCounts() {
  for (const m of new Set(NAV.flatMap(n => n.items).map(i => i.module).filter(Boolean))) {
    try {
      const r = await Api.get("/api/" + m, { limit: "1" });
      $$(`[data-count="${m}"]`).forEach(el => {
        el.textContent = r.total != null ? r.total : 0;
        el.hidden = !r.total;
      });
    } catch (e) { /* silencioso */ }
  }
}

/* ------------------------------------------------------------ ROUTER */
async function go(route, params) {
  if (!VIEWS[route]) route = "inicio";
  State.route = route; State.params = params || {};
  location.hash = "#/" + route;
  markNav(route);
  $("#sidebar").classList.remove("open");

  const meta = NAV.flatMap(n => n.items).find(i => i.route === route) || { label: "Inicio" };
  $("#pageTitle").textContent = meta.label;
  $("#pageSub").textContent = SUBTITLES[route] || "";
  document.title = meta.label + " - IASolges";
  marcarBotonInicio();
  $("#modSearch") && ($("#modSearch").value = (State.params.q && State.params.q.search) || "");
  $("#globalSearch").value = (State.params.q && State.params.q.search) || "";

  const v = $("#view");
  v.innerHTML = `<div class="loading"><span class="spin dark"></span> Cargando...</div>`;
  try {
    const html = await VIEWS[route](State.params);
    v.innerHTML = html;
    afterRender(route);
  } catch (e) {
    v.innerHTML = empty("alert", "Error al cargar", e.message,
      `<button class="btn btn-primary" onclick="go('${route}')">Reintentar</button>`);
    console.error(e);
  }
  refreshCounts();
}

const SUBTITLES = {
  "inicio": "Panel de control", "mi-trabajo": "Proyectos y programas generados con IA",
  "clientes": "Cartera y segmentacion", "contactos": "Personas de contacto",
  "campanas": "Estrategia, copy y calendario", "favoritos": "Tus elementos destacados",
  "mapa": "Oportunidades por zona y sector", "prompts": "Biblioteca y optimizador",
  "seguridad": "Auditoria y remediacion", "precios": "Margenes y argumentos de venta",
  "prospectores": "Prospectos cualificados", "nombres": "Nombres de marca",
  "kit-marca": "Identidad visual y verbal", "analizador": "Analisis de contenido",
  "presupuestos": "Propuestas comerciales", "settings": "Ajustes de la aplicacion",
};

function afterRender(route) {
  // El selector de modelos vive dentro de la vista de Configuracion y se
  // construye en el DOM: hay que pintarlo cada vez que se entra en ella,
  // no solo al arrancar (si no, el <select> llega vacio).
  if (route === "settings" && typeof initSelectorModelos === "function") {
    try { initSelectorModelos(); } catch (e) { console.error("selector modelos", e); }
  }

  if (route === "mapa") {
    Geo.cargarTipos();
    // Sin esto, al abrir una busqueda guardada el mapa salia dibujado pero
    // Geo.resultados seguia vacio: no habia seleccion ni detalle, y el boton
    // "Analizar seleccion con IA" se quejaba de que no havia nada elegido.
    if (GeoPendiente && GeoPendiente.results && GeoPendiente.results.length) {
      Geo.montar(GeoPendiente.results);
      repararAnalisisGeo(GeoPendiente);
    }
  }

  if (route === "seguridad") {
    const ta = $("#secForm [name=content]");
    if (ta) ta.oninput = () => Security.alCambiar(ta);
    const run = $("#btnSecRun");
    if (run) run.onclick = () => Security.forzar(false);
    const re = $("#btnSecRegla");
    if (re) re.onclick = () => Security.forzar(true);   // reanaliza como automatico
    const modo = $("#secForm [name=analisis_mode]");
    if (modo) modo.onchange = () => Security.cambiarModo();
    Security.cuenta = 0;
    Security.refrescarEstado();
    const ej = $("#btnSecSample");
    if (ej) ej.onclick = () => {
      ta.value = EJEMPLO_SEGURIDAD;
      Security.ultimo = EJEMPLO_SEGURIDAD;
      ejecutarChequeo({ auto: Security.modo() === "auto" });
    };
  }
  const f = $("#modSearch");
  if (f) f.oninput = debounce(() => {
    State.params.q = State.params.q || {};
    State.params.q.search = f.value;
    go(State.route, State.params);
  }, 340);
  $$("[data-filter]").forEach(s => s.onchange = () => {
    State.params.q = State.params.q || {};
    if (s.value) State.params.q[s.dataset.filter] = s.value; else delete State.params.q[s.dataset.filter];
    go(State.route, State.params);
  });
}

/* ------------------------------------------------------------ FORMULARIOS */
async function openForm(route, id) {
  const cfg = CFG[route];
  if (!cfg) return;
  const isQ = route === "presupuestos";
  if (isQ) return openQuoteForm(id);

  let row = {};
  if (id) { try { row = await Api.get(`/api/${cfg.module}/${id}`); } catch (e) {} }

  const body = `<form class="form" id="editForm">
      <div class="form-grid">${cfg.form.map(f => f).join("")}</div>
      ${cfg.extraForm ? cfg.extraForm(row) : ""}
      ${cfg.formFooter || ""}
    </form>`;
  const foot = `<button class="btn btn-ghost left" data-close>Cancelar</button>
    <button class="btn btn-primary" id="btnSave">${icon("save")} Guardar</button>`;

  Modal.open((id ? "Editar" : "Nuevo") + " - " + cfg.title.toLowerCase(),
    body + '<div id="brandPreview" class="mt"></div>', foot, true);

  if (cfg.afterForm) await cfg.afterForm($("#editForm"), row);

  // Boton opcional dentro del formulario (por ejemplo, generar con IA).
  const bAI = $("#btnBrandAI");
  if (bAI) bAI.onclick = async () => {
    const f = $("#editForm");
    const d = Object.fromEntries(new FormData(f).entries());
    if (!String(d.name || "").trim()) return toast("Escribe primero el nombre de la marca", "warn");
    bAI.disabled = true;
    bAI.innerHTML = '<span class="spin"></span> Generando marca...';
    const previo = $("#brandPreview");
    if (previo) previo.innerHTML = `<div class="loading"><span class="spin dark"></span>
       La IA esta creando el kit de marca completo...</div>`;
    try {
      const r = await Api.post("/api/ai/brand", { ...d, save: false });
      if (previo) previo.innerHTML = `<div class="section-title"><h3>Kit generado</h3>
        <div class="line"></div></div><div class="output">${md(r.text)}</div>`;
      // Rellenar los campos que la IA haya deducido.
      const v = r.campos || {};
      ["sector", "audience", "values", "personality", "competitors"].forEach(k => {
        const el = f.querySelector(`[name="${k}"]`);
        if (el && v[k]) el.value = v[k];
      });
      const desc = f.querySelector('[name="description"]');
      if (desc && !desc.value.trim()) desc.value = r.resumen || "";
      toast("Kit de marca generado", "ok");
    } catch (e) {
      if (previo) previo.innerHTML = empty("alert", "Error", e.message);
    }
    bAI.disabled = false;
    bAI.innerHTML = icon("sparkles") + " Generar la marca con IA";
  };

  $("#btnSave").onclick = async () => {
    const form = $("#editForm");
    const data = Object.fromEntries(new FormData(form).entries());
    const f = cfg.fields || {};
    if (!String(data.name || data.title || "").trim()) {
      toast("El nombre es obligatorio", "warn"); return;
    }
    const btn = $("#btnSave"); btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Guardando...';
    try {
      if (id) await Api.put(`/api/${cfg.module}/${id}`, data);
      else await Api.post(`/api/${cfg.module}`, data);
      Modal.close(); toast("Guardado correctamente", "ok"); go(State.route, State.params);
    } catch (e) {
      toast(e.message, "err"); btn.disabled = false;
      btn.innerHTML = icon("save") + " Guardar";
    }
  };
}

/* --- formulario de presupuestos con lineas --- */
async function openQuoteForm(id) {
  let q = { status: "borrador", issue_date: today(), tax_rate: 21, valid_days: 30, currency: "EUR", discount: 0, items: [] };
  if (id) { try { q = await Api.get("/api/quotes/" + id); } catch (e) {} }
  const clients = (State.cache.clients ||= await fetchList("clients", { limit: "500" }));

  const itemRow = (i) => `<tr>
      <td><input value="${esc(i.description || "")}" data-f="description" placeholder="Concepto"></td>
      <td style="width:120px"><input value="${esc(i.category || "servicio")}" data-f="category" placeholder="Categoria"></td>
      <td style="width:80px"><input type="number" step="0.01" value="${i.qty ?? 1}" data-f="qty" min="0"></td>
      <td style="width:110px"><input type="number" step="0.01" value="${i.unit_price ?? 0}" data-f="unit_price" min="0"></td>
      <td style="width:86px"><input type="number" step="0.01" value="${i.discount ?? 0}" data-f="discount" min="0" max="100"></td>
      <td class="num line-total mono">0,00</td>
      <td style="width:34px"><button class="mini" data-delrow>${icon("trash")}</button></td></tr>`;

  Modal.open((id ? "Editar" : "Nuevo") + " presupuesto", `
    <form class="form" id="qForm">
      <div class="form-grid">
        ${field("Numero", input("number", q.number || ""), "Se genera automaticamente si se deja vacio")}
        ${field("Cliente", select("client_id", q.client_id || "", [["-1", "- Sin cliente -"], ...clients.map(c => [c.id, c.name])]))}
        ${field("Titulo *", input("title", q.title))}
        ${field("Estado", select("status", q.status, [["borrador", "Borrador"], ["enviado", "Enviado"], ["aprobado", "Aprobado"], ["rechazado", "Rechazado"]]))}
        ${field("Fecha de emision", input("issue_date", q.issue_date, "date"))}
        ${field("Validez (dias)", input("valid_days", q.valid_days, "number", "30", "1"))}
        ${field("IVA (%)", input("tax_rate", q.tax_rate, "number", "21", "0.01"))}
        ${field("Descuento global (%)", input("discount", q.discount, "number", "0", "0.01"))}
        ${field("Moneda", select("currency", q.currency, ["EUR", "USD", "GBP", "MXN"]))}
      </div>

      <div class="section-title"><h3>Lineas</h3><div class="line"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="addLine">${icon("plus")} Anadir linea</button></div>
      <div class="panel"><div class="table-wrap"><table id="itemsTable">
        <thead><tr><th>Concepto</th><th>Categoria</th><th>Cant.</th><th>Precio</th>
          <th>Dto.</th><th class="num">Importe</th><th></th></tr></thead>
        <tbody>${(q.items || []).map(itemRow).join("")}</tbody></table></div></div>

      <div id="qTotals" class="panel mt"><div class="panel-body"></div></div>

      <div class="form-grid mt">
        ${field("Notas", textarea("notes", q.notes, null, 3), null, true)}
        ${field("Condiciones", textarea("terms", q.terms, null, 3), null, true)}
      </div>
    </form>`,
    `<button class="btn btn-ghost left" data-close>Cancelar</button>
     <button class="btn btn-soft" id="btnNarr">${icon("sparkles")} Narrativa IA</button>
     <button class="btn btn-primary" id="btnSaveQ">${icon("save")} Guardar</button>`, true);

  const calc = () => {
    const rows = $$("#itemsTable tbody tr");
    let base = 0;
    rows.forEach(tr => {
      const g = f => parseFloat(tr.querySelector(`[data-f="${f}"]`).value) || 0;
      const imp = g("qty") * g("unit_price") * (1 - g("discount") / 100);
      base += imp;
      tr.querySelector(".line-total").textContent = money(imp).replace(/\s/g, " ");
    });
    const disc = base * ((parseFloat($('#qForm [name="discount"]').value) || 0) / 100);
    const net = base - disc;
    const tax = net * ((parseFloat($('#qForm [name="tax_rate"]').value) || 0) / 100);
    const cur = $("#qForm [name='currency']").value;
    $("#qTotals .panel-body").innerHTML =
      `<div style="margin-left:auto;max-width:340px">
        <div class="stat-row"><span>Base imponible</span><b>${money(base, cur)}</b></div>
        <div class="stat-row"><span>Descuento</span><b>-${money(disc, cur)}</b></div>
        <div class="stat-row"><span>Base neta</span><b>${money(net, cur)}</b></div>
        <div class="stat-row"><span>IVA</span><b>${money(tax, cur)}</b></div>
        <div class="stat-row" style="font-size:17px"><span><b>TOTAL</b></span><b>${money(net + tax, cur)}</b></div>
      </div>`;
  };
  $("#itemsTable").addEventListener("input", calc);
  $("#qForm [name='discount']").addEventListener("input", calc);
  $("#qForm [name='tax_rate']").addEventListener("input", calc);
  $("#itemsTable").addEventListener("click", e => {
    if (e.target.closest("[data-delrow]")) { e.target.closest("tr").remove(); calc(); }
  });
  $("#addLine").onclick = () => {
    $("#itemsTable tbody").insertAdjacentHTML("beforeend", itemRow({ qty: 1, unit_price: 0, discount: 0 }));
    calc();
  };
  calc();

  const collect = () => {
    const f = $("#qForm");
    const d = Object.fromEntries(new FormData(f).entries());
    if (d.client_id === "-1" || !d.client_id) d.client_id = null;
    d.items = $$("#itemsTable tbody tr").map(tr => {
      const o = {};
      $$("[data-f]", tr).forEach(i => o[i.dataset.f] = i.value);
      return o;
    }).filter(i => String(i.description || "").trim());
    if (!String(d.title || "").trim()) d.title = "Propuesta comercial";
    return d;
  };

  $("#btnSaveQ").onclick = async () => {
    const btn = $("#btnSaveQ"); btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Guardando...';
    try {
      if (id) await Api.put("/api/quotes/" + id, collect());
      else await Api.post("/api/quotes", collect());
      Modal.close(); toast("Presupuesto guardado", "ok"); go("presupuestos", State.params);
    } catch (e) { toast(e.message, "err"); btn.disabled = false; btn.innerHTML = icon("save") + " Guardar"; }
  };

  $("#btnNarr").onclick = async () => {
    const btn = $("#btnNarr"); btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Generando...';
    try {
      const payload = collect();
      let saved = null;
      if (id) saved = await Api.put("/api/quotes/" + id, payload);
      else saved = await Api.post("/api/quotes", payload);
      const r = await Api.post("/api/ai/quote", { id: saved.id });
      const q2 = await Api.get("/api/quotes/" + saved.id);
      $("#qForm [name='notes']").insertAdjacentHTML("afterend",
        `<div class="field full"><label>Narrativa generada por IA</label>
         <div class="output" style="max-height:260px;overflow:auto">${md(q2.ai_narrative)}</div></div>`);
      toast("Narrativa generada", "ok");
    } catch (e) { toast(e.message, "err"); }
    btn.disabled = false; btn.innerHTML = icon("sparkles") + " Narrativa IA";
  };
}

/* ------------------------------------------------------------ VISTA DETALLE */
async function openDetail(route, id) {
  const cfg = CFG[route];
  if (route === "presupuestos") return openQuoteView(id);
  if (route === "mapa") { return go("mapa", Object.assign({}, State.params, { id })); }
  if (!cfg) return;
  const r = await Api.get(`/api/${cfg.module}/${id}`);
  if (!r) return toast("No encontrado", "err");

  const aiKey = { campanas: "ai_strategy", prompts: "ai_optimized", precios: "ai_analysis",
                  "kit-marca": "logo_concept", analizador: "result", "mi-trabajo": "ai_output" }[route];
  let aiTxt = r[aiKey] || "";
  if (route === "mi-trabajo") {
    try { const o = JSON.parse(aiTxt); aiTxt = o.program || aiTxt; } catch (e) {}
  }

  Modal.open(r.name || r.title || "Detalle", `
    <div class="form-grid mb">
      ${Object.entries(r).filter(([k, v]) => !["ai_output", "params", "params_obj", "output_obj", "content", "result", "logo_concept", "ai_strategy", "ai_analysis", "findings", "results", "palette", "ai_narrative", "notes"].includes(k) && v !== "" && v != null && k !== "id")
        .map(([k, v]) => `<div class="field"><label>${esc(k.replace(/_/g, " "))}</label>
          <div style="font-size:13.5px;${typeof v === "number" ? "" : ""}">${
            typeof v === "number" && v > 999 ? money(v) : esc(String(v).slice(0, 500))}</div></div>`).join("")}
    </div>
    ${r.notes ? `<div class="field mb"><label>Notas</label><div class="output">${md(r.notes)}</div></div>` : ""}
    ${aiTxt ? `<div class="section-title"><h3>Resultado generado por IA</h3><div class="line"></div></div>
      <div class="output">${md(aiTxt)}</div>` : ""}
    ${r.content ? `<div class="section-title"><h3>Contenido analizado</h3><div class="line"></div></div>
      <div class="output"><pre><code>${esc(String(r.content).slice(0, 6000))}</code></pre></div>` : ""}
    ${r.findings && r.findings.length ? `<div class="section-title"><h3>Hallazgos de seguridad</h3><div class="line"></div></div>
      <div class="panel"><div class="table-wrap"><table><thead><tr><th>Severidad</th><th>Hallazgo</th><th>Evidencia</th><th>Recomendacion</th></tr></thead>
      <tbody>${r.findings.map(f => `<tr><td>${badge(f.severity)}</td><td><b>${esc(f.title)}</b></td>
        <td><span class="mono tiny">${esc(f.match)}</span></td><td>${esc(f.advice)}</td></tr>`).join("")}</tbody></table></div></div>` : ""}`,
    `<button class="btn btn-ghost left" data-close>Cerrar</button>
     ${aiTxt ? `<button class="btn btn-ghost" id="btnCopy">${icon("copy")} Copiar resultado</button>` : ""}
     <button class="btn btn-primary" id="btnEditDet">${icon("edit")} Editar</button>`, true);

  $("#btnEditDet").onclick = () => { Modal.close(); openForm(route, id); };
  const bc = $("#btnCopy");
  if (bc) bc.onclick = () => doCopy(aiTxt, "Resultado");
}

async function openQuoteView(id) {
  const q = await Api.get("/api/quotes/" + id);
  if (!q) return toast("No encontrado", "err");
  const t = q.totals || {};
  Modal.open(`Presupuesto ${q.number}`, `
    <div class="flex-between mb">
      <div><h3 style="font-size:16px">${esc(q.title || "Sin titulo")}</h3>
        <p class="muted tiny">Emitido ${esc(q.issue_date || "-")} · Validez ${q.valid_days} dias</p></div>
      ${badge(q.status)}
    </div>
    <div class="panel mb"><div class="table-wrap"><table>
      <thead><tr><th>Concepto</th><th>Categoria</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
      <tbody>${(q.items || []).map(i => `<tr><td>${esc(i.description)}</td><td>${esc(i.category || "-")}</td>
        <td class="num">${Number(i.qty).toLocaleString("es-ES")}</td>
        <td class="num">${money(i.unit_price, q.currency)}</td>
        <td class="num"><b>${money((Number(i.qty) || 0) * (Number(i.unit_price) || 0), q.currency)}</b></td></tr>`).join("")}</tbody>
    </table></div></div>
    <div style="margin-left:auto;max-width:360px" class="panel mb"><div class="panel-body">
      <div class="stat-row"><span>Base</span><b>${money(t.base, q.currency)}</b></div>
      <div class="stat-row"><span>Descuento (${q.discount}%)</span><b>-${money(t.discount, q.currency)}</b></div>
      <div class="stat-row"><span>Neto</span><b>${money(t.net, q.currency)}</b></div>
      <div class="stat-row"><span>IVA (${q.tax_rate}%)</span><b>${money(t.tax, q.currency)}</b></div>
      <div class="stat-row" style="font-size:18px"><span><b>TOTAL</b></span><b>${money(t.total, q.currency)}</b></div>
    </div></div>
    ${q.ai_narrative ? `<div class="section-title"><h3>Narrativa comercial</h3><div class="line"></div></div>
      <div class="output mb">${md(q.ai_narrative)}</div>` : ""}
    ${q.notes ? `<div class="output mb"><b>Notas</b><br>${md(q.notes)}</div>` : ""}`,
    `<button class="btn btn-ghost left" data-close>Cerrar</button>
     <button class="btn btn-ghost" id="btnPdf">${icon("download")} Exportar HTML</button>
     <button class="btn btn-soft" id="btnNarrDet">${icon("sparkles")} Narrativa IA</button>
     <button class="btn btn-primary" id="btnEditQ">${icon("edit")} Editar</button>`, true);

  $("#btnPdf").onclick = () => window.open(`/api/export/quote/${id}`, "_blank");
  $("#btnEditQ").onclick = () => { Modal.close(); openQuoteForm(id); };
  $("#btnNarrDet").onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spin"></span>...';
    try {
      await Api.post("/api/ai/quote", { id });
      Modal.close(); toast("Narrativa generada", "ok"); go("presupuestos", State.params);
    } catch (err) { toast(err.message, "err"); }
    b.disabled = false; b.innerHTML = icon("sparkles") + " Narrativa IA";
  };
}

/* ------------------------------------------------------------ CONSTRUCTOR IA */
function openGenerator() {
  Modal.open("Constructor de programas con IA", `
    <form class="form" id="genForm">
      <div class="form-grid">
        ${field("Nombre del programa *", input("name", "MiPrograma"), "Sin espacios ni acentos")}
        ${field("Tipo de programa", select("type", "web",
            [["web", "Aplicacion web"], ["automatizacion", "Automatizacion / script"], ["dashboard", "Dashboard / informe"],
             ["integracion", "Integracion"], ["movil", "Aplicacion movil"], ["flujo", "Flujo de trabajo interno"]]))}
        ${field("Lenguaje", select("language", "Python",
            ["Python", "JavaScript", "TypeScript", "PHP", "Java", "C#", "Sin codigo"]))}
        ${field("Sector", select("sector", "general", SECTORS.map(s => [s, s])))}
        ${field("Despliegue", select("deployment", "local",
            [["local", "Local / escritorio"], ["nube", "Nube / servidor"], ["hibrido", "Hibrido"], ["movil", "Tienda de apps"]]))}
        ${field("Nivel de acabado", select("budget", "medio",
            [["basico", "Basico / prototipo"], ["medio", "Medio / produccion"], ["alto", "Alto / empresarial"]]))}
      </div>
      ${field("Objetivo del programa *", textarea("objective", "", "Que debe conseguir el programa y quien lo usara..."), "En una frase", true)}
      ${field("Funciones necesarias", textarea("features", "", "citas, pacientes, facturacion, recordatorios", 3),
              "Separadas por comas o saltos de linea. Si las dejas vacias, IASolges propone un juego estandar.", true)}
      ${field("Cliente (opcional)", "<select name='client_id' id='genClient'></select>")}
      <label class="check"><input type="checkbox" name="save" checked> Guardar en Mi Trabajo</label>
    </form>`,
    `<button class="btn btn-ghost left" data-close>Cancelar</button>
     <button class="btn btn-primary" id="btnGen">${icon("sparkles")} Generar programa</button>`, true);

  (async () => {
    const cs = (State.cache.clients ||= await fetchList("clients", { limit: "500" }));
    $("#genClient").innerHTML = '<option value="">- Sin cliente -</option>' +
      cs.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  })();

  $("#btnGen").onclick = async () => {
    const f = $("#genForm");
    const d = Object.fromEntries(new FormData(f).entries());
    if (!String(d.name || "").trim()) return toast("Ponle un nombre al programa", "warn");
    if (!String(d.objective || "").trim()) return toast("Describe el objetivo", "warn");
    const btn = $("#btnGen"); btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Generando programa...';
    Modal.open("Programa generado", `<div class="loading"><span class="spin dark"></span>
      Analizando parametros y redactando el programa...</div>`, "", true);
    try {
      const r = await Api.post("/api/generator/program", {
        params: { name: d.name, type: d.type, language: d.language, sector: d.sector,
                  deployment: d.deployment, budget: d.budget, objective: d.objective, features: d.features },
        save: !!d.save, client_id: d.client_id || null });
      const prog = r.program || "";
      Modal.open("Programa generado - " + d.name, `
        <div class="ai-panel mb"><h3>${icon("check")} Programa generado</h3>
          <p>Especificacion, arquitectura, codigo inicial, plan de pruebas y estimacion economica.</p>
          <div class="flex">
            <button class="btn" id="btnCopyProg">${icon("copy")} Copiar Markdown</button>
            <button class="btn ghost" id="btnDownProg">${icon("download")} Descargar .md</button>
          </div></div>
        <div class="output" id="progOut">${md(prog)}</div>`,
        `<button class="btn btn-ghost left" data-close>Cerrar</button>
         <button class="btn btn-primary" id="btnGoWork">${icon("briefcase")} Ver en Mi Trabajo</button>`, true);
      $("#btnCopyProg").onclick = () => doCopy(prog, "Programa");
      $("#btnDownProg").onclick = () => download(d.name.replace(/\s+/g, "_") + ".md", prog, "text/markdown");
      $("#btnGoWork").onclick = () => { Modal.close(); go("mi-trabajo", {}); };
      toast("Programa generado correctamente", "ok");
    } catch (e) {
      Modal.close();
      toast(e.message, "err");
    }
    btn.disabled = false; btn.innerHTML = icon("sparkles") + " Generar programa";
  };
}

/* ------------------------------------------------------------ ACCIONES IA */
async function runAI(action, host) {
  const cfg = CFG[State.route];
  let payload = {};
  let hostEl = host;

  if (action === "program") { openGenerator(); return; }
  if (action === "__optimize") { return openPromptLab(); }

  if (action === "pricing") {
    Modal.open("Analisis de precios", `<form class="form" id="pForm"><div class="form-grid">
      ${field("Concepto *", input("name", ""))}
      ${field("Sector", select("sector", "general", SECTORS.map(s => [s, s])))}
      ${field("Tipo", select("type", "servicio", ["servicio", "producto", "suscripcion", "paquete"]))}
      ${field("Coste unitario", input("cost", 0, "number", "0", "0.01"))}
      ${field("Precio unitario", input("price", 0, "number", "0", "0.01"))}
      </div><label class="check"><input type="checkbox" name="save" checked> Guardar en Precios</label></form>`,
      `<button class="btn btn-ghost left" data-close>Cancelar</button>
       <button class="btn btn-primary" id="pRun">${icon("sparkles")} Analizar</button>`);
    $("#pRun").onclick = async () => {
      const b = $("#pRun"); b.disabled = true; b.innerHTML = '<span class="spin"></span>...';
      try {
        const r = await Api.post("/api/ai/pricing", Object.fromEntries(new FormData($("#pForm")).entries()));
        Modal.open("Analisis de precios", `<div class="output">${md(r.text)}</div>`,
          `<button class="btn btn-primary" data-close>Cerrar</button>`, true);
      } catch (e) { toast(e.message, "err"); }
      b.disabled = false; b.innerHTML = icon("sparkles") + " Analizar";
    };
    return;
  }

  if (action === "names") {
    Modal.open("Generador de nombres", `<form class="form" id="nForm"><div class="form-grid">
      ${field("Sector", select("sector", "general", SECTORS.map(s => [s, s])))}
      ${field("Estilo", select("style", "mixto", [["mixto", "Mixto"], ["compuesto", "Compuesto"], ["evocativo", "Evocativo"]]))}
      ${field("Cantidad", input("count", 12, "number", "12", "1"))}
      ${field("Palabras clave", input("keywords", "", null, "luz, energia, verde..."))}
      </div><label class="check"><input type="checkbox" name="save" checked> Guardar los nombres generados</label></form>`,
      `<button class="btn btn-ghost left" data-close>Cancelar</button>
       <button class="btn btn-primary" id="nRun">${icon("sparkles")} Generar</button>`);
    $("#nRun").onclick = async () => {
      const b = $("#nRun"); b.disabled = true; b.innerHTML = '<span class="spin"></span> Generando...';
      try {
        const r = await Api.post("/api/ai/names", Object.fromEntries(new FormData($("#nForm")).entries()));
        Modal.open("Nombres generados", `
          <div class="ai-panel mb"><h3>${icon("sparkles")} Propuestas</h3>
            <p>${(r.names || []).length} nombres generados.</p>
            <div class="flex"><button class="btn" id="nCopy">${icon("copy")} Copiar informe</button></div></div>
          <div class="output">${md(r.text)}</div>`,
          `<button class="btn btn-primary" data-close>Cerrar</button>`, true);
        $("#nCopy").onclick = () => doCopy(r.text, "Informe");
      } catch (e) { toast(e.message, "err"); }
      b.disabled = false; b.innerHTML = icon("sparkles") + " Generar";
    };
    return;
  }

  if (action === "brand") {
    Modal.open("Generador de kit de marca", `<form class="form" id="bForm"><div class="form-grid">
      ${field("Nombre de marca *", input("name", ""))}
      ${field("Sector", select("sector", "general", SECTORS.map(s => [s, s])))}
      ${field("Personalidad", select("personality", "autoridad",
          ["autoridad", "proximidad", "innovacion", "elegancia", "diversidad", "urgencia"].map(p => [p, p])))}
      ${field("Audiencia", input("audience", ""))}
      ${field("Valores", input("values", "", null, "cercania, rigor, innovacion"))}
      ${field("Competidores", input("competitors", ""))}
      </div><label class="check"><input type="checkbox" name="save" checked> Guardar en Kit de Marca</label></form>`,
      `<button class="btn btn-ghost left" data-close>Cancelar</button>
       <button class="btn btn-primary" id="bRun">${icon("palette")} Generar marca</button>`);
    $("#bRun").onclick = async () => {
      const b = $("#bRun"); b.disabled = true; b.innerHTML = '<span class="spin"></span> Generando...';
      try {
        const r = await Api.post("/api/ai/brand", Object.fromEntries(new FormData($("#bForm")).entries()));
        Modal.open("Kit de marca - " + $("#bForm [name='name']").value,
          `<div class="output">${md(r.text)}</div>`,
          `<button class="btn btn-ghost" id="bCopy">${icon("copy")} Copiar</button>
           <button class="btn btn-primary" data-close>Cerrar</button>`, true);
        $("#bCopy").onclick = () => doCopy(r.text, "Kit de marca");
      } catch (e) { toast(e.message, "err"); }
      b.disabled = false; b.innerHTML = icon("palette") + " Generar marca";
    };
    return;
  }

  if (action === "analyze") {
    Modal.open("Analizador de contenido", `<form class="form" id="aForm"><div class="form-grid">
      ${field("Titulo", input("title", "Analisis"))}
      ${field("Tipo", select("type", "texto", ["general", "texto", "venta", "estrategia", "documento", "web", "email"]))}
      ${field("Sector", select("sector", "general", SECTORS.map(s => [s, s])))}
      </div>${field("Contenido *", textarea("content", "", "Pega aqui el contenido...", 10), null, true)}</form>`,
      `<button class="btn btn-ghost left" data-close>Cancelar</button>
       <button class="btn btn-primary" id="aRun">${icon("scan")} Analizar</button>`);
    $("#aRun").onclick = async () => {
      const b = $("#aRun"); b.disabled = true; b.innerHTML = '<span class="spin"></span> Analizando...';
      try {
        const r = await Api.post("/api/ai/analyze", Object.fromEntries(new FormData($("#aForm")).entries()));
        Modal.open("Informe de analisis", `<div class="output">${md(r.text)}</div>`,
          `<button class="btn btn-ghost" id="aCopy">${icon("copy")} Copiar</button>
           <button class="btn btn-primary" data-close>Cerrar</button>`, true);
        $("#aCopy").onclick = () => doCopy(r.text, "Informe");
      } catch (e) { toast(e.message, "err"); }
      b.disabled = false; b.innerHTML = icon("scan") + " Analizar";
    };
    return;
  }

  if (action === "prospects") {
    Modal.open("Generador de prospectos", `<form class="form" id="prForm"><div class="form-grid">
      ${field("Sector", select("sector", "general", SECTORS.map(s => [s, s])))}
      ${field("Localidad", input("location", "Madrid"))}
      ${field("Cantidad", input("limit", 15, "number", "15", "1"))}
      </div><label class="check"><input type="checkbox" name="save" checked> Guardar en Prospectores</label></form>`,
      `<button class="btn btn-ghost left" data-close>Cancelar</button>
       <button class="btn btn-primary" id="prRun">${icon("crosshair")} Generar</button>`);
    $("#prRun").onclick = async () => {
      const b = $("#prRun"); b.disabled = true; b.innerHTML = '<span class="spin"></span> Generando...';
      try {
        const r = await Api.post("/api/ai/prospects", Object.fromEntries(new FormData($("#prForm")).entries()));
        Modal.open("Prospectos generados", `<div class="output">${md(r.text)}</div>`,
          `<button class="btn btn-ghost" id="prCopy">${icon("copy")} Copiar</button>
           <button class="btn btn-primary" data-close>Cerrar</button>`, true);
        $("#prCopy").onclick = () => doCopy(r.text, "Prospectos");
      } catch (e) { toast(e.message, "err"); }
      b.disabled = false; b.innerHTML = icon("crosshair") + " Generar";
    };
    return;
  }

  if (action === "campaign") {
    Modal.open("Generador de campañas", `<form class="form" id="cForm"><div class="form-grid">
      ${field("Nombre de la campaña *", input("name", ""))}
      ${field("Objetivo *", input("objective", "", null, "Aumentar la captacion"))}
      ${field("Canal", select("channel", "multicanal", ["multicanal", "email", "linkedin", "seo", "paid", "telefono", "eventos"]))}
      ${field("Sector", select("sector", "general", SECTORS.map(s => [s, s])))}
      ${field("Ciudad", input("city", ""))}
      ${field("Presupuesto (EUR)", input("budget", 0, "number", "0", "0.01"))}
      </div><label class="check"><input type="checkbox" name="save" checked> Guardar en Campañas</label></form>`,
      `<button class="btn btn-ghost left" data-close>Cancelar</button>
       <button class="btn btn-primary" id="cRun">${icon("megaphone")} Generar</button>`);
    $("#cRun").onclick = async () => {
      const b = $("#cRun"); b.disabled = true; b.innerHTML = '<span class="spin"></span> Generando...';
      try {
        const r = await Api.post("/api/ai/campaign", Object.fromEntries(new FormData($("#cForm")).entries()));
        Modal.open("Campaña generada", `
          <div class="section-title"><h3>Estrategia</h3><div class="line"></div></div>
          <div class="output mb">${md(r.strategy)}</div>
          <div class="section-title"><h3>Copy listo para publicar</h3><div class="line"></div></div>
          <div class="output mb">${md(r.copy)}</div>
          <div class="section-title"><h3>Calendario editorial</h3><div class="line"></div></div>
          <div class="output">${md(r.schedule)}</div>`,
          `<button class="btn btn-ghost left" data-close>Cerrar</button>
           <button class="btn btn-ghost" id="cCopy">${icon("copy")} Copiar todo</button>
           <button class="btn btn-primary" data-close>Guardar y cerrar</button>`, true);
        $("#cCopy").onclick = () => doCopy(r.strategy + "\n\n" + r.copy + "\n\n" + r.schedule, "Campaña");
      } catch (e) { toast(e.message, "err"); }
      b.disabled = false; b.innerHTML = icon("megaphone") + " Generar";
    };
    return;
  }

  if (action === "client") {
    Modal.open("Analisis de cliente", `<form class="form" id="clForm"><div class="form-grid">
      ${field("Cliente *", input("name", ""))}
      ${field("Sector", select("sector", "general", SECTORS.map(s => [s, s])))}
      ${field("Tamano", select("size", "", [["", "Sin especificar"], ["1-10", "1-10"], ["11-50", "11-50"], ["51-200", "51-200"], ["10-500", "Mas de 200"]]))}
      ${field("Valor anual (EUR)", input("value", 0, "number", "0", "0.01"))}
      </div></form>`,
      `<button class="btn btn-ghost left" data-close>Cancelar</button>
       <button class="btn btn-primary" id="clRun">${icon("sparkles")} Analizar</button>`);
    $("#clRun").onclick = async () => {
      const b = $("#clRun"); b.disabled = true; b.innerHTML = '<span class="spin"></span> Analizando...';
      try {
        const r = await Api.post("/api/ai/client", Object.fromEntries(new FormData($("#clForm")).entries()));
        Modal.open("Analisis de cliente", `<div class="output">${md(r.text)}</div>`,
          `<button class="btn btn-ghost" id="clCopy">${icon("copy")} Copiar</button>
           <button class="btn btn-primary" data-close>Cerrar</button>`, true);
        $("#clCopy").onclick = () => doCopy(r.text, "Analisis");
      } catch (e) { toast(e.message, "err"); }
      b.disabled = false; b.innerHTML = icon("sparkles") + " Analizar";
    };
    return;
  }

  /* Generador de prompts */
  function openPromptLab() {
    Modal.open("Generador de Prompts", `
      <form class="form" id="plForm">
        <div class="form-grid">
          ${field("Categoria", select("category", "general",
            ["general", "ventas", "marketing", "analisis", "codigo", "estrategia", "contenido"]))}
          ${field("Objetivo", input("objective", "", null, "Escribir un email de venta"))}
        </div>
        ${field("Describe lo que quieres *",
          textarea("template", "", "Ej: quiero un prompt para redactar emails de venta a.controller",
            5),
          "Escribe aqui tu idea con tus palabras. El prompt en codigo se genera solo.", true)}
        <label class="check"><input type="checkbox" id="plAuto" checked>
          Generar automaticamente mientras escribo</label>
      </form>
      <div class="section-title"><h3>Prompt generado en codigo</h3><div class="line"></div>
        <button class="btn btn-ghost btn-sm" id="plCopy1">${icon("copy")} Copiar</button>
        <button class="btn btn-ghost btn-sm" id="plProbar">${icon("play")} Probar</button></div>
      ${textarea("plPrompt", "", "El prompt generado aparecera aqui y podras editarlo", 10, "plPrompt")}
      <div id="plSalida" class="mt"></div>`,
      `<button class="btn btn-ghost left" data-close>Cerrar</button>
       <button class="btn btn-primary" id="plRun">${icon("sparkles")} Generar prompt</button>
       <button class="btn btn-soft" id="plSave">${icon("save")} Guardar en la biblioteca</button>`, true);

    const ta = $("#plForm [name=template]");
    const auto = $("#plAuto");
    ta.oninput = () => { if (auto.checked) PromptLab.alEscribir(ta); };
    $("#plRun").onclick = () => PromptLab.generar({ auto: false });
    $("#plCopy1").onclick = () => doCopy(($("#plPrompt") || {}).value, "Prompt");
    $("#plProbar").onclick = async () => {
      const btn = $("#plProbar"); btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span> Probando...';
      try {
        const r = await Api.post("/api/ai/test_prompt",
          { template: ($("#plPrompt") || {}).value || "" });
        $("#plSalida").innerHTML =
          `<div class="section-title"><h3>Prueba de ejecucion</h3><div class="line"></div></div>
           <div class="output">${md(r.text)}</div>`;
      } catch (e) { $("#plSalida").innerHTML = empty("alert", "Error", e.message); }
      btn.disabled = false; btn.innerHTML = icon("play") + " Probar";
    };
    $("#plSave").onclick = async () => {
      const codigo = ($("#plPrompt") || {}).value || "";
      if (!codigo.trim()) return toast("Genera primero el prompt", "warn");
      try {
        await Api.post("/api/prompts", {
          title: ($("#plForm [name=objective]") || {}).value || "Prompt generado",
          category: ($("#plForm [name=category]") || {}).value || "general",
          template: codigo, description: ($("#plForm [name=template]") || {}).value || "" });
        toast("Guardado en la biblioteca de prompts", "ok");
      } catch (e) { toast(e.message, "err"); }
    };
  }
}

/* ------------------------------------------------------------ EVENTOS */
function wireEvents() {
  document.addEventListener("click", async (e) => {
    const t = e.target;

    const nav = t.closest("[data-nav]");
    if (nav) { e.preventDefault(); go(nav.dataset.nav); return; }

    if (t.closest("[data-close]")) { Modal.close(); return; }
    if (t.closest("#btnMenu")) { $("#sidebar").classList.toggle("open"); return; }
    if (t.closest("#btnQuickAI")) { openGenerator(); return; }
    if (t.closest("#btnHome")) { irAlInicio(); return; }
    if (t.closest("#btnUpdate")) { Update.comprobar(false); return; }
    if (t.closest("#btnAbout")) { mostrarCreditos(); return; }
    if (t.closest("#btnSalir")) { salirDeLaApp(); return; }

    if (t.closest("#btnTheme")) {
      const order = ["azul", "celeste", "morado", "naranja", "elegante"];
      const cur = document.documentElement.dataset.theme || "azul";
      const nx = order[(order.indexOf(cur) + 1) % order.length];
      document.documentElement.dataset.theme = nx;
      Api.post("/api/settings", { theme: nx }).catch(() => {});
      toast("Tema: " + nx, "ok");
      return;
    }

    const cp = t.closest("[data-copy]");
    if (cp) { doCopy(decodeURIComponent(cp.dataset.copy), "Contenido"); return; }

    const aiBtn = t.closest("[data-ai]");
    if (aiBtn) {
      const b = aiBtn; const old = b.innerHTML;
      b.disabled = true; b.innerHTML = '<span class="spin"></span> Generando...';
      try { await runAI(b.dataset.ai, b); }
      catch (e) { toast(e.message, "err"); }
      b.disabled = false; b.innerHTML = old;
      return;
    }

    const mark = t.closest(".marker");
    if (mark) { Geo.alternar(mark.dataset.idx); return; }
    const fila = t.closest("#geoBody tr");
    if (fila && !t.closest("input[type=checkbox]")) { Geo.alternar(fila.dataset.idx); return; }
    if (t.closest("#btnGeoAI")) { Geo.analizar(); return; }
    if (t.closest('[data-act="selAll"]')) { Geo.todos(true); return; }
    if (t.closest('[data-act="selNone"]')) { Geo.todos(false); return; }

    const loc = t.closest("[data-loc]");
    if (loc) { const i = $("#geoForm [name='location']"); if (i) i.value = loc.dataset.loc; return; }

    const act = t.closest("[data-act]");
    if (!act) return;
    const id = act.dataset.id;
    const row = act.closest("tr[data-id]");
    const route = State.route;
    const cfg = CFG[route];

    switch (act.dataset.act) {
      case "new": openForm(route, null); break;
      case "edit": openForm(route, id); break;
      case "view": openDetail(route, id); break;
      case "use": {
        const p = await Api.get(`/api/prompts/${id}`);
        openForm("prompts", null);
        setTimeout(() => { $("#editForm [name='title']").value = p.title + " (copia)";
          $("#editForm [name='template']").value = p.template;
          $("#editForm [name='category']").value = p.category; }, 60);
        break;
      }
      case "open": go("mapa", Object.assign({}, State.params, { id })); break;
      case "star": {
        if (act.dataset.mod) { await Api.post(`/api/${act.dataset.mod}/${id}/star`, {}); }
        else if (route === "favoritos") { await Api.post(`/api/${cfg.module}/${id}/star`, {}); }
        else if (cfg) { await Api.post(`/api/${cfg.module}/${id}/star`, {}); }
        else if (route === "mi-trabajo" || route === "mapa" || route === "seguridad" || route === "presupuestos") {
          const m = { "mi-trabajo": "works", "mapa": "geo_searches", "seguridad": "security_checks", "presupuestos": "quotes" }[route];
          await Api.post(`/api/${m}/${id}/star`, {});
        }
        go(State.route, State.params);
        break;
      }
      case "del": {
        const name = (row && (row.querySelector("b") ? row.querySelector("b").textContent : "")) || "este registro";
        if (!confirm(`¿Eliminar ${name}? Esta accion no se puede deshacer.`)) return;
        const m = cfg ? cfg.module : { "mi-trabajo": "works", "mapa": "geo_searches",
                                       "seguridad": "security_checks", "presupuestos": "quotes" }[route];
        await Api.del(`/api/${m}/${id}`);
        toast("Eliminado", "ok"); go(State.route, State.params);
        break;
      }
      case "narrative":
        try { await Api.post("/api/ai/quote", { id }); toast("Narrativa generada", "ok"); }
        catch (e) { toast(e.message, "err"); }
        break;
      case "exportall": {
        const rows = await fetchList("quotes", { limit: "1000" });
        const csv = ["numero;titulo;cliente;base;iva;total;estado;fecha"].concat(rows.map(r => [
          r.number, (r.title || "").replace(/;/g, ","), (r.client_name || "").replace(/;/g, ","),
          r.totals ? r.totals.base.toFixed(2) : "0", r.totals ? r.totals.tax.toFixed(2) : "0",
          r.totals ? r.totals.total.toFixed(2) : "0", r.status, r.issue_date || ""].join(";"))).join("\n");
        download("presupuestos.csv", csv, "text/csv;charset=utf-8");
        toast("CSV exportado", "ok"); break;
      }
      case "quickai": openGenerator(); break;
      case "limpiar": confirmarLimpieza(act.dataset.target); break;
      case "seed":
        try {
          const r = await Api.post("/api/seed-demo", {});
          toast(r.msg || "Listo", r.seeded ? "ok" : "warn");
          go("inicio", {});
        } catch (e) { toast(e.message, "err"); }
        break;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && Modal.open_) Modal.close();
    if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); $("#globalSearch").focus(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === "q" || e.key === "Q")) {
      e.preventDefault(); salirDeLaApp();
    }
  });

  window.addEventListener("hashchange", () => {
    const r = location.hash.replace("#/", "");
    if (r && r !== State.route) go(r);
  });
}

/* ------------------------------------------------------------ FORMULARIOS DINAMICOS */
const EJEMPLO_SEGURIDAD = [
  '// Configuracion de la API',
  'const apiKey = "sk-live-9f3a2b8c7d1e4f5a6b7c8d9e0f1a2b3c";',
  'const DB_URL = "postgres://admin:S3cret0@10.0.0.14:5432/produccion";',
  '',
  'app.get("/admin", async (req, res) => {',
  '  const id = req.query.id;',
  '  const r = await db.query("SELECT * FROM usuarios WHERE id=" + id);',
  '  res.send("<h1>Hola " + req.query.nombre + "</h1>");',
  '});',
  '',
  'if (DEBUG === true) { console.log("sesion", req.headers.cookie); }',
  'eval(req.body.script);'
].join("\n");



/* ==================== GENERADOR DE PROMPTS ==================== */
const PromptLab = {
  timer: null,
  ultimo: "",

  /* Se escribe la idea y, al parar, se genera el prompt en codigo solo. */
  alEscribir(el) {
    clearTimeout(PromptLab.timer);
    const v = (el.value || "").trim();
    const salida = $("#plSalida");
    if (salida) salida.innerHTML = "";
    if (v.length < 12 || v === PromptLab.ultimo) return;
    PromptLab.timer = setTimeout(() => {
      PromptLab.ultimo = v;
      PromptLab.generar({ auto: true });
    }, 1500);
  },

  async generar(opts) {
    const f = $("#plForm");
    if (!f) return;
    const d = Object.fromEntries(new FormData(f).entries());
    if (String(d.template || "").trim().length < 8) return;
    const salida = $("#plSalida");
    const btn = $("#plRun");
    if (btn && !(opts && opts.auto)) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Generando...'; }
    if (salida) salida.innerHTML = `<div class="loading"><span class="spin dark"></span>
       ${(opts && opts.auto) ? "Generando el prompt a partir de tu idea..." : "Generando..."}</div>`;
    try {
      const r = await Api.post("/api/ai/optimize_prompt", d);
      const ta = $("#plPrompt");
      if (ta && (opts && opts.auto)) ta.value = r.codigo || ta.value;
      if (salida) salida.innerHTML = `<div class="section-title"><h3>Prompt generado</h3>
          <div class="line"></div>
          <button class="btn btn-ghost btn-sm" id="plCopy2">${icon("copy")} Copiar</button></div>
        <div class="output" id="plOut">${md(r.text)}</div>`;
      const c = $("#plCopy2");
      if (c) c.onclick = () => doCopy(($("#plPrompt") || {}).value || r.text, "Prompt");
    } catch (e) {
      if (salida) salida.innerHTML = empty("alert", "Error", e.message);
    }
    if (btn) { btn.disabled = false; btn.innerHTML = icon("sparkles") + " Generar prompt"; }
  },
};

/* ==================== MAPA LOCALIZADOR ==================== */
const Geo = {
  resultados: [],
  seleccion: new Set(),

  /** Rellena "Tipo de negocio" segun el sector, y lo refresca al cambiar. */
  async cargarTipos() {
    const selSec = $("#geoForm [name=sector]");
    const selTipo = $("#geoForm [name=business_type]");
    if (!selSec || !selTipo) return;
    const elegido = selTipo.value;
    selTipo.onchange = null;
    try {
      selSec.onchange = async () => {
        selTipo.innerHTML = "";
        const base = TIPOS_MAPA[selSec.value] || TIPOS_MAPA.general;
        base.forEach(([v, t]) => {
          const o = document.createElement("option");
          o.value = v; o.textContent = t;
          selTipo.appendChild(o);
        });
        await Geo.ampliarTipos();
      };
      // Tipos reales de la zona, si el sector tiene resultados en el mapa.
      await Geo.ampliarTipos(elegido);
    } catch (e) {
      console.warn("tipos de negocio", e);
    }
  },

  /** Anade al desplegable los tipos que el servidor encuentra de verdad. */
  async ampliarTipos(mantener) {
    const selTipo = $("#geoForm [name=business_type]");
    const loc = ($("#geoForm [name=location]") || {}).value;
    const sec = ($("#geoForm [name=sector]") || {}).value;
    if (!selTipo || !loc || !sec) return;
    let tipos = [];
    try { tipos = (await Api.get(`/api/geo/tipos?sector=${encodeURIComponent(sec)}&location=${encodeURIComponent(loc)}`)).tipos || []; }
    catch (e) { return; }
    if (!tipos.length) return;
    const actuales = Array.from(selTipo.options).map(o => o.value);
    const nuevos = tipos.filter(t => !actuales.includes(t) && t);
    if (!nuevos.length) return;
    const sep = document.createElement("optgroup");
    sep.label = "Detectados en la zona";
    nuevos.forEach(t => {
      const o = document.createElement("option");
      o.value = t; o.textContent = t;
      sep.appendChild(o);
    });
    selTipo.appendChild(sep);
    if (mantener) selTipo.value = mantener;
    else if (actuales[0] === "") selTipo.value = "";
  },


  montar(res) {
    Geo.resultados = res || [];
    Geo.seleccion = new Set();
    if (Geo.resultados.length) {
      Geo.seleccion.add(0);
      const chk = document.querySelector('[data-chk="0"]');
      if (chk) chk.checked = true;
    }
    Geo.pintarDetalle(0);
  },

  contador() {
    const c = $("#geoSelCount");
    if (c) c.textContent = Geo.seleccion.size
      ? `${Geo.seleccion.size} seleccionado${Geo.seleccion.size === 1 ? "" : "s"}`
      : "Nada seleccionado";
  },

  marcados() {
    document.querySelectorAll("#geoBody tr").forEach(tr => {
      const i = tr.dataset.idx;
      tr.classList.toggle("sel", Geo.seleccion.has(i));
    });
    document.querySelectorAll(".marker").forEach(m => {
      const sel = Geo.seleccion.has(m.dataset.idx);
      m.style.opacity = Geo.seleccion.size === 0 ? ".45" : (sel ? "1" : ".35");
      m.style.transform = sel ? "scale(1.35)" : "scale(1)";
    });
    Geo.contador();
  },

  alternar(i) {
    if (Geo.seleccion.has(i)) Geo.seleccion.delete(i); else Geo.seleccion.add(i);
    const chk = document.querySelector(`[data-chk="${i}"]`);
    if (chk) chk.checked = Geo.seleccion.has(i);
    Geo.marcados();
    Geo.pintarDetalle(i);
  },

  pintarDetalle(i) {
    const cuerpo = $("#geoDetailBody");
    if (cuerpo) cuerpo.innerHTML = detalleHtml(Geo.resultados[i]);
  },

  todos(v) {
    Geo.seleccion = new Set(v ? Geo.resultados.map((_, i) => String(i)) : []);
    document.querySelectorAll("[data-chk]").forEach(c => { c.checked = v; });
    Geo.marcados();
    if (v) Geo.pintarDetalle(0);
    Geo.contador();
  },

  /** Analiza con IA lo que los resultados seleccionados tienen y lo que les falta. */
  async analizar() {
    const sel = Array.from(Geo.seleccion).map(Number).filter(n => !isNaN(n));
    if (!sel.length) return toast("Selecciona al menos un resultado", "warn");
    const picked = sel.map(i => Geo.resultados[i]).filter(Boolean);
    const btn = $("#btnGeoAI");
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Analizando...'; }
    const salida = $("#geoAI");
    if (salida) salida.innerHTML = `<div class="loading" style="padding:18px">
       <span class="spin dark"></span> Analizando ${picked.length} resultado(s)...</div>`;
    try {
      const r = await Api.post("/api/ai/geo-detail", { resultados: picked });
      if (salida) {
        salida.innerHTML = `
          <div class="section-title" style="margin-top:6px"><h3>Analisis de la seleccion</h3>
            <div class="line"></div>
            <button class="btn btn-ghost btn-sm" id="geoCopyAI">${icon("copy")} Copiar</button></div>
          <div class="output">${md(r.text)}</div>`;
        const cp = $("#geoCopyAI");
        if (cp) cp.onclick = () => doCopy(r.text, "Analisis");
      }
    } catch (e) {
      if (salida) salida.innerHTML = empty("alert", "No se pudo analizar", e.message);
    }
    if (btn) { btn.disabled = false; btn.innerHTML = icon("sparkles") + " Analizar seleccion con IA"; }
  },
};

/* ---------- Chequeo de seguridad: analisis automatico ---------- */
const Security = {
  timer: null,
  ultimo: "",
  enCurso: false,
  cuenta: 0,

  /** Modo elegido: "auto" (analisis solo con IA) o "manual". */
  modo() {
    const m = $("#secForm [name=analisis_mode]");
    return m ? m.value : "auto";
  },

  /** Pinta el aviso de estado segun el modo y lo que este pasando. */
  estado(txt, tono) {
    const c = $("#secEstado");
    if (!c) return;
    c.dataset.modo = tono || Security.modo();
    if (txt) c.querySelector(".sec-modo-txt").innerHTML = txt;
  },

  /** Refresca el aviso con el texto que corresponde al modo actual. */
  refrescarEstado() {
    if (Security.enCurso) {
      Security.estado("<b>Analizando con la IA...</b> Espera un momento.");
      return;
    }
    if (Security.modo() === "manual") {
      Security.estado("<b>Modo manual.</b> No se analiza solo: pega el contenido y pulsa " +
                      "<b>Analizar ahora</b>.");
    } else {
      Security.estado("<b>Automatico con IA activo.</b> Se analiza solo 1,5 s despues de que dejes " +
                      "de escribir. No hace falta que pulses nada.");
    }
  },

  /** Cambia de modo desde el desplegable. */
  cambiarModo() {
    clearTimeout(Security.timer);
    const ta = $("#secForm [name=content]");
    const hay = ta && ta.value.trim().length >= 25;
    if (Security.modo() === "auto") {
      // Al activar el automatico, si ya hay contenido, se analiza de inmediato.
      Security.ultimo = "";
      Security.refrescarEstado();
      if (hay) Security.alCambiar(ta);
    } else {
      Security.refrescarEstado();
      toast("Modo manual: pulsa Analizar ahora cuando quieras", "warn");
    }
  },

  /** Se llama al escribir/pegar: espera a que el usuario pare y lanza el analisis. */
  alCambiar(el) {
    clearTimeout(Security.timer);
    if (Security.modo() !== "auto") { Security.refrescarEstado(); return; }
    const v = (el.value || "").trim();
    if (v.length < 25 || v === Security.ultimo) { Security.refrescarEstado(); return; }
    Security.estado("<b>Automatico con IA:</b> se analizara solo al terminar de escribir...");
    Security.timer = setTimeout(() => {
      Security.ultimo = v;
      ejecutarChequeo({ auto: true });
    }, 1600);
  },

  /** Fuerza el analisis de lo que hay ahora mismo (vale en los dos modos). */
  forzar(auto) {
    clearTimeout(Security.timer);
    Security.ultimo = ($("#secForm [name=content]") || {}).value || "";
    ejecutarChequeo({ auto: !!auto });
  },
};

async function ejecutarChequeo(opts) {
  const f = $("#secForm");
  if (!f) return;
  const d = Object.fromEntries(new FormData(f).entries());
  if (!String(d.content || "").trim()) return;
  const salida = $("#secOut");
  if (opts && opts.auto && salida && salida.dataset.tieneInforme === "1") return;
  Security.enCurso = true;
  Security.refrescarEstado();
  if (salida) {
    salida.dataset.tieneInforme = "0";
    salida.innerHTML = `<div class="panel"><div class="panel-body">
      <div class="loading"><span class="spin dark"></span>
        ${opts && opts.auto ? "Analizando automaticamente con la IA..." : "Analizando riesgos..."}</div>
      </div></div>`;
  }
  try {
    const r = await Api.post("/api/ai/security", d);
    Security.enCurso = false;
    Security.cuenta = (Security.cuenta || 0) + 1;
    Security.refrescarEstado();
    if (!salida) return;
    salida.dataset.tieneInforme = "1";
    salida.innerHTML = pintarInformeSeguridad(r);
    if (!(opts && opts.auto)) toast("Chequeo completado", "ok");
  } catch (err) {
    Security.enCurso = false;
    Security.refrescarEstado();
    if (salida) salida.innerHTML = empty("alert", "Error", err.message);
  }
}

function pintarInformeSeguridad(r) {
  const fs = r.findings || [];
  const por = { critico: 0, alto: 0, medio: 0, bajo: 0 };
  fs.forEach(f => { por[f.severity] = (por[f.severity] || 0) + 1; });
  return `
    <div class="panel mb"><div class="panel-body">
      <div class="flex-between mb">
        <div><span class="k-label">Nivel de riesgo</span>
          <div style="font-size:22px;font-weight:800">${badge(r.risk_level)}</div></div>
        <div style="text-align:right"><span class="k-label">Exposicion</span>
          <div style="font-size:22px;font-weight:800">${r.score}<span class="muted" style="font-size:13px">/100</span></div></div>
      </div>
      <div class="bar mb"><i style="width:${r.score}%"></i></div>
      <div class="chips mb">
        ${por.critico ? `<span class="badge b-err">${por.critico} criticos</span>` : ""}
        ${por.alto ? `<span class="badge b-err">${por.alto} altos</span>` : ""}
        ${por.medio ? `<span class="badge b-warn">${por.medio} medios</span>` : ""}
        ${por.bajo ? `<span class="badge b-info">${por.bajo} bajos</span>` : ""}
        ${!fs.length ? `<span class="badge b-ok">Sin hallazgos</span>` : ""}
      </div>
      ${fs.length ? `<div class="table-wrap" style="max-height:300px;overflow:auto">
        <table><thead><tr><th>Severidad</th><th>Hallazgo</th><th>Evidencia</th><th>Accion</th></tr></thead>
        <tbody>${fs.map((f, i) => `<tr>
          <td>${badge(f.severity)}</td>
          <td><b>${esc(f.title)}</b></td>
          <td><span class="mono tiny">${esc(f.match.slice(0, 70))}</span></td>
          <td class="tiny">${esc(f.advice)}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="muted tiny mb">Ninguna regla se ha activado. El analisis de la IA va igualmente mas alla.</p>`}
    </div></div>
    <div class="panel"><div class="panel-head"><h3>${icon("shield")} Informe de la IA</h3>
      <span class="badge b-info">${esc(r.engine && r.engine.label || "")}</span></div>
      <div class="panel-body"><div class="output" id="secInforme">${md(r.text)}</div></div></div>`;
}

document.addEventListener("submit", async (e) => {
  const f = e.target;
  e.preventDefault();

  if (f.id === "geoForm") {
    const d = Object.fromEntries(new FormData(f).entries());
    $("#geoResult").innerHTML = `<div class="loading"><span class="spin dark"></span>
      Buscando oportunidades y analizando el mercado...</div>`;
    try {
      const r = await Api.post("/api/ai/geo", d);
      $("#geoResult").innerHTML = mapHtml({ location: r.location, radius: r.radius,
        sector: r.sector, results: r.results, analysis: r.analysis,
        center: r.center, real: r.real, fuente: r.fuente });
      GeoPendiente = { id: r.record && r.record.id, results: r.results, analysis: r.analysis || "" };
      Geo.montar(r.results);
      toast(r.results.length + (r.real ? " negocios reales" : " oportunidades de muestra")
            + " en " + r.location, r.real ? "ok" : "warn");
    } catch (er) {
      $("#geoResult").innerHTML = empty("alert", "Error", er.message);
    }
  }

  if (f.id === "secForm") {
    const d = Object.fromEntries(new FormData(f).entries());
    if (!String(d.content || "").trim()) return toast("Pega algo a analizar", "warn");
    // La IA se encarga sola: no hace falta pulsar nada.
    $("#secOut").innerHTML = `<div class="panel"><div class="panel-body">
      <div class="loading"><span class="spin dark"></span> Analizando riesgos...</div></div></div>`;
    try {
      const r = await Api.post("/api/ai/security", d);
      $("#secOut").innerHTML = `
        <div class="panel mb"><div class="panel-body">
          <div class="flex-between mb">
            <div><span class="k-label">Nivel de riesgo</span>
              <div style="font-size:24px;font-weight:800">${badge(r.risk_level)}</div></div>
            <div style="text-align:right"><span class="k-label">Puntuacion</span>
              <div style="font-size:24px;font-weight:800">${r.score}<span class="muted" style="font-size:14px">/100</span></div></div>
          </div>
          <div class="bar"><i style="width:${r.score}%"></i></div>
          <p class="tiny muted mt">${r.findings.length} hallazgo(s) detectado(s).</p>
        </div></div>
        <div class="panel"><div class="panel-head"><h3>${icon("shield")} Informe</h3></div>
          <div class="panel-body"><div class="output">${md(r.text)}</div></div></div>`;
      toast("Chequeo completado", "ok");
    } catch (er) {
      $("#secOut").innerHTML = empty("alert", "Error", er.message);
    }
  }
});

/* ------------------------------------------------------------ SETTINGS */
VIEWS["settings"] = async function () {
  const s = await Api.get("/api/settings");
  const provs = s.providers || {};
  const cur = s.ai_provider || "local";
  const modInfo = await Api.get("/api/modelos").catch(() => ({}));
  if (typeof estadoModelos !== "undefined") estadoModelos.info = modInfo;
  return `
  <div class="page-head"><div><h2>Configuracion</h2>
    <p>Motor de inteligencia artificial, tema y datos de la aplicacion.</p></div></div>

  <div class="grid2 mb">
    <div class="panel"><div class="panel-head"><h3>${icon("sparkles")} Inteligencia Artificial</h3>
      <span class="badge ${s.ai_api_key_set ? "b-ok" : "b-warn"}">${s.ai_api_key_set ? "Con clave" : "Sin clave"}</span></div>
      <div class="panel-body">
        <div class="ai-panel mb"><h3>${icon("cpu")} ${esc(s.ai_provider_info ? s.ai_provider_info.label : cur)}</h3>
          <p>${cur === "local"
            ? "Usas el Motor IA Local integrado: funciona sin conexion y sin claves. Para respuestas de un modelo de lenguaje real, configura un proveedor."
            : "Motor remoto activo. Las respuestas usan el proveedor configurado y, si falla, recurren automaticamente al Motor IA Local."}</p></div>
        <div id="provNote">${modInfo.nota ? `<div class="upd-status warn mb">${icon("info")}<div>
          <b>Nota sobre este proveedor</b><div class="muted tiny">${esc(modInfo.nota)}</div></div></div>` : ""}</div>
        <form class="form" id="setForm">
          <div class="form-grid">
            ${field("Proveedor", select("ai_provider", cur, Object.entries(provs).map(([k, v]) => [k, v.label])))}
            ${field("Modelo *", `<div style="display:flex;flex-direction:column;gap:7px">
                 <select name="ai_model" id="selModelo" data-actual="${esc(s.ai_model)}"></select>
                 <input type="text" name="ai_model_libre" id="inpModeloLibre"
                   placeholder="o escribe el identificador del modelo" style="display:none">
               </div>`, "Se elige de la lista o se escribe a mano")}
            ${field("URL base (opcional)", input("ai_base_url", s.ai_base_url), "Solo para endpoints compatibles")}
            ${field("Clave API", input("ai_api_key", "", "password", s.ai_api_key_hint || "pega tu clave"), "Se guarda cifrada en tu equipo")}
            ${field("Temperatura", input("ai_temperature", s.ai_temperature, "number", "0.7", "0.1"))}
            ${field("Tokens maximos", input("ai_max_tokens", s.ai_max_tokens, "number", "2000", "100"))}
          </div>
          <div class="flex-between mb" id="modelInfo" style="font-size:12px"></div>
          <div class="flex-between">
            <div class="flex">
              <button class="btn btn-primary" type="submit">${icon("save")} Guardar configuracion</button>
              <button class="btn btn-ghost" id="btnReloadModels">${icon("refresh")} Recargar modelos</button>
            </div>
            <span class="tiny muted">Guardado ahora: <b class="mono" id="modelGuardado">${esc(s.ai_model)}</b></span>
          </div>
        </form>
      </div></div>

    <div class="panel"><div class="panel-head"><h3>${icon("settings")} Aplicacion</h3></div>
      <div class="panel-body">
        <form class="form" id="appForm">
          <div class="form-grid">
            ${field("Nombre de la empresa", input("company_name", s.company_name))}
            ${field("Email", input("company_email", s.company_email, "email"))}
            ${field("Telefono", input("company_phone", s.company_phone, "tel"))}
            ${field("Moneda", select("currency", s.currency, ["EUR", "USD", "GBP", "MXN"]))}
            ${field("IVA por defecto (%)", input("tax_rate", s.tax_rate, "number", "21", "0.01"))}
            ${field("Tema", select("theme", s.theme, ["azul", "celeste", "morado", "naranja", "elegante"]))}
          </div>
          <div class="flex"><button class="btn btn-primary" type="submit">${icon("save")} Guardar</button></div>
        </form>
        <div class="section-title"><h3>Informacion</h3><div class="line"></div></div>
        <div class="stat-row"><span>Version</span><b>${esc(s.version)}</b></div>
        <div class="stat-row"><span>Motor activo</span><b>${esc(s.ai_provider_info.label)}</b></div>
        <div class="stat-row"><span>Modelo en uso</span><b class="mono">${esc(s.ai_model_activo || s.ai_model)}</b></div>
        <div class="stat-row"><span>Servidor</span><b class="mono">127.0.0.1</b></div>
        <div class="stat-row"><span>Datos locales</span><b class="mono">~/.local/share/iasolges</b></div>
        <div class="flex mt">
          <button class="btn btn-ghost btn-sm" id="btnBackup">${icon("download")} Descargar copia</button>
          <button class="btn btn-ghost btn-sm" id="btnInfo">${icon("info")} Acerca de</button>
        </div>
      </div></div>
  </div>`;
};

/* ------------------------------------------------------------ INICIO */
function irAlInicio() {
  $("#modSearch") && ($("#modSearch").value = "");
  $("#globalSearch").value = "";
  go("inicio", {});
}
function marcarBotonInicio() {
  $("#btnHome").classList.toggle("on", State.route === "inicio");
}

/* ------------------------------------------------------------ ACTUALIZACIONES */
const Update = {
  estado: null,

  async comprobar(silencioso) {
    const btn = $("#btnUpdate");
    btn.classList.add("busy");
    try {
      const r = await Api.get("/api/update/check");
      Update.estado = r;
      btn.classList.toggle("has-update", !!r.hay_actualizacion);
      Update.pintarBarra();
      if (!silencioso) Update.mostrarDialogo(r);
      return r;
    } catch (e) {
      if (!silencioso) toast("No se pudo comprobar: " + e.message, "err");
      return { ok: false, error: e.message };
    } finally {
      btn.classList.remove("busy");
    }
  },

  pintarBarra() {
    const r = Update.estado || {};
    const bar = $("#updateBar");
    if (!r.hay_actualizacion) { bar.innerHTML = ""; return; }
    bar.innerHTML = `<div class="update-bar">
      <span class="u-ico">${icon("download")}</span>
      <div class="u-txt"><b>Hay una version nueva disponible: v${esc(r.ultima)}</b>
        <span>Tu version es la ${esc(r.actual)}. La actualizacion se instala en un solo paso.</span></div>
      <button class="btn btn-primary" id="btnUpdNow">${icon("download")} Actualizar ahora</button>
      <button class="icon-btn" id="btnUpdLater" title="Ahora no">${icon("x")}</button>
    </div>`;
    $("#btnUpdNow").onclick = () => Update.aplicar();
    $("#btnUpdLater").onclick = () => { $("#updateBar").innerHTML = ""; };
  },

  mostrarDialogo(r) {
    if (!r.ok) {
      Modal.open("Buscar actualizaciones",
        `<div class="upd-status err">${icon("alert")}<div>
          <b>No se pudo consultar GitHub</b><div class="muted tiny">${esc(r.error || "")}</div>
        </div></div>
        <p class="muted tiny">Comprueba tu conexion a Internet e intentalo de nuevo.</p>`,
        `<button class="btn btn-ghost" data-close>Cerrar</button>`, true);
      return;
    }
    if (!r.hay_actualizacion) {
      Modal.open("Buscar actualizaciones",
        `<div class="upd-status ok">${icon("check")}<div>
          <b>Ya tienes la ultima version</b>
          <div class="muted tiny">Version instalada: ${esc(r.actual)}</div></div></div>
         <p class="muted tiny">Comprobado en ${esc(new Date().toLocaleString("es-ES"))} contra
           ${esc(r.repositorio || "")}.</p>`,
        `<button class="btn btn-primary" data-close>Cerrar</button>`, true);
      return;
    }
    Modal.open("Actualizacion disponible",
      `<div class="upd-status warn">${icon("download")}<div>
        <b>Version ${esc(r.ultima)} disponible</b>
        <div class="muted tiny">Tu version es la ${esc(r.actual)}${r.publicado ? " · publicada el " + new Date(r.publicado).toLocaleDateString("es-ES") : ""}</div>
      </div></div>
      ${r.notas ? `<div class="section-title"><h3>Novedades</h3><div class="line"></div></div>
        <div class="output" style="max-height:260px;overflow:auto">${md(r.notas)}</div>` : ""}
      <p class="tiny muted mt">Se descargara el paquete .deb y se instalara con tu contrasena de administrador.</p>`,
      `<button class="btn btn-ghost left" data-close>Ahora no</button>
       <button class="btn btn-ghost" id="uWeb">${icon("globe")} Ver en GitHub</button>
       <button class="btn btn-primary" id="uNow">${icon("download")} Actualizar ahora</button>`, true);
    $("#uNow").onclick = () => Update.aplicar();
    $("#uWeb").onclick = () => window.open(r.url, "_blank");
  },

  async aplicar() {
    const r = Update.estado || {};
    Modal.open("Actualizando IASolges",
      `<div class="loading"><span class="spin dark"></span>
        Descargando el paquete y preparandolo para instalar...</div>`, "", true);
    try {
      const res = await Api.post("/api/update/apply", { url: r.paquete || "" });
      if (res.ok) {
        Modal.open("Actualizacion completada",
          `<div class="upd-status ok">${icon("check")}<div>
            <b>IASolges se ha actualizado correctamente</b>
            <div class="muted tiny">${esc((res.salida || "").slice(-400))}</div></div></div>
           <p class="muted tiny">Cierra la aplicacion y vuelve a abrirla para usar la nueva version.</p>`,
          `<button class="btn btn-primary" id="uClose">Cerrar IASolges</button>`, true);
        $("#uClose").onclick = () => { Modal.close(); window.close(); location.reload(); };
      } else if (res.metodo === "manual") {
        Modal.open("Instalacion manual",
          `<p>La instalacion automatica no esta disponible en este equipo.</p>
           <p class="muted tiny">Ejecuta este comando en una terminal:</p>
           <div class="output mono" style="margin-top:10px">${esc(res.comando || res.salida || "")}</div>
           <p class="muted tiny mt">Despues reinicia IASolges para aplicar los cambios.</p>`,
          `<button class="btn btn-ghost" id="uCopyCmd">${icon("copy")} Copiar comando</button>
           <button class="btn btn-primary" data-close>Cerrar</button>`, true);
        $("#uCopyCmd").onclick = () => doCopy(res.comando || res.salida || "", "Comando");
      } else {
        Modal.open("No se pudo actualizar",
          `<div class="upd-status err">${icon("alert")}<div>
            <b>La instalacion fallo</b>
            <div class="muted tiny">${esc((res.salida || res.error || "").slice(-500))}</div></div></div>`,
          `<button class="btn btn-primary" data-close>Cerrar</button>`, true);
      }
    } catch (e) {
      Modal.open("No se pudo actualizar",
        `<div class="upd-status err">${icon("alert")}<div>
          <b>Error al actualizar</b><div class="muted tiny">${esc(e.message)}</div></div></div>`,
        `<button class="btn btn-primary" data-close>Cerrar</button>`, true);
    }
  },

  /* Comprobacion automatica al arrancar y cada 6 horas. */
  arrancar() {
    setTimeout(() => Update.comprobar(true), 2500);
    setInterval(() => Update.comprobar(true), 6 * 60 * 60 * 1000);
  },
};

/* ------------------------------------------------------------ CREDITOS */
async function mostrarCreditos() {
  let c = {};
  try { c = await Api.get("/api/credits"); } catch (e) {}
  const nombre = c.nombre || "Jose Manuel Bernabeu Mejias";
  const dir = c.direccion || "Medico Rafael Navarro 2, 2C\nNovelda, 03660 Alicante\nEspana";
  Modal.open("Acerca de IASolges", `
    <div class="credits">
      <div class="cr-mark">IA</div>
      <div class="cr-name">${esc(nombre)}</div>
      <div class="cr-role">Autor y desarrollador de IASolges</div>

      <div class="cr-box">
        <div class="row">${icon("pin")}<div><div class="k">Domicilio</div>
          <div class="v">${esc(dir)}</div></div></div>
        <div class="row">${icon("file-text")}<div><div class="k">Licencia</div>
          <div class="v">MIT &middot; ${esc(c.copyright || "(c) " + new Date().getFullYear() + " " + nombre)}</div></div></div>
        <div class="row">${icon("globe")}<div><div class="k">Repositorio</div>
          <div class="v mono">github.com/${esc(c.repositorio || "JMBermejias/IASolges")}</div></div></div>
        <div class="row">${icon("cpu")}<div><div class="k">Version</div>
          <div class="v">${esc(c.version || "1.0.0")}</div></div></div>
      </div>

      <div class="cr-copy">
        <span class="lic-badge">${icon("check", 12)} Software libre bajo licencia MIT</span>
        <div style="margin-top:12px">
         IASolges &copy; ${esc((c.copyright || "").replace(/^\(c\)\s*/i, ""))}<br>
          Software de gestion comercial con inteligencia artificial.<br>
          Este software se distribuye tal cual, sin garantia de ningun tipo.
        </div>
      </div>
    </div>`,
    `<button class="btn btn-ghost left" id="crLic">${icon("file-text")} Ver licencia</button>
     <button class="btn btn-primary" data-close>Cerrar</button>`, true);

  $("#crLic").onclick = () => {
    Modal.open("Licencia MIT", `<div class="output"><pre><code>${esc(LICENCIA_MIT)}</code></pre></div>`,
      `<button class="btn btn-ghost" id="crCopy">${icon("copy")} Copiar</button>
       <button class="btn btn-primary" data-close>Cerrar</button>`, true);
    $("#crCopy").onclick = () => doCopy(LICENCIA_MIT, "Licencia");
  };
}

const LICENCIA_MIT = `MIT License

Copyright (c) ${new Date().getFullYear()} Jose Manuel Bernabeu Mejias
Medico Rafael Navarro 2, 2C
Novelda, 03660 Alicante, Espana

Se concede permiso, de forma gratuita, a cualquier persona que obtenga una copia
de este software y de los archivos de documentacion asociados (el "Software"),
a utilizar el Software sin restricciones, incluyendo sin limitacion los derechos
a usar, copiar, modificar, fusionar, publicar, distribuir, sublicenciar y/o vender
copias del Software, y a permitir a las personas a quienes se les proporcione el
Software a hacer lo mismo, sujeto a las siguientes condiciones:

El aviso de copyright anterior y este aviso de permiso se incluiran en todas las
copias o partes sustanciales del Software.

EL SOFTWARE SE PROPORCIONA "COMO ESTA", SIN GARANTIA DE NINGUN TIPO, EXPRESA O
IMPLICITA, INCLUIDAS PERO NO LIMITADAS A LAS GARANTIAS DE COMERCIALIZACION,
IDONEIDAD PARA UN PROPOSITO PARTICULAR E INCUMPLIMIENTO. EN NINGUN CASO LOS
AUTORES O TITULARES DEL COPYRIGHT SERAN RESPONSABLES DE NINGUNA RECLAMACION,
DAÑOS U OTRAS RESPONSABILIDADES, YA SEA EN UNA ACCION CONTRACTUAL, AGRAVIO O
CUALQUIER OTRO MOTIVO, DERIVADAS DE, FUERA DE O EN CONEXION CON EL SOFTWARE O SU
USO U OTRO TIPO DE ACCIONES EN EL SOFTWARE.`;

/* ------------------------------------------------------------ SALIR */
function salirDeLaApp() {
  Modal.open("Salir de IASolges", `
    <p>Se cerrara la aplicacion y se detendra el servidor local.</p>
    <p class="muted tiny">Tus datos quedan guardados en la carpeta de trabajo y
      volveran a estar disponibles la proxima vez que abras IASolges.</p>`,
    `<button class="btn btn-ghost left" data-close>Cancelar</button>
     <button class="btn btn-danger" id="btnSalirOk">${icon("power")} Salir</button>`, true);

  $("#btnSalirOk").onclick = async () => {
    const b = $("#btnSalirOk");
    b.disabled = true;
    b.innerHTML = '<span class="spin"></span> Cerrando...';
    // Pantalla de despedida: el servidor caera en cualquier momento.
    Modal.open("IASolges", `
      <div class="loading" style="flex-direction:column;height:280px">
        <div class="boot-logo" style="animation:none">IA</div>
        <p class="muted">Cerrando IASolges...</p>
      </div>`, "", true);
    try { await Api.post("/api/shutdown", {}); } catch (e) { /* el servidor cae */ }
    // Si sigue vivo (navegador), se avisa y se ofrece recargar.
    setTimeout(() => {
      const fuera = Modal.open ? true : false;
      document.body.innerHTML =
        '<div style="height:100vh;display:grid;place-content:center;justify-items:center;gap:14px;'
        + 'font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F5F8FA;color:#33475B;text-align:center">'
        + '<div style="width:64px;height:64px;border-radius:18px;display:grid;place-items:center;'
        + 'background:#47637C;color:#fff;font-weight:800;font-size:24px">IA</div>'
        + '<h2 style="font-size:17px">IASolges se ha cerrado</h2>'
        + '<p style="font-size:13px;color:#5F7689;max-width:340px">Puedes cerrar esta pestana con seguridad.</p>'
        + '</div>';
    }, 1600);
  };
}

/* ------------------------------------------------------------ LIMPIEZA DE PANELES */
const LIMPIEZA = {
  activity: {
    titulo: "Limpiar actividad reciente",
    icono: "clock",
    cuerpo: "Se borraran todos los registros del historial de actividad del panel de inicio.",
    aviso: "Es solo un registro de acciones: no afecta a clientes, contactos ni ningun dato de negocio.",
    boton: "Vaciar actividad",
    peligro: false,
  },
  works: {
    titulo: "Limpiar trabajos recientes",
    icono: "briefcase",
    cuerpo: "Se eliminaran TODOS los trabajos de Mi Trabajo.",
    aviso: "Esto borra datos reales y no se puede deshacer. Descarga lo que necesites antes de continuar.",
    boton: "Eliminar trabajos",
    peligro: true,
  },
  chart: {
    titulo: "Reiniciar grafico de crecimiento",
    icono: "trending",
    cuerpo: "El grafico pasara a mostrar solo el mes actual.",
    aviso: "No se borra ningun registro: solo cambia la ventana de tiempo que se representa.",
    boton: "Reiniciar grafico",
    peligro: false,
  },
};

async function confirmarLimpieza(target) {
  const c = LIMPIEZA[target];
  if (!c) return;
  // Cuantas filas hay ahora mismo, para decirlo con numeros.
  let avisoExtra = "";
  try {
    const d = await Api.get("/api/dashboard");
    if (target === "activity") avisoExtra = `Hay ${(d.activity || []).length} entradas visibles.`;
    if (target === "works") avisoExtra = `Hay ${d.trabajos || 0} trabajos registrados.`;
  } catch (e) { /* seguimos sin el dato */ }

  Modal.open(c.titulo, `
    <div class="upd-status ${c.peligro ? "warn" : ""}">${icon(c.icono)}<div><b>${esc(c.cuerpo)}</b>
      ${avisoExtra ? `<div class="muted tiny">${esc(avisoExtra)}</div>` : ""}</div></div>
    <p class="tiny muted">${esc(c.aviso)}</p>`,
    `<button class="btn btn-ghost left" data-close>Cancelar</button>
     <button class="btn ${c.peligro ? "btn-danger" : "btn-primary"}" id="btnDoClear">
       ${icon("eraser")} ${esc(c.boton)}</button>`, true);

  $("#btnDoClear").onclick = async () => {
    const b = $("#btnDoClear"); b.disabled = true;
    b.innerHTML = '<span class="spin"></span> Limpiando...';
    try {
      const r = await Api.post("/api/dashboard/clear", { target });
      if (r.ok) {
        Modal.close();
        toast(r.mensaje, "ok");
        go("inicio", {});
      } else {
        toast(r.error || "No se pudo limpiar", "err");
      }
    } catch (e) {
      toast(e.message, "err");
    }
    b.disabled = false;
    b.innerHTML = icon("eraser") + " " + c.boton;
  };
}

/* ==================== SELECTOR DE MODELOS ==================== */
const OPCION_LIBRE = "__libre__";
let estadoModelos = { info: {} };

function pintarModelos(info, actual) {
  const sel = $("#selModelo");
  const libre = $("#inpModeloLibre");
  if (!sel) return;
  const lista = [];
  const meter = (id, nombre, grupo) => {
    if (!id || lista.some(x => x.id === id)) return;
    lista.push({ id, nombre: nombre || id, grupo });
  };
  (info.sugeridos || []).forEach(m => meter(m.id, m.nombre, "Sugeridos"));
  (info.remoto || []).forEach(m => meter(m.id, m.nombre, "Del proveedor"));
  sel.innerHTML = "";
  let grupo = "";
  lista.forEach(m => {
    if (m.grupo !== grupo) {
      grupo = m.grupo;
      const g = document.createElement("optgroup");
      g.label = grupo;
      sel.appendChild(g);
    }
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.id === m.nombre ? m.id : `${m.nombre}  (${m.id})`;
    sel.appendChild(o);
  });
  const libreOpt = document.createElement("option");
  libreOpt.value = OPCION_LIBRE;
  libreOpt.textContent = "+ Escribir otro modelo a mano...";
  sel.appendChild(libreOpt);
  const actualVisible = lista.some(m => m.id === actual);
  sel.value = actualVisible ? actual : OPCION_LIBRE;
  if (actualVisible) libre.value = "";          // manda el desplegable
  else if (actual) libre.value = actual;       // modelo propio: va en el campo
  libre.style.display = sel.value === OPCION_LIBRE ? "" : "none";

  const info2 = $("#modelInfo");
  if (info2) {
    const err = info.error;
    info2.innerHTML = err
      ? `<span class="badge b-warn">${icon("alert", 10)} Sin catalogo remoto</span>
         <span class="tiny muted">${esc(err)}</span>`
      : `<span class="badge b-ok">${icon("check", 10)} ${lista.length} modelos</span>`;
  }
}

async function recargarModelos(proveedor) {
  const info = await Api.get("/api/modelos", { proveedor }).catch(() => ({ sugeridos: [], remoto: [] }));
  estadoModelos.info = info;
  const libre = $("#setForm [name=ai_model_libre]");
  pintarModelos(info, (libre && libre.value) || ($("#selModelo") || {}).value || "");
  const nota = $("#provNote");
  if (nota) nota.innerHTML = info.nota
    ? `<div class="upd-status warn mb">${icon("info")}<div><b>Nota</b>
       <div class="muted tiny">${esc(info.nota)}</div></div></div>` : "";
}


/* ---------- arranque del selector de modelos en Configuracion ---------- */
function initSelectorModelos() {
  if (typeof pintarModelos !== "function") return;
  const sel = $("#selModelo");
  if (!sel) return;
  pintarModelos(estadoModelos.info || {}, sel.dataset.actual || "");
  const selProv = $("#setForm [name=ai_provider]");
  if (selProv) selProv.onchange = () => recargarModelos(selProv.value);
  const libre = $("#inpModeloLibre");
  sel.onchange = () => {
    if (!libre) return;
    libre.style.display = sel.value === OPCION_LIBRE ? "" : "none";
    // Si se elige uno de la lista, el campo manual deja de mandar.
    if (sel.value !== OPCION_LIBRE) libre.value = "";
  };
}

/* ---------- Indicador del motor con el modelo en uso ---------- */
function pintarMotor(info) {
  if (!info) return;
  const box = $("#engineBox"), nom = $("#engineName"), mod = $("#engineModel");
  const corto = String(info.label || "").split("(")[0].trim();
  if (nom) nom.textContent = corto;
  if (mod) mod.textContent = info.model ? String(info.model) : "";
  if (box) {
    box.classList.toggle("remote", info.provider !== "local");
    box.title = `Motor: ${info.label}\nModelo: ${info.model || "-"}\n`
              + `Temperatura: ${info.temperature ?? "-"}`;
  }
}

/** Arregla busquedas guardadas cuyo analisis es un volcado JSON de una version
 *  antigua, en vez del informe en Markdown. Se regenera y se guarda. */
async function repararAnalisisGeo(pend) {
  const roto = /^\s*[{[]/.test(String(pend.analysis || ""));
  if (!roto || !pend.results || !pend.results.length) return;
  try {
    const r = await Api.post("/api/ai/geo-detail", { resultados: pend.results.slice(0, 40) });
    const salida = $("#geoResult .output");
    if (salida) salida.innerHTML = md(r.text);
    await Api.put("/api/geo_searches/" + pend.id, { ai_analysis: r.text });
    toast("Analisis del mercado regenerado", "ok");
  } catch (e) {
    console.warn("no se pudo reparar el analisis", e);
  }
}

/* ------------------------------------------------------------ BOOT */
async function boot() {
  try {
    const ping = await Api.get("/api/ping");
    State.engine = ping.ai || State.engine;
    pintarMotor(State.engine);
    $("#brandVer").textContent = "v" + ping.version;
    const st = await Api.get("/api/settings");
    if (st.theme) document.documentElement.dataset.theme = st.theme;
    if (st.company_name) $("#pageSub").textContent = st.company_name;
  } catch (e) {
    $("#boot").innerHTML = `<div style="max-width:420px;text-align:center">
      <h2 style="margin-bottom:8px">No se pudo conectar</h2>
      <p style="opacity:.85">${esc(e.message)}</p></div>`;
    return;
  }

  buildNav();
  pintarIconos();
  wireEvents();

  const r = location.hash.replace("#/", "");
  await go(VIEWS[r] ? r : "inicio");
  Update.arrancar();

  $("#boot").remove();
  $("#layout").hidden = false;


  $("#globalSearch").addEventListener("input", debounce(function () {
    State.params.q = State.params.q || {};
    if (this.value) State.params.q.search = this.value; else delete State.params.q.search;
    go(State.route, State.params);
  }, 400));

  // formularios de settings (delegados)
  document.addEventListener("submit", async (e) => {
    const f = e.target;
    if (f.id !== "setForm" && f.id !== "appForm") return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f).entries());
    if (f.id === "setForm") {
      // Solo cuenta el campo libre si se eligio la opcion de escribirlo a mano.
      // Antes se aplicaba siempre y machacaba la eleccion del desplegable.
      const sel = f.querySelector("[name=ai_model]");
      const libre = String(d.ai_model_libre || "").trim();
      if (sel && sel.value === OPCION_LIBRE) d.ai_model = libre;
      else if (sel) d.ai_model = sel.value;
      delete d.ai_model_libre;
      if (d.ai_provider !== "local" && !d.ai_api_key) delete d.ai_api_key;
      if (!d.ai_model || d.ai_model === OPCION_LIBRE) {
        toast("Elige un modelo de la lista o escribilo a mano", "warn");
        return;
      }
    }
    try {
      await Api.post("/api/settings", d);
      toast("Guardado - modelo: " + (d.ai_model || "-"), "ok");
      const ping = await Api.get("/api/ping");
      State.engine = ping.ai;
      pintarMotor(ping.ai);
      $("#engineBox").classList.toggle("remote", ping.ai.provider !== "local");
      if (f.id === "appForm" && d.theme) document.documentElement.dataset.theme = d.theme;
      if (f.id === "setForm") {
        // Tras guardar, el catalogo se vuelve a pedir con la clave ya en su sitio.
        estadoModelos.info = await Api.get("/api/modelos").catch(() => ({}));
        const sel2 = $("#selModelo");
        if (sel2) { sel2.dataset.actual = d.ai_model; pintarModelos(estadoModelos.info, d.ai_model); }
        const inf2 = $("#modelGuardado");
        if (inf2) inf2.textContent = d.ai_model || "-";
      }
    } catch (err) { toast(err.message, "err"); }
  });

  document.addEventListener("click", async (e) => {
    if (e.target.closest("#btnReloadModels")) {
      go("settings", State.params);
      toast("Modelos recargados del proveedor", "ok");
      return;
    }
    if (e.target.closest("#btnBackup")) {
      try {
        const r = await Api.get("/api/backup");
        download("iasolges-backup.json", JSON.stringify(r, null, 2), "application/json");
      } catch (err) { toast(err.message, "err"); }
    }
    if (e.target.closest("#btnInfo")) {
      Modal.open("Acerca de IASolges", `<div class="output">${md(
`# IASolges v${State.version || "1.0.0"}

**Plataforma de inteligencia artificial** para la gestion comercial y la
generacion automatica de programas personalizados.

## Modulos

- **Plataforma:** Inicio, Mi Trabajo, Clientes, Contactos, Campañas, Favoritos
- **Flujo de Trabajo:** Mapa Localizador, Generador de Prompts, Chequeo de Seguridad, Precios, Prospectores
- **Adicionales:** Nombres, Kit de Marca, Analizador, Presupuestos

## Inteligencia artificial

- **Motor IA Local** integrado: funciona sin conexion y sin claves.
- Proveedores remotos: OpenAI, OpenRouter, DeepSeek, Anthropic y Ollama.
- Si el proveedor remoto falla, la app cae automaticamente al motor local.

## Privacidad

Todos los datos se guardan **localmente** en SQLite en
\`~/.local/share/iasolges/iasolges.db\`. Nada sale de tu equipo salvo que
configures un proveedor de IA remoto.`)}</div>`,
        `<button class="btn btn-primary" data-close>Cerrar</button>`, true);
    }
  });
}

document.addEventListener("DOMContentLoaded", boot);
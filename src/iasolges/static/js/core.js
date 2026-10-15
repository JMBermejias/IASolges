/* ============================================================
   IASolges - Nucleo: iconos, API, utilidades, componentes
   ============================================================ */
"use strict";

/* ------------------------------------------------------------ ICONOS */
const ICONS = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  briefcase:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M2 13h20"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1"/><path d="M17.5 14.4A6.5 6.5 0 0 1 21.5 20"/>',
  "user-check":'<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="m16 12.5 2 2 4-4"/>',
  megaphone:'<path d="M3 11v2a2 2 0 0 0 2 2h2l9 5V4L7 9H5a2 2 0 0 0-2 2Z"/><path d="M19 9a3 3 0 0 1 0 6"/>',
  star:'<path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9L6.7 19.6l1.1-6L3.4 9.4l6-.8Z"/>',
  map:'<path d="m9 3 6 3 5-2v14l-5 2-6-3-5 2V5Z"/><path d="M9 3v14M15 6v14"/>',
  terminal:'<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="m6.5 9 3 3-3 3M12.5 15h5"/>',
  shield:'<path d="M12 2.5 4 5.5v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10v-6Z"/><path d="m9 12 2 2 4-4"/>',
  tag:'<path d="M2.5 11.6V3.5a1 1 0 0 1 1-1h8.1a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-7.5 7.5a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4Z"/><circle cx="7" cy="7" r="1.4"/>',
  crosshair:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5-1-1.8-1-3 0-1 .8-1.6 2-1.6h1.5A4.5 4.5 0 0 0 21 10c0-4-4-7-9-7Z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10" cy="7.5" r="1.1"/><circle cx="15" cy="8.5" r="1.1"/>',
  sparkles:'<path d="M12 3.2 13.7 9l5.8 1.7-5.8 1.7L12 18.2 10.3 12.4 4.5 10.7 10.3 9Z"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z"/>',
  scan:'<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M3 12h18"/>',
  "file-text":'<path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2.5v5h5"/><path d="M9 13h6M9 17h4"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  trash:'<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  send:'<path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trending:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  euro:'<path d="M18.5 5.5A7.5 7.5 0 0 0 7 12a7.5 7.5 0 0 0 11.5 6.5"/><path d="M4 10h9M4 14h8"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  layers:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  cpu:'<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  book:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22Z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',
  play:'<path d="m6 3 14 9-14 9Z"/>',
  power:'<path d="M12 3v9"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  eraser:'<path d="m4 20 9-9"/><path d="M11 5 19 13a2 2 0 0 1 0 3l-5 5H8l-4-4 11-11a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3Z"/><path d="m6 12 6 6"/>',
  rocket:'<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.7-.7.7-2 0-3s-2.3-.7-3 0Z"/><path d="M9.5 14.5 15 9l4-4c1.5-1.5 4-1 4-1s.5 2.5-1 4l-4 4-5.5 5.5"/><path d="m14 8-3 3M12.5 5.5 15 8"/>',
};

function icon(name, size) {
  const p = ICONS[name] || ICONS.info;
  const s = size ? ` width="${size}" height="${size}"` : "";
  return `<svg viewBox="0 0 24 24"${s} aria-hidden="true">${p}</svg>`;
}

/* ------------------------------------------------------------ UTILS */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function money(n, cur) {
  cur = cur || "EUR";
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: cur, maximumFractionDigits: 2
  }).format(Number(n) || 0);
}
function num(n) { return new Intl.NumberFormat("es-ES").format(Number(n) || 0); }
function today() { return new Date().toISOString().slice(0, 10); }

function ago(iso) {
  if (!iso) return "";
  const d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return Math.floor(s / 60) + " min";
  if (s < 86400) return Math.floor(s / 3600) + " h";
  if (s < 604800) return Math.floor(s / 86400) + " d";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

function debounce(fn, ms) {
  let t; return function () { clearTimeout(t); const a = arguments, c = this;
    t = setTimeout(() => fn.apply(c, a), ms || 260); };
}

/* ------------------------------------------------------------ API */
const Api = {
  async req(method, path, body) {
    const opt = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) opt.body = JSON.stringify(body);
    let r;
    try {
      r = await fetch(path, opt);
    } catch (e) {
      throw new Error("No se pudo contactar con el servidor local.");
    }
    const ct = r.headers.get("content-type") || "";
    const data = ct.includes("json") ? await r.json() : await r.text();
    if (!r.ok) throw new Error((data && data.error) || `Error HTTP ${r.status}`);
    return data;
  },
  get(p, q)      { return this.req("GET", p + (q ? "?" + new URLSearchParams(q) : "")); },
  post(p, b)     { return this.req("POST", p, b || {}); },
  put(p, b)      { return this.req("PUT", p, b || {}); },
  del(p)         { return this.req("DELETE", p); },
  star(p, id)    { return this.req("PATCH", `${p}/${id}/star`); },
  list(p, q)     { return this.get(p, q); },
};

/* ------------------------------------------------------------ TOASTS */
function toast(msg, kind) {
  const el = document.createElement("div");
  el.className = "toast " + (kind || "");
  const ic = kind === "ok" ? "check" : kind === "err" ? "alert" : "info";
  el.innerHTML = icon(ic) + "<span>" + esc(msg) + "</span>";
  $("#toasts").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = ".3s";
    setTimeout(() => el.remove(), 300); }, 3400);
}

/* ------------------------------------------------------------ MODAL */
const Modal = {
  open(title, body, foot, wide) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = body;
    $("#modalFoot").innerHTML = foot || '<button class="btn btn-ghost" data-close>Cerrar</button>';
    $(".modal").classList.toggle("wide", !!wide);
    $("#modalRoot").hidden = false;
  },
  close() { $("#modalRoot").hidden = true; $("#modalBody").innerHTML = ""; },
  get open_() { return !$("#modalRoot").hidden; },
};

/* ------------------------------------------------------------ MARKDOWN */
function md(src) {
  if (!src) return '<p class="muted">Sin contenido.</p>';
  const esc2 = esc(src);
  // bloques de codigo primero
  const blocks = [];
  let s = esc2.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
    blocks.push(code.trim());
    return " CODE" + (blocks.length - 1) + " ";
  });
  s = s.replace(/^### (.*)$/gm, "<h3>$1</h3>")
       .replace(/^## (.*)$/gm, "<h2>$1</h2>")
       .replace(/^# (.*)$/gm, "<h1>$1</h1>")
       .replace(/^---$/gm, "<hr>")
       .replace(/^(\s*)[-*] (.*)$/gm, "<li>$2</li>")
       .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>")
       .replace(/^(\s*)(\d+)\. (.*)$/gm, function (m, sp, n, t) { return "<li>" + t + "</li>"; })
       .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ol>$1</ol>")
       .replace(/^\|?(.*)\|(.*)$/gm, function (m) {
         const cells = m.split("|").slice(1, -1).map(c => c.trim());
         if (cells.every(c => /^:?-{2,}:?$/.test(c))) return " TB ";
         return " TR " + cells.join(" ");
       });
  // reconstruye tablas
  const lines = s.split("\n");
  let out = [], inTable = false;
  for (const ln of lines) {
    if (ln.startsWith(" TR ")) {
      const cells = ln.slice(4).split(" ");
      if (!inTable) { out.push("<table><thead><tr>" + cells.map(c => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>"); inTable = true; }
      else out.push("<tr>" + cells.map(c => "<td>" + c + "</td>").join("") + "</tr>");
      continue;
    }
    if (ln === " TB ") continue;
    if (inTable) {
      // dentro de una tabla las lineas vacias no deben producir <br>
      if (!ln.trim()) continue;
      out.push("</tbody></table>"); inTable = false;
    }
    out.push(ln);
  }
  if (inTable) out.push("</tbody></table>");
  s = out.join("\n");
  // inline
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>")
       .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
       .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
       .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // restaura bloques de codigo antes de unir lineas
  s = s.replace(/ CODE(\d+) /g, (m, i) => "<pre><code>" + blocks[+i] + "</code></pre>");
  s = s.replace(/^&gt;\s*(.*)$/gm, "<blockquote>$1</blockquote>");
  // une con <br> solo las lineas que no son bloques
  const BLOCK = /^(<h1|<h2|<h3|<hr|<ul|<ol|<li|<table|<tbody|<thead|<tr|<th|<td|<\/table>|<\/ul>|<\/ol>|<\/blockquote>|<pre)/;
  const ls = s.split("\n").filter(l => l.trim() !== "");
  s = ls.map((l, i) => (BLOCK.test(l) || i === ls.length - 1) ? l : l + "<br>").join("");
  if (!/^<(h1|h2|h3|p|ul|ol|table|pre|blockquote|hr)/.test(s)) s = "<p>" + s + "</p>";
  return s;
}

/* ------------------------------------------------------------ UI HELPERS */
function empty(iconName, title, text, actionHtml) {
  return `<div class="empty"><div class="e-ico">${icon(iconName)}</div>
    <h4>${esc(title)}</h4><p>${esc(text || "")}</p>${actionHtml || ""}</div>`;
}

function badgeClass(v) {
  const s = String(v || "").toLowerCase();
  if (["activo", "aprobado", "cliente", "completado", "alta", "limpio", "enviado"].includes(s)) return "b-ok";
  if (["pendiente", "borrador", "potencial", "media", "en_proceso", "lead", "medio", "nuevo"].includes(s)) return "b-warn";
  if (["rechazado", "critico", "alto", "inactivo", "perdido", "urgente", "cancelado"].includes(s)) return "b-err";
  if (["alta", "prioridad", "generado"].includes(s)) return "b-info";
  return "b-brand";
}
function badge(v) { return `<span class="badge ${badgeClass(v)}">${esc(String(v || "").replace(/_/g, " "))}</span>`; }

function aiPanel(title, desc, btnLabel, action, extra) {
  return `<div class="ai-panel"><h3>${icon("sparkles")}${esc(title)}</h3>
    <p>${esc(desc)}</p>
    <div class="flex">
      <button class="btn" data-ai="${action}" id="btnAiRun">${icon("send")} ${esc(btnLabel)}</button>
      ${extra || ""}
    </div></div>`;
}

function field(label, inputHtml, hint, full) {
  return `<div class="field${full ? " full" : ""}"><label>${esc(label)}</label>${inputHtml}
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div>`;
}
function input(name, val, type, ph, step) {
  type = type || "text";
  const extra = step ? ` step="${step}"` : "";
  return `<input type="${type}" name="${name}" value="${esc(val == null ? "" : val)}"
    placeholder="${esc(ph || "")}"${extra}>`;
}
function select(name, val, opts) {
  return `<select name="${name}">` + opts.map(o => {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}"${String(v) === String(val) ? " selected" : ""}>${esc(t)}</option>`;
  }).join("") + "</select>";
}
function textarea(name, val, ph, rows, id) {
  return `<textarea name="${name}" id="${esc(id || "inp" + name)}" rows="${rows || 4}"`
       + ` placeholder="${esc(ph || "")}">${esc(val || "")}</textarea>`;
}

function copyBtn(getText, label) {
  return `<button class="btn btn-ghost btn-sm" data-copy="${esc(getText)}">${icon("copy")} ${esc(label || "Copiar")}</button>`;
}

async function doCopy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast((label || "Contenido") + " copiado al portapapeles", "ok");
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Copiado", "ok"); }
    catch (_) { toast("No se pudo copiar", "err"); }
    ta.remove();
  }
}

function download(name, content, mime) {
  const b = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
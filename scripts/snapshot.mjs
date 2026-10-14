/**
 * Genera una instantanea HTML autocontenida de una vista de IASolges,
 * para revision visual (Firefox headless --screenshot).
 *   node scripts/snapshot.mjs <ruta> <salida.html> [base]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const route = process.argv[2] || "inicio";
const out = process.argv[3] || "/tmp/opencode/snapshot.html";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS = path.join(ROOT, "src/iasolges/static/js");
const CSS = fs.readFileSync(path.join(ROOT, "src/iasolges/static/css/app.css"), "utf8");

const el = () => ({
  style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  children: [], innerHTML: "", textContent: "", value: "", hidden: false,
  appendChild(c) { this.children.push(c); }, remove() { }, addEventListener() { },
  insertAdjacentHTML() { }, querySelector() { return el(); }, querySelectorAll() { return []; },
  setAttribute() { }, getAttribute() { return null; }, closest() { return null; }, focus() { },
});
const sandbox = {
  console, document: { querySelector: () => el(), querySelectorAll: () => [], createElement: () => el(),
                       addEventListener: () => {}, body: el(), documentElement: el(), title: "" },
  window: { addEventListener() { } }, location: { hash: "" }, history: {},
  navigator: { clipboard: { writeText: async () => { } } },
  fetch: (u, o) => fetch(u.startsWith("http") ? u : "http://127.0.0.1:8791" + u, o),
  setTimeout, clearTimeout, setInterval, clearInterval,
  Blob: class { }, URL: { createObjectURL: () => "blob:x", revokeObjectURL() { } },
  FormData: globalThis.FormData, confirm: () => true, alert: () => { },
  crypto, TextEncoder, TextDecoder, URLSearchParams, Response, Request, Headers,
};
sandbox.globalThis = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
for (const f of ["core.js", "views.js", "app.js"]) {
  vm.runInContext(fs.readFileSync(path.join(JS, f), "utf8"), sandbox, { filename: f });
}
vm.runInContext("globalThis.__X = { VIEWS, NAV, esc, icon, buildNav, SUBTITLES, limpiarBtn, Api };", sandbox);
const { VIEWS, NAV, esc, icon, buildNav, SUBTITLES, limpiarBtn } = sandbox.__X;

/* cuerpo del sidebar, identico al de la app real */
buildNav();
const navHtml = (() => {
  const html = NAV.map(g => `
    <div class="nav-group">
      <div class="nav-label">${esc(g.group)}</div>
      ${g.items.map(i => `<button class="side-item${i.route === route ? " active" : ""}">
        <span class="side-ico">${icon(i.icon)}</span><span class="side-label">${esc(i.label)}</span>
      </button>`).join("")}
    </div>`).join("");
  return html;
})();

const meta = NAV.flatMap(n => n.items).find(i => i.route === route) || { label: "Inicio" };
const view = await VIEWS[route]({ q: {} });

const html = `<!DOCTYPE html><html lang="es" data-theme="azul"><head><meta charset="utf-8">
<title>IASolges - ${esc(meta.label)}</title><style>${CSS}</style></head><body>
<div class="layout">
  <aside class="sidebar">
    <div class="brand"><div class="brand-logo">IA</div>
      <div class="brand-text"><strong>IASolges</strong><span>v1.0.0</span></div></div>
    <nav class="nav">${navHtml}</nav>
    <div class="sidebar-foot">
      <button class="side-item"><span class="side-ico">${icon("settings")}</span>
        <span class="side-label">Configuracion</span></button>
      <div class="engine"><span class="dot"></span><span>Motor IA Local</span></div>
    </div>
  </aside>
  <main class="main">
    <header class="topbar">
      <div class="topbar-title"><h1>${esc(meta.label)}</h1>
        <p>${esc(SUBTITLES[route] || "")}</p></div>
      <div class="topbar-actions">
        <button class="btn-home${route === "inicio" ? " on" : ""}">${icon("home")} Inicio</button>
        <label class="search">${icon("search")}
          <input type="search" placeholder="Buscar en el modulo..."></label>
        <button class="icon-btn update has-update"><span class="dot"></span>${icon("download")}</button>
        <button class="icon-btn">${icon("info")}</button>
        <button class="icon-btn">${icon("sun")}</button>
        <button class="btn btn-primary">${icon("sparkles")} Generar con IA</button>
      </div>
    </header>
    <div class="update-bar"><span class="u-ico">${icon("download")}</span>
      <div class="u-txt"><b>Hay una version nueva disponible: v1.2.0</b>
      <span>Tu version es la 1.1.0. La actualizacion se instala en un solo paso.</span></div>
      <button class="btn btn-primary">${icon("download")} Actualizar ahora</button>
      <button class="icon-btn">${icon("x")}</button></div>
    <section class="content">${view}</section>
  </main>
</div></body></html>`;

fs.writeFileSync(out, html);
console.log("Snapshot escrito:", out, `(${html.length} bytes)`);
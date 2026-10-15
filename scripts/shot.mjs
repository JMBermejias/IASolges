/**
 * Instantanea autocontenida (HTML + CSS en linea) de una vista real renderizada
 * con jsdom, para revision visual con Firefox headless.
 *   node scripts/shot.mjs <ruta> <salida.html> [base]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); }
catch {
  const { createRequire } = await import("node:module");
  const cache = process.env.IASOLGES_JSDOM || `${process.env.TMPDIR || "/tmp"}/iasolges-jsdom`;
  ({ JSDOM } = createRequire(`${cache}/package.json`)("jsdom"));
}

const route = process.argv[2] || "seguridad";
const out = process.argv[3] || "/tmp/opencode/shot.html";
const BASE = process.argv[4] || "http://127.0.0.1:8791";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS = path.join(ROOT, "src/iasolges/static/js");
const CSS = fs.readFileSync(path.join(ROOT, "src/iasolges/static/css/app.css"), "utf8");

const html = await (await fetch(BASE + "/")).text();
const dom = new JSDOM(html, { url: BASE + "/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.fetch = (u, o) => fetch(u.startsWith("http") ? u : BASE + u, o);
window.URLSearchParams = URLSearchParams;
window.confirm = () => true;
window.eval(["core.js", "views.js", "app.js"]
  .map(f => fs.readFileSync(path.join(JS, f), "utf8")).join("\n")
  + "\n;window.__X={boot,go};");

const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1000);
const d = window.document;
if (d.querySelector("#layout").hidden) await window.eval("window.__X.boot()");
await wait(2000);
const params = process.argv[5] ? JSON.parse(process.argv[5]) : {};
await window.eval(`window.__X.go(${JSON.stringify(route)}, ${JSON.stringify(params)})`);
await wait(2600);

const doc = d.documentElement.cloneNode(true);
// Congelar el estado final para que el HTML estatico muestre lo mismo.
d.querySelectorAll("script").forEach(s => s.remove());
const style = d.createElement("style");
style.textContent = CSS;
d.head.appendChild(style);
d.body.setAttribute("data-frozen", "1");
// La instantanea se guarda en un fichero local, asi que las rutas relativas
// /api/... no resolverian: se pasan a absolutas contra el servidor en marcha.
let doc2 = d.documentElement.outerHTML;
doc2 = doc2.split('"/api/').join('"' + BASE + '/api/');
fs.writeFileSync(out, "<!doctype html>\n" + doc2);
console.log("escrita " + out);
window.close();
process.exit(0);
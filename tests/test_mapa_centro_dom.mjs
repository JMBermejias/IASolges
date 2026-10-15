/**
 * El mapa debe estar donde dice el usuario:
 *   - centrado en la localidad escrita (no en una ciudad por defecto)
 *   - aunque los datos sean de muestra
 *   - elegir un tipo de negocio no puede dejar la busqueda sin resultados
 *   - el perimetro del radio se dibuja
 *   node tests/test_mapa_centro_dom.mjs [http://127.0.0.1:8793]
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

const BASE = process.argv[2] || "http://127.0.0.1:8793";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(HERE, "..", "src", "iasolges", "static", "js");

let ok = 0, fail = 0;
const check = (l, c, d = "") => {
  if (c) { ok++; console.log(`  \x1b[32mOK\x1b[0m   ${l}`); }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m ${l}  ${d}`); }
};
const api = async (m, u, b) => (await fetch(BASE + u, {
  method: m, headers: { "Content-Type": "application/json" },
  body: b ? JSON.stringify(b) : undefined,
})).json();
const buscar = (loc, extra = {}) => api("POST", "/api/ai/geo", Object.assign({
  location: loc, radius: 10, sector: "general", origin: "real", limit: 20 }, extra));

// Coordenadas con las que comprobamos (las mismas de la referencia).
const REF = {
  "Novelda": [38.3842, -0.7674],
  "Elche": [38.2669, -0.6983],
  "Valencia": [39.4699, -0.3763],
  "Denia": [38.8408, 0.1057],
  "Elche, Alicante": [38.2669, -0.6983],
};
const cerca = (c, ref) => Array.isArray(c) && Math.abs(c[0] - ref[0]) < 0.15
                                        && Math.abs(c[1] - ref[1]) < 0.15;

console.log("\n=== 1. El mapa se centra en la localidad escrita ===");
for (const [loc, ref] of Object.entries(REF)) {
  const r = await buscar(loc, { origin: "muestra" });
  const okCentro = cerca([r.center.lat, r.center.lon], ref);
  check(`"${loc}" se centra donde toca`, okCentro,
        `centro=${r.center.lat.toFixed(3)},${r.center.lon.toFixed(3)} esperado=${ref}`);
}

console.log("\n=== 2. Tampoco cuando los datos son reales ===");
const real = await buscar("Novelda", { sector: "salud" });
check("con datos reales el centro es Novelda",
      cerca([real.center.lat, real.center.lon], REF["Novelda"]),
      JSON.stringify(real.center));

console.log("\n=== 3. Elegir un tipo de negocio no deja la busqueda vacia ===");
// "Reformas" en Novelda no esta en el mapa: antes eso devolvia 0 y caia a la
// muestra. Ahora el tipo es la primera busqueda, pero se sigue con el sector.
const conFiltro = await buscar("Novelda", { sector: "construccion", business_type: "Reformas" });
const sinFiltro = await buscar("Novelda", { sector: "construccion" });
console.log(`      -> con filtro "Reformas": ${conFiltro.total} | sin filtro: ${sinFiltro.total}`);
check("con filtro salen resultados o avisa claramente",
      conFiltro.total > 0 || !!(conFiltro.aviso && conFiltro.aviso.length > 20),
      `total=${conFiltro.total} aviso=${(conFiltro.aviso || "").slice(0, 40)}`);
if (conFiltro.real) {
  check("el filtro no empeora el resultado", conFiltro.total >= Math.min(5, sinFiltro.total),
        `con=${conFiltro.total} sin=${sinFiltro.total}`);
}

console.log("\n=== 4. El perimetro se dibuja en el mapa ===");
const html = await (await fetch(BASE + "/")).text();
const dom = new JSDOM(html, { url: BASE + "/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.fetch = (u, o) => fetch(u.startsWith("http") ? u : BASE + u, o);
window.URLSearchParams = URLSearchParams;
window.confirm = () => true;
window.eval(["core.js", "views.js", "app.js"]
  .map(f => fs.readFileSync(path.join(JS, f), "utf8")).join("\n")
  + "\n;window.__X={boot,go,Api,$,$$};");

const wait = ms => new Promise(r => setTimeout(r, ms));
const doc = window.document;
const $ = s => doc.querySelector(s);
const $$ = s => Array.from(doc.querySelectorAll(s));

await wait(1200);
if ($("#layout").hidden) await window.eval("window.__X.boot()");
await wait(2000);
await window.eval("window.__X.go('mapa', {})");
await wait(2200);

const busq = await buscar("Novelda", { sector: "construccion", origin: "muestra" });
await window.eval(`window.__X.go("mapa", { id: ${busq.record.id} })`);
await wait(3000);

const peri = $$("#geoResult svg circle.perimetro");
check("el mapa dibuja el perimetro", peri.length === 1, "circulos=" + peri.length);
if (peri.length) {
  const r = parseFloat(peri[0].getAttribute("r"));
  check("tiene un radio razonable", r > 40 && r < 600, "r=" + r);
  const cx = parseFloat(peri[0].getAttribute("cx"));
  check("esta centrado en el mapa", Math.abs(cx - 500) < 1, "cx=" + cx);
  check("el nodo del centro tambien se dibuja", $$(".perimetro-nodo").length === 1);
  // En jsdom no hay estilos calculados, asi que se mira el CSS de la hoja.
  const hoja = fs.readFileSync(path.join(HERE, "..", "src", "iasolges",
    "static", "css", "app.css"), "utf8");
  const regla = hoja.match(/\.perimetro\s*\{[^}]*\}/);
  check("el trazo es discontinuo (se ve que es un limite)",
        !!regla && /stroke-dasharray/.test(regla[0]),
        regla ? regla[0].slice(0, 60) : "no hay regla .perimetro");
}
const info = ($(".map-info") || {}).textContent || "";
check("el pie del mapa dice el perimetro", /perimetro/i.test(info), info.slice(0, 50));
const leyenda = ($(".map-legend") || {}).textContent || "";
check("la leyenda explica el perimetro", /Perimetro/i.test(leyenda), leyenda.slice(0, 60));

console.log(`\n${"=".repeat(52)}\n  ${ok} correctos | ${fail} fallidos\n${"=".repeat(52)}\n`);
window.close();
process.exit(fail ? 1 : 0);
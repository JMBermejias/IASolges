/**
 * El mapa NO puede mentir: si no hay negocios reales, lo dice en grande.
 * Comprueba tambien que los sectores que antes no daban nada (construccion)
 * ahora encuentran oficios reales gracias a la ampliacion de palabras clave.
 *   node tests/test_mapa_honesto_dom.mjs [http://127.0.0.1:8793]
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
const buscar = (l, s, r = 10) =>
  api("POST", "/api/ai/geo", { location: l, radius: r, sector: s, origin: "real", limit: 20 });

console.log("\n=== 1. Sector 'construccion': antes daba 0 negocios reales ===");
const con = await buscar("novelda", "construccion", 10);
console.log(`      -> ${con.total} reales | fuente: ${con.fuente}`);
if (con.real) {
  check("encuentra negocios reales de construccion", con.total > 0, "total=" + con.total);
  check("son oficios reales (fontaneria, carpinteria, albañil...)",
        con.results.some(r => /fontaner|carpinter|albanil|pintor|cerrajer|electric/i
                              .test(r.name + r.business_type)),
        con.results.slice(0, 3).map(r => r.name).join(", "));
  check("ninguno lleva el nombre inventado",
        !con.results.some(r => /\bS\.\s?L\.\s*\d|\bGrupo\s*\d\b/.test(r.name)));
} else {
  check("si no hay datos, avisa en vez de callar", !!(con.aviso && con.aviso.length > 20),
        "aviso=" + (con.aviso || "").slice(0, 60));
  console.log("      (sin red o sin datos: se comprueba el aviso)");
}

console.log("\n=== 2. Un sitio sin datos avisa claramente ===");
const sitio = await buscar("Jacinto Benavente, Valencia", "construccion", 10);
if (sitio.real === false) {
  check("se marca como datos de muestra", sitio.real === false);
  check("el aviso dice que NO son reales", /NO son negocios reales/i.test(sitio.aviso || ""),
        (sitio.aviso || "").slice(0, 70));
  check("el aviso dice que no hay que llamar", /no los llames/i.test(sitio.aviso || ""));
  check("el aviso explica el motivo", /Motivo:/.test(sitio.aviso || ""));
  check("el motivo esta en castellano y sin doble punto",
        !/\.\./.test(sitio.aviso || ""), (sitio.aviso || "").slice(-40));
} else {
  check("si encuentra datos reales, no hay aviso de muestra",
        !(sitio.aviso || "").match(/NO son negocios reales/i), (sitio.aviso || "").slice(0, 60));
  console.log(`      -> ${sitio.total} reales encontrados; se omite el caso de muestra`);
}

console.log("\n=== 3. Pocos resultados reales: aviso suave ===");
const pocos = await buscar("Jacinto Benavente, Valencia", "industrial", 10);
if (pocos.real && pocos.total < 5) {
  check("avisa de que solo hay pocos", /Solo se han encontrado/i.test(pocos.aviso || ""),
        (pocos.aviso || "").slice(0, 70));
  check("el aviso explica que OSM no es una guia comercial",
        /no es una guia comercial/i.test(pocos.aviso || ""));
  check("propone una alternativa", /Muestra del Motor IA|otro sector/i.test(pocos.aviso || ""));
} else {
  check("si hay suficientes, no avisa de paucidad",
        !(pocos.aviso || "").match(/Solo se han encontrado/i),
        `total=${pocos.total} aviso=${(pocos.aviso || "").slice(0, 40)}`);
}

console.log("\n=== 4. El aviso se ve en pantalla ===");
const html = await (await fetch(BASE + "/")).text();
const dom = new JSDOM(html, { url: BASE + "/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.fetch = (u, o) => fetch(u.startsWith("http") ? u : BASE + u, o);
window.URLSearchParams = URLSearchParams;
window.confirm = () => true;
window.eval(["core.js", "views.js", "app.js"]
  .map(f => fs.readFileSync(path.join(JS, f), "utf8")).join("\n")
  + "\n;window.__X={boot,go,Api,$};");

const wait = ms => new Promise(r => setTimeout(r, ms));
const doc = window.document;
const $ = s => doc.querySelector(s);

await wait(1200);
if ($("#layout").hidden) await window.eval("window.__X.boot()");
await wait(2000);

// Buscar de verdad, desde el formulario, para ver el aviso en su sitio.
await window.eval('window.__X.go("mapa", {})');
await wait(2200);
const f = $("#geoForm");
check("el formulario de busqueda esta en pantalla", !!f);
if (f) {
  const loc = f.querySelector("[name=location]");
  const sec = f.querySelector("[name=sector]");
  const ori = f.querySelector("[name=origin]");
  check("tiene campo de localidad", !!loc);
  check("tiene selector de sector", !!sec);
  check("tiene selector de origen", !!ori);
  if (loc) loc.value = "Jacinto Benavente, Valencia";
  if (sec) sec.value = "construccion";
  if (ori) ori.value = "real";
  f.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(30000);
}

const aviso = $("#geoResult .geo-aviso");
check("el aviso se pinta sobre el mapa", !!aviso);
if (aviso) {
  const t = aviso.textContent;
  check("avisa en fuerte si son de muestra", aviso.classList.contains("fuerte"),
        aviso.className);
  check("el texto es legible", t.length > 60, t.slice(0, 60));
  check("lleva icono de aviso", !!aviso.querySelector("svg"));
  const salida = $("#geoResult").textContent;
  check("el aviso aparece ANTES de los resultados",
        salida.indexOf(t.slice(0, 30)) < salida.indexOf("Oportunidades"),
        "orden incorrecto");
}

console.log(`\n${"=".repeat(52)}\n  ${ok} correctos | ${fail} fallidos\n${"=".repeat(52)}\n`);
window.close();
process.exit(fail ? 1 : 0);
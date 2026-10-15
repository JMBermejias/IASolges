/**
 * Mapa Localizador con datos REALES de OpenStreetMap:
 *   - los nombres no son inventados ("Asesoria S.L. 1")
 *   - no inventa telefonos ni correos
 *   - el mapa de fondo se pide al proxy del servidor (no a OSM directamente)
 *   - el desplegable de "Tipo de negocio" tiene opciones
 *   - el modo "muestra" sigue funcionando sin conexion
 *
 * No necesita red: si OpenStreetMap no esta accesible, comprueba el camino de
 * muestra, que tambien debe ser correcto.
 *   node tests/test_mapa_real_dom.mjs [http://127.0.0.1:8793]
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

console.log("\n=== 1. Busqueda con datos reales ===");
const r = await api("POST", "/api/ai/geo", {
  location: "Novelda, Alicante", radius: 3, sector: "salud", limit: 12, origin: "real",
});
const real = r.real === true;
console.log(`      -> fuente: ${r.fuente} | real: ${real} | ${r.total} resultados`);
check("la busqueda devuelve resultados", (r.results || []).length > 0, "total=" + r.total);
check("indica de donde salen los datos", !!r.fuente, "fuente=" + r.fuente);
check("el centro son coordenadas reales de la localidad",
      Math.abs(r.center.lat - 38.38) < 0.2 && Math.abs(r.center.lon + 0.77) < 0.2,
      JSON.stringify(r.center));

if (real) {
  console.log("\n=== 2. Los nombres son reales (no generados) ===");
  const nombres = r.results.map(x => x.name);
  const inventados = nombres.filter(n => /\bS\.\s?L\.\s*\d|\bS\.\s?A\.\s*\d|\bGrupo\s*\d\b/.test(n));
  check("ningun nombre tiene el patron de los inventados", inventados.length === 0,
        inventados.slice(0, 3).join(", "));
  const conLetra = nombres.filter(n => /[A-Za-z]{3}/.test(n));
  check("los nombres son de palabras reales", conLetra.length >= nombres.length * 0.8,
        conLetra.length + "/" + nombres.length);
  console.log(`      -> ${nombres.slice(0, 4).join(" | ")}`);

  console.log("\n=== 3. No inventa datos de contacto ===");
  const conTel = r.results.filter(x => x.phone);
  const conMail = r.results.filter(x => x.email);
  check("ningun telefono inventado", conTel.length === 0,
        conTel.slice(0, 2).map(x => x.name + ":" + x.phone).join(", "));
  check("ningun correo inventado", conMail.length === 0,
        conMail.slice(0, 2).map(x => x.name).join(", "));

  console.log("\n=== 4. Direcciones y distancias coherentes ===");
  check("todos tienen direccion", r.results.every(x => x.address && x.address.length > 3));
  check("las distancias estan dentro del radio pedido",
        r.results.every(x => x.distance <= 3.05),
        Math.max(...r.results.map(x => x.distance)).toFixed(2) + " km");
  check("las coordenadas estan cerca de Novelda",
        r.results.every(x => Math.abs(x.lat - 38.38) < 0.2 && Math.abs(x.lon + 0.77) < 0.2));
} else {
  console.log("\n  (sin red: se comprueba solo el camino de muestra)");
  check("el modo muestra se identifica como tal", /muestra/i.test(r.fuente), r.fuente);
}

// ------------------------------------------------------------------- UI
const html = await (await fetch(BASE + "/")).text();
const dom = new JSDOM(html, { url: BASE + "/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.fetch = (u, o) => fetch(u.startsWith("http") ? u : BASE + u, o);
window.URLSearchParams = URLSearchParams;
window.confirm = () => true;
window.eval(["core.js", "views.js", "app.js"]
  .map(f => fs.readFileSync(path.join(JS, f), "utf8")).join("\n")
  + "\n;window.__X={boot,go,State,Api,$,Geo};");

const wait = ms => new Promise(r2 => setTimeout(r2, ms));
const doc = window.document;
const $ = s => doc.querySelector(s);
const $$ = s => Array.from(doc.querySelectorAll(s));

await wait(1200);
if ($("#layout").hidden) await window.eval("window.__X.boot()");
await wait(2000);
await window.eval('window.__X.go("mapa", {})');
await wait(2500);

console.log("\n=== 5. El desplegable de 'Tipo de negocio' ===");
const tipo = $("#geoForm [name=business_type]");
check("existe el desplegable de tipo de negocio", !!tipo);
const ops = tipo ? Array.from(tipo.options).map(o => o.textContent) : [];
console.log(`      -> ${ops.length} opciones: ${ops.slice(0, 6).join(" | ")}`);
check("tiene mas de una opcion (ya no esta vacio)", ops.length > 1, "opciones=" + ops.length);
check("la primera es 'Todos los tipos'", ops[0] === "Todos los tipos", ops[0]);

console.log("\n=== 6. Cambiar de sector vuelve a rellenarlo ===");
const sec = $("#geoForm [name=sector]");
sec.value = "hosteleria";
sec.dispatchEvent(new window.Event("change", { bubbles: true }));
await wait(2500);
const ops2 = Array.from(tipo.options).map(o => o.textContent);
console.log(`      -> ${ops2.length} opciones: ${ops2.slice(0, 5).join(" | ")}`);
check("el desplegable se actualiza al cambiar de sector", ops2.length > 1, "opciones=" + ops2.length);
check("los tipos son del sector elegido",
       ops2.some(t => /restaurante|hotel|cafe|bar/i.test(t)) || real,
       ops2.slice(0, 6).join(", "));

console.log("\n=== 7. El mapa pide los tiles al servidor ===");
const guardada = await api("POST", "/api/ai/geo", {
  location: "Novelda, Alicante", radius: 3, sector: "salud", limit: 10, origin: "real",
});
// Hay que abrir la busqueda guardada: la vista sin id no dibuja ningun mapa.
await window.eval(`window.__X.go("mapa", { id: ${guardada.record.id} })`);
await wait(4000);
const imgs = $$("#geoResult svg image");
console.log(`      -> ${imgs.length} tiles`);
check("el mapa dibuja tiles de fondo", imgs.length > 0, "tiles=" + imgs.length);
const hrefs = imgs.map(i => i.getAttribute("href") || "");
check("los tiles van por el proxy y no directo a OpenStreetMap",
      hrefs.every(h => h.includes("/api/mapa/tile/")),
      hrefs.find(h => !h.includes("/api/mapa/tile/")) || "");
check("ningun tile apunta directamente a tile.openstreetmap.org",
      !hrefs.some(h => h.includes("tile.openstreetmap.org")));

console.log("\n=== 8. El proxy de tiles responde de verdad ===");
if (hrefs.length) {
  const partes = hrefs[0].split("/api/mapa/tile/")[1];
  const t = await fetch(`${BASE}/api/mapa/tile/${partes}`);
  const buf = Buffer.from(await t.arrayBuffer());
  check("devuelve una imagen", t.status === 200 && buf.length > 1000,
        `http=${t.status} bytes=${buf.length}`);
  check("es un PNG de verdad", buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e,
        buf.slice(0, 4).toString("hex"));
  const malo = await fetch(`${BASE}/api/mapa/tile/99/1/1.png`);
  check("rechaza coordenadas imposibles", malo.status === 404, "http=" + malo.status);
}

console.log("\n=== 9. La ficha no inventa datos ===");
const ficha = $("#geoDetailBody");
check("hay ficha de detalle", !!ficha);
const texto = ficha ? ficha.textContent : "";
if (real) {
  check("dice 'Sin dato publico' donde no hay telefono ni correo",
        /Sin dato publico/.test(texto), texto.slice(0, 80));
  check("no inventa una puntuacion", !/\b\d{1,3}\/100\b/.test(texto),
        (texto.match(/\d{1,3}\/100/) || [""])[0]);
  check("explica que los datos son de OpenStreetMap", /OpenStreetMap/.test(texto));
}

console.log("\n=== 10. El modo muestra sigue disponible ===");
const muestra = await api("POST", "/api/ai/geo", {
  location: "Alicante", radius: 5, sector: "general", limit: 5, origin: "muestra",
});
check("el modo muestra responde", (muestra.results || []).length > 0, "total=" + muestra.total);
check("el modo muestra se identifica", /muestra/i.test(muestra.fuente), muestra.fuente);
check("el modo muestra se marca como no real", muestra.real === false);

console.log(`\n${"=".repeat(52)}\n  ${ok} correctos | ${fail} fallidos\n${"=".repeat(52)}\n`);
window.close();
process.exit(fail ? 1 : 0);
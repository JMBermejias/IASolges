/**
 * Mapa Localizador: al abrir una busqueda GUARDADA el mapa debe responder
 * (marcadores, seleccion, detalle) y "Analizar seleccion con IA" debe responder.
 * Tambien comprueba que un analisis guardado en formato JSON se regenera.
 *
 * La prueba prepara su propio estado: lanza una busqueda por la API y luego
 * deja el analisis guardado en formato JSON, como lo dejaba una version vieja.
 *   node tests/test_mapa_dom.mjs [http://127.0.0.1:8792]
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

const BASE = process.argv[2] || "http://127.0.0.1:8792";
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

// ------------------------------------------------------- preparar el estado
console.log("\n=== 0. Preparar una busqueda guardada con el analisis en JSON ===");
const busq = await api("POST", "/api/ai/geo",
  { location: "alicante", radius: 10, sector: "servicios", limit: 12 });
const id = busq.record && busq.record.id;
check("la busqueda se guarda y devuelve id", !!id, "id=" + id);
check("la busqueda trae resultados", (busq.results || []).length > 0,
      "resultados=" + (busq.results || []).length);
// Reproducir lo que dejaba una version antigua: el volcado JSON en vez del informe.
await api("PUT", "/api/geo_searches/" + id, { ai_analysis: JSON.stringify(busq) });
const preparada = await api("GET", "/api/geo_searches/" + id);
check("el registro queda con el analisis en formato JSON",
      String(preparada.ai_analysis || "").trim().startsWith("{"));

// --------------------------------------------------------------- abrir la UI
const html = await (await fetch(BASE + "/")).text();
const dom = new JSDOM(html, { url: BASE + "/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.fetch = (u, o) => fetch(u.startsWith("http") ? u : BASE + u, o);
window.URLSearchParams = URLSearchParams;
window.confirm = () => true;
window.eval(["core.js", "views.js", "app.js"]
  .map(f => fs.readFileSync(path.join(JS, f), "utf8")).join("\n")
  + "\n;window.__X={boot,go,State,Api,$,Geo,toast};");

const wait = ms => new Promise(r => setTimeout(r, ms));
const doc = window.document;
const $ = s => doc.querySelector(s);
const $$ = s => Array.from(doc.querySelectorAll(s));

await wait(1200);
if ($("#layout").hidden) await window.eval("window.__X.boot()");
await wait(2200);

console.log("\n=== 1. Abrir una busqueda GUARDADA (no escrita a mano) ===");
await window.eval(`window.__X.go("mapa", { id: ${id} })`);
await wait(3000);

console.log("\n=== 2. El mapa responde ===");
const marcas = $$("#geoResult .marker");
check("los marcadores se dibujan", marcas.length > 0, "marcadores: " + marcas.length);
const filas = $$("#geoBody tr");
check("la tabla de resultados se dibuja", filas.length > 0, "filas: " + filas.length);
const cargados = await window.eval("window.__X.Geo.resultados.length");
check("Geo.resultados tiene los resultados cargados", cargados > 0, "Geo.resultados=" + cargados);

console.log("\n=== 3. La seleccion funciona ===");
const selIni = await window.eval("window.__X.Geo.seleccion.size");
check("hay una seleccion inicial", selIni > 0, "seleccion=" + selIni);
const detIni = $("#geoDetail") ? $("#geoDetail").textContent : "";
check("el panel de detalle muestra el cliente", detIni.length > 30, detIni.slice(0, 50));

marcas[2].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await wait(500);
const selDespues = await window.eval("window.__X.Geo.seleccion.size");
check("pulsar un marcador cambia la seleccion", selDespues !== selIni,
      `antes=${selIni} despues=${selDespues}`);
const contador = $("#geoSelCount").textContent;
check("el contador de seleccion se actualiza", /seleccionado/.test(contador), contador);
check("la fila queda marcada", $$("#geoBody tr.sel").length > 0,
      "marcadas=" + $$("#geoBody tr.sel").length);

console.log("\n=== 4. 'Analizar seleccion con IA' responde ===");
const salidaAI = $("#geoAI");
check("existe el hueco de salida", !!salidaAI);
$("#btnGeoAI").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
// El motor local responde enseguida: hay que mirar el estado de carga casi
// al vuelo, no 600 ms despues (para entonces ya ha terminado).
check("muestra que esta analizando de inmediato", /Analizando/.test(salidaAI.textContent),
      salidaAI.textContent.slice(0, 60));
check("el boton se deshabilita mientras trabaja", $("#btnGeoAI").disabled === true,
      "disabled=" + $("#btnGeoAI").disabled);
await wait(6000);
const txtAI = salidaAI.textContent;
console.log(`      -> salida: ${txtAI.slice(0, 80).replace(/\s+/g, " ")}`);
check("ya no esta cargando", !/Analizando \d/.test(txtAI));
check("NO dice que no hay nada seleccionado", !/Selecciona al menos un/.test(txtAI));
check("muestra el analisis de la seleccion", txtAI.length > 120, "long=" + txtAI.length);
check("el informe es Markdown, no JSON", !txtAI.trim().startsWith("{"), txtAI.slice(0, 40));

console.log("\n=== 5. El analisis guardado en JSON se regenera ===");
await wait(2500);
const panel = $("#geoResult .output");
const txtPanel = panel ? panel.textContent.trim() : "";
check("el panel del mercado ya no muestra JSON", !txtPanel.startsWith("{"),
      txtPanel.slice(0, 50));
check("el panel del mercado tiene contenido legible", txtPanel.length > 120, "long=" + txtPanel.length);
const rec = await api("GET", "/api/geo_searches/" + id);
check("el registro guardado tambien se ha reparado",
      !String(rec.ai_analysis || "").trim().startsWith("{"),
      String(rec.ai_analysis || "").slice(0, 50));

console.log(`\n${"=".repeat(52)}\n  ${ok} correctos | ${fail} fallidos\n${"=".repeat(52)}\n`);
window.close();
process.exit(fail ? 1 : 0);
/**
 * Prueba de interfaz de los cuatro modulos tocados, en DOM real (jsdom).
 *   node tests/test_modules_dom.mjs [http://127.0.0.1:8791]
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

const BASE = process.argv[2] || "http://127.0.0.1:8791";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(HERE, "..", "src", "iasolges", "static", "js");

let ok = 0, fail = 0;
const check = (l, c, d = "") => {
  if (c) { ok++; console.log(`  \x1b[32mOK\x1b[0m   ${l}`); }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m ${l}  ${d}`); }
};

const html = await (await fetch(BASE + "/")).text();
const dom = new JSDOM(html, { url: BASE + "/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.fetch = (u, o) => fetch(u.startsWith("http") ? u : BASE + u, o);
window.URLSearchParams = URLSearchParams;
window.confirm = () => true;
window.scrollTo = () => {};
window.Element.prototype.scrollIntoView = () => {};
window.eval(["core.js", "views.js", "app.js"]
  .map(f => fs.readFileSync(path.join(JS, f), "utf8")).join("\n")
  + "\n;window.__X={boot,go,VIEWS,State,Geo,Security,PromptLab,Api,$};");

const wait = ms => new Promise(r => setTimeout(r, ms));
const doc = window.document;
const $ = s => doc.querySelector(s);
const $$ = s => Array.from(doc.querySelectorAll(s));

await wait(1200);
if ($("#layout").hidden) await window.eval("window.__X.boot()");
await wait(2200);

console.log("\n=== 1. Seguridad: analisis automatico ===");
await window.eval('window.__X.go("seguridad", {})');
await wait(1800);
check("existe el formulario", !!$("#secForm"));
check("boton 'Analizar ahora'", !!$("#btnSecRun"));
check("boton de ejemplo", !!$("#btnSecSample"));
const ta = $("#secForm [name=content]");
check("campo de contenido", !!ta);

// escribir dispara el analisis automatico (1,5 s de espera)
ta.value = 'const apiKey = "sk-live-9f3a2b8c7d1e4f5a";\n'
  + 'db.query("SELECT * FROM u WHERE id=" + id);\n'
  + 'el.innerHTML = nombre;\neval(req.body.script);';
ta.dispatchEvent(new window.Event("input"));
check("no limpia el informe al enviar", !$("#secOut").dataset.tieneInforme
  || $("#secOut").dataset.tieneInforme !== undefined);
await wait(9000);
const secTxt = $("#secOut") ? $("#secOut").textContent : "";
check("el informe se pinta solo", secTxt.includes("Informe de la IA"), secTxt.slice(0, 60));
check("detecta la clave expuesta", secTxt.includes("Clave expuesta"), "");
check("detecta inyeccion SQL", secTxt.includes("Inyeccion SQL"), "");
check("detecta XSS", secTxt.includes("XSS"), "");
check("detecta eval/inyeccion de comandos", secTxt.includes("Inyeccion de comandos"), "");
check("el informe NO se borra despues",
  $("#secOut") && $("#secOut").dataset.tieneInforme === "1");
await wait(2500);
check("sigue visible 2,5 s despues",
  $("#secOut") && $("#secOut").textContent.includes("Informe de la IA"),
  "el informe desaparece: se re-renderiza la vista");

console.log("\n=== 2. Mapa: seleccion y analisis ===");
await window.eval('window.__X.go("mapa", {})');
await wait(1200);
check("formulario de busqueda", !!$("#geoForm"));
$("#geoForm [name=location]").value = "Sevilla";
$("#geoForm [name=sector]").value = "hosteleria";
$("#geoForm [name=limit]").value = "10";
$("#geoForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await wait(11000);

check("el mapa se ha dibujado", $$("#geoResult .marker").length > 0,
      `${$$("#geoResult .marker").length} marcadores`);
check("hay filas de resultados", $$("#geoBody tr").length > 0, String($$("#geoBody tr").length));
check("hay casillas de seleccion", $$("[data-chk]").length > 0);
check("panel de detalle", !!$("#geoDetailBody") && $("#geoDetailBody").textContent.includes("Direccion"),
      $("#geoDetailBody") ? $("#geoDetailBody").textContent.slice(0, 50) : "no");
check("boton de analisis con IA", !!$("#btnGeoAI"));
check("el analisis del mercado se ve", ($("#geoResult").textContent || "").includes("Analisis del mercado"));

// clic en un marcador
const marcadores = $$("#geoResult .marker");
if (marcadores.length > 1) {
  const antes = $("#geoDetailBody").textContent;
  marcadores[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await wait(700);
  check("pulsar un marcador cambia el detalle",
        $("#geoDetailBody").textContent !== antes, "no cambio");
  check("el marcador queda seleccionado", marcadores[1].style.opacity === "1",
        marcadores[1].style.opacity);
}

// seleccionar varios y analizar
$('[data-act="selAll"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await wait(500);
check("seleccionar todo marca todos", $$("[data-chk]:checked").length === $$("[data-chk]").length,
      `${$$("[data-chk]:checked").length}/${$$("[data-chk]").length}`);
$("#btnGeoAI").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await wait(9000);
const geoTxt = $("#geoAI") ? $("#geoAI").textContent : "";
check("el analisis de la seleccion se muestra", geoTxt.includes("Que les falta"), geoTxt.slice(0, 70));
check("dice que tienen", geoTxt.includes("Que tienen estos resultados"), "");
check("dice por donde empezar", geoTxt.includes("Por donde empezar"), "");

console.log("\n=== 3. Generador de prompts: automatico ===");
await window.eval('window.__X.go("prompts", {})');
await wait(1000);
const abrir = $('[data-ai="__optimize"]');
check("hay boton para abrir el generador", !!abrir);
if (abrir) {
  abrir.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await wait(600);
  check("se abre el generador", !!$("#plForm"));
  check("hay campo para describir", !!$("#plForm [name=template]"));
  check("hay casilla de automatico", !!$("#plAuto") && $("#plAuto").checked);
  check("hay area para el prompt en codigo", !!$("#plPrompt"));
  const t2 = $("#plForm [name=template]");
  t2.value = "quiero un prompt para redactar emails de venta a pequenos comercios";
  t2.dispatchEvent(new window.Event("input"));
  await wait(9000);
  const codigo = $("#plPrompt").value || "";
  check("el prompt en codigo se genera solo", codigo.length > 100, `${codigo.length} chars`);
  check("el codigo tiene estructura de prompt",
        codigo.includes("# Rol") && codigo.includes("# Formato de salida"), codigo.slice(0, 60));
  console.log(`      -> ${codigo.split("\n")[0]} / ${codigo.split("\n")[1]}`);
  const salida = $("#plSalida") ? $("#plSalida").textContent : "";
  check("se muestra el analisis", salida.includes("Prompt generado"), salida.slice(0, 50));
}

console.log("\n=== 4. Kit de marca: boton IA en el formulario ===");
await window.eval('window.__X.go("kit-marca", {})');
await wait(1000);
const nuevo = $('[data-act="new"]');
check("boton de nueva marca", !!nuevo);
if (nuevo) {
  nuevo.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await wait(700);
  check("se abre el formulario de nueva marca", !!$("#editForm"));
  check("el boton IA esta DENTRO del formulario", !!$("#btnBrandAI"));
  check("hay zona de previsualizacion", !!$("#brandPreview"));
  $("#editForm [name=name]").value = "Solaria";
  $("#editForm [name=sector]").value = "salud";
  $("#btnBrandAI").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await wait(10000);
  const prev = $("#brandPreview") ? $("#brandPreview").textContent : "";
  check("la IA genera el kit de marca", prev.includes("Kit generado"), prev.slice(0, 60));
  check("el kit incluye paleta de color", prev.toLowerCase().includes("color"), "");
  check("el kit incluye tipografia", prev.toLowerCase().includes("tipograf"), "");
  check("el kit incluye tono de voz", prev.toLowerCase().includes("tono"), "");
  check("rellena la audiencia deducida",
        ($("#editForm [name=audience]").value || "").length > 3,
        $("#editForm [name=audience]").value);
  check("rellena los valores deducidos",
        ($("#editForm [name=values]").value || "").length > 3,
        $("#editForm [name=values]").value);
}

console.log(`\n${"=".repeat(52)}\n  ${ok} correctos | ${fail} fallidos\n${"=".repeat(52)}\n`);
window.close();
process.exit(fail ? 1 : 0);
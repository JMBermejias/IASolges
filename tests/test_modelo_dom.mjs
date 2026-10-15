/**
 * Prueba del guardado del modelo en Configuracion, con DOM real.
 * Reproduce: elegir proveedor -> elegir modelo del desplegable -> guardar.
 *   node tests/test_modelo_dom.mjs [http://127.0.0.1:8791]
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
window.eval(["core.js", "views.js", "app.js"]
  .map(f => fs.readFileSync(path.join(JS, f), "utf8")).join("\n")
  + "\n;window.__X={boot,go,State,Api,$};");

const wait = ms => new Promise(r => setTimeout(r, ms));
const doc = window.document;
const $ = s => doc.querySelector(s);
const $$ = s => Array.from(doc.querySelectorAll(s));
const get = async () => (await (await fetch(BASE + "/api/settings")).json());

await wait(1200);
if ($("#layout").hidden) await window.eval("window.__X.boot()");
await wait(2200);

console.log("\n=== 1. Elegir proveedor y modelo ===");
await window.eval('window.__X.go("settings", {})');
await wait(1500);
const selProv = $("#setForm [name=ai_provider]");
const selMod = $("#selModelo");
check("existe el desplegable de proveedor", !!selProv);
check("existe el desplegable de modelo", !!selMod);
check("el lateral muestra el modelo en uso", !!$("#engineModel"), "falta #engineModel");

selProv.value = "opencode";
selProv.dispatchEvent(new window.Event("change"));
await wait(4000);
const opts = Array.from(selMod.options).map(o => o.value);
console.log(`      -> ${opts.length} opciones; primeras: ${opts.slice(0, 4).join(", ")}`);
check("carga los modelos de OpenCode", opts.includes("space-bunny-free"), opts.slice(0, 5).join(","));

console.log("\n=== 2. Elegir un modelo y GUARDAR ===");
selMod.value = "cat-jam-free";
selMod.dispatchEvent(new window.Event("change"));      // como al elegir con el raton
await wait(300);
check("el desplegable conserva la eleccion", selMod.value === "cat-jam-free", selMod.value);
check("el campo libre queda vacio al elegir de la lista",
      ($("#inpModeloLibre").value || "") === "", $("#inpModeloLibre").value);
check("el campo libre esta oculto", $("#inpModeloLibre").style.display === "none",
      $("#inpModeloLibre").style.display);

$("#setForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await wait(4000);
let cfg = await get();
check("el servidor guardo el modelo elegido",
      cfg.ai_model === "cat-jam-free", "guardado: " + cfg.ai_model);
check("el proveedor guardado es OpenCode", cfg.ai_provider === "opencode", cfg.ai_provider);
console.log(`      -> servidor: proveedor=${cfg.ai_provider} modelo=${cfg.ai_model}`);
const aviso = $("#modelGuardado");
check("la interfaz muestra lo guardado", aviso && aviso.textContent === "cat-jam-free",
      aviso ? aviso.textContent : "no existe");

console.log("\n=== 3. Cambiar a otro modelo y volver a guardar ===");
selMod.value = "big-pickle";
selMod.dispatchEvent(new window.Event("change"));
await wait(300);
$("#setForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await wait(4000);
cfg = await get();
check("el segundo guardado tambien persiste",
      cfg.ai_model === "big-pickle", "guardado: " + cfg.ai_model);
check("no se queda el anterior", cfg.ai_model !== "cat-jam-free", cfg.ai_model);

console.log("\n=== 4. Escribir el modelo a mano ===");
selMod.value = "__libre__";
selMod.dispatchEvent(new window.Event("change"));
await wait(400);
check("el campo libre se muestra al elegir la opcion",
      $("#inpModeloLibre").style.display !== "none", $("#inpModeloLibre").style.display);
$("#inpModeloLibre").value = "mi-modelo-personalizado";
$("#setForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await wait(4000);
cfg = await get();
check("guarda el modelo escrito a mano",
      cfg.ai_model === "mi-modelo-personalizado", "guardado: " + cfg.ai_model);

console.log("\n=== 5. Recargar la vista: se mantiene ===");
await window.eval('window.__X.go("inicio", {})');
await wait(900);
await window.eval('window.__X.go("settings", {})');
await wait(2500);
const selMod2 = $("#selModelo");
const libre2 = $("#inpModeloLibre");
// "mi-modelo-personalizado" no esta en el catalogo: corresponde "__libre__"
check("al reabrir, un modelo propio queda en el campo manual",
      selMod2.value === "__libre__" && (libre2.value || "") === "mi-modelo-personalizado",
      `sel=${selMod2.value} libre=${libre2.value}`);
check("y el campo manual se muestra", libre2.style.display !== "none", libre2.style.display);

// ahora uno que SI esta en el catalogo
await window.eval('window.__X.Api.post("/api/settings", {ai_provider:"opencode", ai_model:"big-pickle"})');
await wait(1200);
await window.eval('window.__X.go("settings", {})');
await wait(2500);
check("un modelo del catalogo se marca en el desplegable",
      $("#selModelo").value === "big-pickle", $("#selModelo").value);
check("y el campo manual queda vacio y oculto",
      ($("#inpModeloLibre").value || "") === "" && $("#inpModeloLibre").style.display === "none",
      `libre=${$("#inpModeloLibre").value} display=${$("#inpModeloLibre").style.display}`);
console.log(`      -> lateral: ${$("#engineName").textContent} / ${$("#engineModel").textContent}`);

console.log("\n=== 6. Ortografia de los modulos ===");
const nav = await window.eval('window.__X.go("campanas", {})');
await wait(1500);
const txt = doc.querySelector("#view").textContent;
check("se escribe 'Campañas' con enye", txt.includes("Campañas") || txt.includes("campaña"),
      txt.slice(0, 60));
const titulo = doc.querySelector("#pageTitle").textContent;
check("el titulo de la pagina lleva enye", titulo === "Campañas", titulo);

console.log(`\n${"=".repeat(52)}\n  ${ok} correctos | ${fail} fallidos\n${"=".repeat(52)}\n`);
window.close();
process.exit(fail ? 1 : 0);
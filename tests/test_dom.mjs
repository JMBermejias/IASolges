// Prueba de interfaz con DOM real (jsdom). Reproduce el flujo del usuario:
// arrancar en Inicio y pulsar en Configuracion.
//   node tests/test_dom.mjs [http://127.0.0.1:8791]
// Requiere jsdom: npm install jsdom
/**
 * Prueba del flujo REAL de la vista de Configuracion en un DOM completo.
 * Reproduce lo que hace el usuario: arrancar en Inicio y pulsar en Configuracion.
 *   node /tmp/opencode/domtest/test_settings.mjs [http://127.0.0.1:8791]
 */
import fs from "node:fs";
import path from "node:path";
// jsdom puede venir de NODE_PATH o de la cache del release.
let JSDOM;
try {
  ({ JSDOM } = await import("jsdom"));
} catch {
  const { createRequire } = await import("node:module");
  const cache = process.env.IASOLGES_JSDOM || `${process.env.TMPDIR || "/tmp"}/iasolges-jsdom`;
  ({ JSDOM } = createRequire(`${cache}/package.json`)("jsdom"));
}

const BASE = process.argv[2] || "http://127.0.0.1:8791";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(HERE, "..", "src", "iasolges", "static", "js");

let ok = 0, fail = 0;
const check = (l, c, d = "") => {
  if (c) { ok++; console.log(`  \x1b[32mOK\x1b[0m   ${l}`); }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m ${l}  ${d}`); }
};

// 1) HTML real servido por la app
const html = await (await fetch(BASE + "/")).text();

// 2) DOM completo, como en la ventana nativa
const dom = new JSDOM(html, {
  url: BASE + "/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;
// fetch real contra la app
window.fetch = (u, o) => fetch(u.startsWith("http") ? u : BASE + u, o);
window.URLSearchParams = URLSearchParams;
window.confirm = () => true;

// Un solo eval: las declaraciones const/let comparten ambito lexical.
const bundle = ["core.js", "views.js", "app.js"]
  .map(f => fs.readFileSync(path.join(JS, f), "utf8")).join("\n");
window.eval(bundle + "\n;window.__X={boot,go,VIEWS,State,Api,$};");
window.__X.boot = window.__X.boot || null;

// 3) arranque. jsdom puede disparar DOMContentLoaded antes o despues del eval,
//    asi que se espera y solo se fuerza si la app aun no ha arrancado.
await new Promise(r => setTimeout(r, 1200));
if (docLayout().hidden) await window.eval("window.__X.boot()");
await new Promise(r => setTimeout(r, 2500));

function docLayout() { return window.document.querySelector("#layout"); }

const doc = window.document;
console.log("\n=== Arranque ===");
check("el arranque completo la vista", !!doc.querySelector("#view").innerHTML.length,
      (doc.querySelector("#view").innerHTML.length || 0) + " chars");
check("la barra lateral se construyo", doc.querySelectorAll(".side-item").length > 10,
      String(doc.querySelectorAll(".side-item").length));
check("no hay modal visible", doc.querySelector("#modalRoot").hidden === true);

console.log("\n=== Navegar a Configuracion (como el usuario) ===");
await window.eval('window.__X.go("settings", {})');
await new Promise(r => setTimeout(r, 2500));

const sel = doc.querySelector("#selModelo");
const libre = doc.querySelector("#inpModeloLibre");
check("existe el selector de modelo", !!sel);
check("el selector TIENE opciones", sel && sel.options.length > 1,
      sel ? `${sel.options.length} opciones` : "no existe");
check("el selector NO esta vacio", sel && sel.innerHTML.trim().length > 0,
      sel ? `innerHTML=${sel.innerHTML.length} chars` : "-");
if (sel && sel.options.length) {
  const ids = Array.from(sel.options).map(o => o.value).filter(Boolean);
  console.log(`      -> ${ids.length} opciones, primeras: ${ids.slice(0, 6).join(", ")}`);
  check("incluye el motor local", ids.some(i => /motor|iasolges/i.test(i)), ids.slice(0, 4).join(","));
  check("tiene opcion de escribir a mano", ids.some(i => i === "__libre__"));
  check("tiene grupos (optgroup)", sel.querySelectorAll("optgroup").length > 0,
        String(sel.querySelectorAll("optgroup").length));
}
check("campo de texto libre existe", !!libre);
const info = doc.querySelector("#modelInfo");
check("indicador de estado presente", !!info && info.innerHTML.length > 0,
      info ? info.innerHTML.slice(0, 60) : "vacío");
console.log(`      -> estado: ${info ? info.textContent.trim().slice(0, 70) : "-"}`);

console.log("\n=== Cambiar de proveedor recarga la lista ===");
if (sel) {
  const antes = sel.options.length;
  const selProv = doc.querySelector("#setForm [name=ai_provider]");
  check("existe el select de proveedor", !!selProv);
  if (selProv) {
    selProv.value = "opencode";
    selProv.dispatchEvent(new window.Event("change"));
    await new Promise(r => setTimeout(r, 3000));
    const sel2 = doc.querySelector("#selModelo");
    const ids = Array.from(sel2.options).map(o => o.value).filter(Boolean);
    console.log(`      -> tras cambiar a OpenCode: ${sel2.options.length} opciones`);
    console.log(`      -> primeras: ${ids.slice(0, 8).join(", ")}`);
    check("al cambiar de proveedor se recarga", sel2.options.length >= antes,
          `${antes} -> ${sel2.options.length}`);
    check("incluye space-bunny-free", ids.includes("space-bunny-free"), ids.slice(0, 6).join(","));
    check("incluye los otros modelos de OpenCode",
          ids.includes("big-pickle") && ids.includes("cat-jam-free"),
          ids.slice(0, 10).join(","));
  }
}

console.log("\n=== Cambiar a un proveedor sin clave ===");
{
  const selProv = doc.querySelector("#setForm [name=ai_provider]");
  selProv.value = "openai";
  selProv.dispatchEvent(new window.Event("change"));
  await new Promise(r => setTimeout(r, 2500));
  const sel2 = doc.querySelector("#selModelo");
  const ids = Array.from(sel2.options).map(o => o.value).filter(Boolean);
  console.log(`      -> OpenAI: ${sel2.options.length} opciones -> ${ids.join(", ")}`);
  check("OpenAI ofrece sugeridos sin clave", ids.length >= 5, String(ids.length));
  check("OpenAI incluye gpt-4o-mini", ids.includes("gpt-4o-mini"), ids.join(","));
  const inf = doc.querySelector("#modelInfo");
  console.log(`      -> estado: ${inf.textContent.trim().slice(0, 80)}`);
}

console.log(`\n${"=".repeat(52)}\n  ${ok} correctos | ${fail} fallidos\n${"=".repeat(52)}\n`);
window.close();
process.exit(fail ? 1 : 0);
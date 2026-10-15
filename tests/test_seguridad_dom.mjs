/**
 * Chequeo de Seguridad: el modo "Automatico con IA" debe existir, verse claro
 * y analizar solo; y el modo manual no debe lanzar nada por su cuenta.
 *   node tests/test_seguridad_dom.mjs [http://127.0.0.1:8791]
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
  + "\n;window.__X={boot,go,State,Api,$,Security,toast};");

const wait = ms => new Promise(r => setTimeout(r, ms));
const doc = window.document;
const $ = s => doc.querySelector(s);

const CONT = `API_KEY = "sk-live-9f8a7b6c5d4e3f2a1b0c9d8e"
export const q = "SELECT * FROM users WHERE id = " + req.query.id;
// correo: contacto@empresa.es
password = "MiC0ntraseñaSegura2024"`;

await wait(1200);
if ($("#layout").hidden) await window.eval("window.__X.boot()");
await wait(2200);

console.log("\n=== 1. El selector de tipo de analisis existe ===");
await window.eval('window.__X.go("seguridad", {})');
await wait(1800);
const modo = $("#secForm [name=analisis_mode]");
check("existe el desplegable de tipo de analisis", !!modo);
const ops = modo ? Array.from(modo.options).map(o => ({ v: o.value, t: o.textContent.trim() })) : [];
console.log(`      -> opciones: ${ops.map(o => `${o.v}="${o.t}"`).join(" | ")}`);
check("ofrece la opcion 'Automatico con IA'", ops.some(o => o.v === "auto" && /automatico/i.test(o.t)),
      JSON.stringify(ops));
check("ofrece la opcion 'Manual'", ops.some(o => o.v === "manual" && /manual/i.test(o.t)),
      JSON.stringify(ops));
check("viene elegido el automatico por defecto", modo && modo.value === "auto",
      modo ? modo.value : "-");

console.log("\n=== 2. El aviso dice que el automatico esta activo ===");
const estado = $("#secEstado");
check("hay un aviso de estado visible", !!estado);
const txtEstado = estado ? estado.querySelector(".sec-modo-txt").textContent : "";
check("el aviso anuncia el modo automatico", /automatico con ia activo/i.test(txtEstado), txtEstado.slice(0, 70));
check("el aviso explica que no hay que pulsar nada", /no hace falta que pulses/i.test(txtEstado),
      txtEstado.slice(0, 70));
check("el aviso NO dice solo 'chequeo manual'",
      !/^\s*chequeo manual\s*$/i.test(String($("#secForm [name=title]").value || "")), "-");

console.log("\n=== 3. Escribir dispara el analisis automatico ===");
const salida = $("#secOut");
const flag = () => salida.dataset.tieneInforme || "0";
const ta = $("#secForm [name=content]");
ta.value = CONT;
ta.dispatchEvent(new window.Event("input", { bubbles: true }));
check("no analiza al instante, espera a que pares", flag() === "0", flag());
check("avisa de que va a analizar solo",
      /se analizara solo/i.test($("#secEstado").querySelector(".sec-modo-txt").textContent),
      $("#secEstado").querySelector(".sec-modo-txt").textContent.slice(0, 70));
await wait(3500);
check("el analisis automatico se ejecuta solo", $("#secOut").dataset.tieneInforme === "1",
      "tieneInforme=" + $("#secOut").dataset.tieneInforme);
const informe = $("#secOut").textContent;
check("el informe detecta el riesgo", /riesgo|critic|alto|medio/i.test(informe), informe.slice(0, 80));

console.log("\n=== 4. Cambiar a manual detiene el analisis automatico ===");
modo.value = "manual";
modo.dispatchEvent(new window.Event("change", { bubbles: true }));
await wait(400);
check("el aviso pasa a modo manual", $("#secEstado").dataset.modo === "manual", $("#secEstado").dataset.modo);
const txtManual = $("#secEstado").querySelector(".sec-modo-txt").textContent;
check("el aviso manual dice que hay que pulsar", /pulsa.*analizar ahora/i.test(txtManual),
      txtManual.slice(0, 70));

salida.innerHTML = "<p id=marcador>sin analizar</p>";
salida.dataset.tieneInforme = "0";
ta.value = "";
ta.dispatchEvent(new window.Event("input", { bubbles: true }));
ta.value = CONT + "\n// otro comentario";
ta.dispatchEvent(new window.Event("input", { bubbles: true }));
await wait(3500);
check("en manual NO se analiza solo (el panel no se toca)",
      $("#marcador") !== null && salida.dataset.tieneInforme !== "1",
      `tieneInforme=${salida.dataset.tieneInforme} marcador=${!!$("#marcador")}`);

console.log("\n=== 5. En manual, 'Analizar ahora' si funciona ===");
$("#btnSecRun").click();
await wait(3500);
check("el boton manual genera el informe", $("#secOut").dataset.tieneInforme === "1",
      "tieneInforme=" + $("#secOut").dataset.tieneInforme);

console.log("\n=== 6. Volver a automatico reanuda el analisis solo ===");
modo.value = "auto";
modo.dispatchEvent(new window.Event("change", { bubbles: true }));
await wait(4000);
check("al volver a automatico se analiza", $("#secOut").dataset.tieneInforme === "1",
      "tieneInforme=" + $("#secOut").dataset.tieneInforme);
check("y el aviso vuelve a modo automatico", $("#secEstado").dataset.modo === "auto",
      $("#secEstado").dataset.modo);

console.log(`\n${"=".repeat(52)}\n  ${ok} correctos | ${fail} fallidos\n${"=".repeat(52)}\n`);
window.close();
process.exit(fail ? 1 : 0);
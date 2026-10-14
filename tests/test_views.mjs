/**
 * Test de las vistas del frontend (views.js) contra la API real.
 * Ejecuta cada VIEWS[...] en un contexto Node con un DOM minimo.
 *   node tests/test_views.mjs [http://127.0.0.1:8791]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] || "http://127.0.0.1:8791";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS = path.join(ROOT, "src/iasolges/static/js");

let ok = 0, fail = 0;
const check = (label, cond, detail = "") => {
  if (cond) { ok++; console.log(`  \x1b[32mOK\x1b[0m   ${label}`); }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m ${label}  ${detail}`); }
};

/* ---------- DOM minimo ---------- */
const el = () => ({
  style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){return false} },
  children: [], innerHTML: "", textContent: "", value: "", hidden: false,
  appendChild(c){ this.children.push(c); }, remove(){}, addEventListener(){},
  insertAdjacentHTML(){}, querySelector(){ return el(); },
  querySelectorAll(){ return []; }, setAttribute(){}, getAttribute(){ return null; },
  closest(){ return null; }, focus(){}, get firstChild(){ return null; },
});
const doc = {
  querySelector: () => el(),
  querySelectorAll: () => [],
  createElement: () => el(),
  addEventListener: () => {},
  body: el(),
  documentElement: el(),
  title: "",
};

const sandbox = {
  console,
  document: doc,
  window: { addEventListener() {}, location: {} },
  location: { hash: "", href: BASE },
  history: {},
  navigator: { clipboard: { writeText: async () => {} } },
  fetch: (u, o) => fetch(u.startsWith("http") ? u : BASE + u, o),
  setTimeout, clearTimeout, setInterval, clearInterval,
  Blob: class { constructor() {} },
  URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
  FormData: globalThis.FormData,
  confirm: () => true,
  alert: () => {},
  crypto,
  TextEncoder, TextDecoder,
  URLSearchParams,
  Response,
  Request,
  Headers,
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

for (const f of ["core.js", "views.js", "app.js"]) {
  const code = fs.readFileSync(path.join(JS, f), "utf8");
  try {
    vm.runInContext(code, sandbox, { filename: f });
  } catch (e) {
    console.log(`\x1b[31mNo se pudo cargar ${f}: ${e.message}\x1b[0m`);
    process.exit(1);
  }
}

// Las declaraciones `const` viven en el ambito lexico del contexto, no en el
// objeto global: se extraen explicitamente para poder inspeccionarlas.
vm.runInContext(
  "globalThis.__X = { NAV, DASH_CARDS, VIEWS, CFG, SECTORS, md, esc, icon, Api, State };",
  sandbox);
const { VIEWS, NAV, DASH_CARDS, md, esc, icon, CFG } = sandbox.__X;

/* ---------- datos: las vistas de tabla necesitan registros ---------- */
await fetch(BASE + "/api/seed-demo", { method: "POST" });
const extra = [
  ["clients", { name: "Vista Test SL", sector: "legal", city: "Sevilla", value: 21000, status: "potencial" }],
  ["works", { title: "Trabajo Vista", type: "web", status: "en_proceso", progress: 40 }],
  ["pricing", { name: "Precio Vista", cost: 10, price: 40 }],
  ["quotes", { title: "Presupuesto Vista", status: "enviado", tax_rate: 21,
               items: [{ description: "Consultoria", qty: 4, unit_price: 50, discount: 0 }] }],
];
for (const [m, b] of extra) {
  await fetch(BASE + "/api/" + m, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
}

/* ---------- pruebas ---------- */
console.log("\n=== Estructura de navegacion ===");
const groups = NAV.map(g => g.group);
check("3 grupos", groups.length === 3, groups.join(","));
check("grupo Plataforma", groups[0] === "Plataforma");
check("grupo Flujo de Trabajo", groups[1] === "Flujo de Trabajo");
check("grupo Adicionales", groups[2] === "Adicionales");

const expect = {
  "Plataforma": ["inicio", "mi-trabajo", "clientes", "contactos", "campanas", "favoritos"],
  "Flujo de Trabajo": ["mapa", "prompts", "seguridad", "precios", "prospectores"],
  "Adicionales": ["nombres", "kit-marca", "analizador", "presupuestos"],
};
let allCards = true;
for (const g of NAV) {
  const got = g.items.map(i => i.route);
  const want = expect[g.group];
  const okg = want.every(w => got.includes(w)) && got.length === want.length;
  if (!okg) allCards = false;
  check(`${g.group}: ${got.join(", ")}`, okg, `esperado ${want.join(", ")}`);
}
check("dashboard replica los 15 modulos", DASH_CARDS.length === 15, String(DASH_CARDS.length));

console.log("\n=== Utilidades ===");
check("esc escapa HTML", esc('<b>&"') === "&lt;b&gt;&amp;&quot;", esc('<b>&"'));
check("icon devuelve svg", icon("users").startsWith("<svg") && icon("users").includes("path"));
check("icon desconocido -> info", icon("noexiste").includes("circle"));
check("md headings", md("# H1\n## H2").includes("<h1>H1</h1>") && md("# H1\n## H2").includes("<h2>H2</h2>"), md("# H1\n## H2"));
check("md tabla", md("| a | b |\n|---|---|\n| 1 | 2 |").includes("<table>"),
      md("| a | b |\n|---|---|\n| 1 | 2 |"));
check("md lista", md("- uno\n- dos").includes("<ul>") && md("- uno").includes("<li>uno</li>"),
      md("- uno\n- dos"));
check("md codigo", md("```py\nx=1\n```").includes("<pre><code>x=1"));
check("md inline", md("**negrita** y `code`").includes("<strong>negrita</strong>")
      && md("**negrita** y `code`").includes("<code>code</code>"), md("**negrita** y `code`"));
check("md tabla sin <br> dentro",
      !/<t[dh][^>]*>[\s\S]*?<br>/.test(md("| a | b |\n|---|---|\n| 1 | 2 |")),
      md("| a | b |\n|---|---|\n| 1 | 2 |"));
check("md sin <br> entre bloques", !/h1>[^<]*<br>/.test(md("# H1\n## H2")), md("# H1\n## H2"));
check("md bloquequote", md("> cita").includes("<blockquote>cita</blockquote>"), md("> cita"));

console.log("\n=== Iconos estaticos ===");
{
  const fs2 = await import("node:fs");
  const html = fs2.readFileSync(path.join(ROOT, "src/iasolges/static/index.html"), "utf8");
  const usados = [...html.matchAll(/data-icon="([a-z-]+)"/g)].map(m => m[1]);
  check("index.html tiene data-icon", usados.length > 0, String(usados.length));
  const faltan = usados.filter(n => !sandbox.__X.icon(n).includes("path")
                                    && !sandbox.__X.icon(n).includes("circle"));
  check("todos los data-icon existen en ICONS", faltan.length === 0, faltan.join(","));
}

console.log("\n=== Render de cada vista contra la API real ===");
const ROUTES = ["inicio", "mi-trabajo", "clientes", "contactos", "campanas", "favoritos",
                "mapa", "prompts", "seguridad", "precios", "prospectores", "nombres",
                "kit-marca", "analizador", "presupuestos", "settings"];
for (const r of ROUTES) {
  if (typeof VIEWS[r] !== "function") { check(`vista ${r} existe`, false, "no registrada"); continue; }
  try {
    const html = await VIEWS[r]({ q: {} });
    check(`render ${r}`, typeof html === "string" && html.length > 300,
          `len=${(html || "").length}`);
  } catch (e) {
    check(`render ${r}`, false, e.message);
  }
}

console.log("\n=== Contenido esperado por vista ===");
const INICIO = await VIEWS["inicio"]({ q: {} });
check("inicio: 8 KPIs", (INICIO.match(/class="kpi /g) || []).length === 8,
      String((INICIO.match(/class="kpi /g) || []).length));
check("inicio: 15 tarjetas", (INICIO.match(/class="card"/g) || []).length === 15,
      String((INICIO.match(/class="card"/g) || []).length));
check("inicio: 3 grupos de tarjetas",
      ["Plataforma", "Flujo de Trabajo", "Adicionales"].every(g => INICIO.includes(g)));
check("inicio: constructor IA", INICIO.includes("Constructor"));

const CLI = await VIEWS["clientes"]({ q: {} });
check("clientes: tabla con columnas",
      CLI.includes("<th>Cliente</th>") && CLI.includes(">Valor</th>") && CLI.includes("<th>Estado</th>"),
      CLI.slice(0, 200));
check("clientes: panel IA", CLI.includes("Analisis de cliente"));

const PRESU = await VIEWS["presupuestos"]({ q: {} });
check("presupuestos: KPIs", (PRESU.match(/class="kpi/g) || []).length >= 3);
check("presupuestos: exportar CSV", PRESU.includes("exportall"));

const SEG = await VIEWS["seguridad"]({ q: {} });
check("seguridad: formulario", SEG.includes('id="secForm"') && SEG.includes("API key") === false);
check("seguridad: reglas listadas", SEG.includes("tokens expuestos"));

const MAPA = await VIEWS["mapa"]({ q: {} });
check("mapa: formulario", MAPA.includes('id="geoForm"'));
check("mapa: zonas", MAPA.includes("Barcelona") && MAPA.includes("Valencia"));

const PROM = await VIEWS["prompts"]({ q: {} });
check("prompts: optimizador", PROM.includes("Optimizador de prompts"));

const KIT = await VIEWS["kit-marca"]({ q: {} });
check("kit-marca: generador", KIT.includes("Generador de kit de marca"));

const NOM = await VIEWS["nombres"]({ q: {} });
check("nombres: generador", NOM.includes("Generador de nombres"));

const PRE = await VIEWS["precios"]({ q: {} });
check("precios: analisis IA", PRE.includes("Analisis de precios"));

const PROS = await VIEWS["prospectores"]({ q: {} });
check("prospectores: generador", PROS.includes("Generador de prospectos"));

const ANA = await VIEWS["analizador"]({ q: {} });
check("analizador: panel IA", ANA.includes("Analizador de contenido"));

const TRAB = await VIEWS["mi-trabajo"]({ q: {} });
check("mi-trabajo: constructor", TRAB.includes("Constructor de programas"));

const FAV = await VIEWS["favoritos"]({ q: {} });
check("favoritos: vista", FAV.includes("Favoritos"));

const SET = await VIEWS["settings"]({ q: {} });
check("settings: proveedores IA", SET.includes("OpenAI") && SET.includes("Motor IA Local"));
check("settings: clave nunca en claro", !SET.includes('type="password" value="sk-'),
      "clave expuesta");

console.log("\n=== Filtros y busqueda propagados ===");
const filt = await VIEWS["clientes"]({ q: { search: "Nova" } });
check("busqueda aplica", typeof filt === "string" && filt.length > 100);
const est = await VIEWS["campanas"]({ q: { status: "activa" } });
check("filtro estado aplica", typeof est === "string" && est.length > 100);

console.log(`\n${"=".repeat(52)}\n  ${ok} correctos | ${fail} fallidos\n${"=".repeat(52)}\n`);
process.exit(fail ? 1 : 0);
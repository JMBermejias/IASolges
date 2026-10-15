#!/usr/bin/env bash
# =============================================================
#  IASolges - publica una nueva release completa
#
#  Uso:  ./scripts/release.sh [patch|minor|major] ["Descripción"]
#
#  Hace todo el ciclo:
#    1. Sube la versión en el código
#    2. Actualiza el CHANGELOG
#    3. Ejecuta las pruebas
#    4. Construye el paquete .deb
#    5. Verifica el paquete
#    6. Commit, tag y push a GitHub
#    7. Crea la release en GitHub con el .deb adjunto
# =============================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
NIVEL="${1:-patch}"
DESCRIPCION="${2:-}"

if [ -z "$DESCRIPCION" ]; then
  echo "ERROR: falta la descripción de los cambios." >&2
  echo "Uso: ./scripts/release.sh patch \"Descripción de los cambios\"" >&2
  exit 1
fi

case "$NIVEL" in
  patch) VER_PARTE="PATCH" ;;
  minor) VER_PARTE="MINOR" ;;
  major) VER_PARTE="MAJOR" ;;
  *) echo "ERROR: nivel '$NIVEL' no valido (usa patch, minor o major)." >&2; exit 1 ;;
esac

# ---- token --------------------------------------------------------
if [ -z "${GH_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ]; then
  echo ""
  echo "  Necesita un token de GitHub para publicar la release."
  echo "  Exporte el token antes de ejecutar:"
  echo ""
  echo "      export GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx"
  echo ""
  exit 1
fi
export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

# ---- 1. version --------------------------------------------------
VERSION_ACTUAL="$(sed -n 's/^__version__ = "\(.*\)"/\1/p' src/iasolges/__init__.py)"
IFS='.' read -r MA MAY PA <<< "$VERSION_ACTUAL"
case "$NIVEL" in
  patch) PA=$((PA+1)) ;;
  minor) MAY=$((MAY+1)); PA=0 ;;
  major) MA=$((MA+1)); MAY=0; PA=0 ;;
esac
VERSION="${MA}.${MAY}.${PA}"

if git rev-parse -q --verify "refs/tags/v${VERSION}" >/dev/null; then
  echo "ERROR: la etiqueta v${VERSION} ya existe." >&2
  exit 1
fi

echo ""
echo "  IASolges ${VERSION_ACTUAL}  ->  ${VERSION}   (${VER_PARTE})"
echo "  ${DESCRIPCION}"
echo "  --------------------------------------------------------"

# ---- 2. codigo ----------------------------------------------------
sed -i "s/^__version__ = \".*\"/__version__ = \"${VERSION}\"/" src/iasolges/__init__.py
grep -q "^__version__" src/iasolges/__init__.py || {
  echo "  ERROR: no se pudo actualizar __version__" >&2; exit 1; }

FECHA="$(date +%Y-%m-%d)"
cat >> CHANGELOG.md <<EOF

## [${VERSION}] - ${FECHA}

${DESCRIPCION}

EOF
echo "  [1/7] Version actualizada a ${VERSION}"

# ---- 3. pruebas ---------------------------------------------------
echo "  [2/7] Ejecutando pruebas..."
python3 -m compileall -q src/iasolges
for f in src/iasolges/static/js/*.js; do node --check "$f"; done
desktop-file-validate packaging/iasolges.desktop

PUERTO_TEST=$((8900 + RANDOM % 90))
rm -rf /tmp/iasolges-test-data
mkdir -p /tmp/iasolges-test-data
(cd src && setsid python3 -m iasolges --no-browser --port="$PUERTO_TEST" \
    --data-dir=/tmp/iasolges-test-data > /tmp/iasolges-test.log 2>&1 < /dev/null &)
for i in $(seq 1 40); do
  curl -sf "http://127.0.0.1:${PUERTO_TEST}/api/ping" >/dev/null 2>&1 && break
  sleep 0.25
done
if ! curl -sf "http://127.0.0.1:${PUERTO_TEST}/api/ping" >/dev/null 2>&1; then
  echo "  ERROR: el servidor de pruebas no arranco. Log:" >&2
  cat /tmp/iasolges-test.log >&2
  exit 1
fi
python3 tests/test_cache_osm.py | tail -3
python3 tests/test_api.py "http://127.0.0.1:${PUERTO_TEST}" | tail -3
node tests/test_views.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3

# Prueba de interfaz con DOM real (opcional: necesita jsdom).
if node -e "require('jsdom')" >/dev/null 2>&1; then
    echo "  Ejecutando pruebas de DOM (jsdom)..."
    node tests/test_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_modules_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_modelo_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_seguridad_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_mapa_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_mapa_real_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_mapa_honesto_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
else
    CACHE_JS="${TMPDIR:-/tmp}/iasolges-jsdom"
    echo "  Instalando jsdom en $CACHE_JS para la prueba de DOM..."
    mkdir -p "$CACHE_JS"
    ( cd "$CACHE_JS" && npm install jsdom --silent --no-audit --no-fund >/dev/null 2>&1 ) || true
    if [ -d "$CACHE_JS/node_modules/jsdom" ]; then
        node tests/test_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
        node tests/test_modules_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_modelo_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_seguridad_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_mapa_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_mapa_real_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    node tests/test_mapa_honesto_dom.mjs "http://127.0.0.1:${PUERTO_TEST}" | tail -3
    else
        echo "  AVISO: no se pudo instalar jsdom; se omite la prueba de DOM."
    fi
fi
PID_TEST="$(ss -lptn "sport = :${PUERTO_TEST}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)"
[ -n "$PID_TEST" ] && kill "$PID_TEST" 2>/dev/null || true
rm -rf /tmp/iasolges-test-data
echo "  Pruebas superadas."

# ---- 4. paquete --------------------------------------------------
echo "  [3/7] Construyendo el paquete .deb..."
./scripts/build_deb.sh | tail -6
DEB="$ROOT/dist/iasolges_${VERSION}_all.deb"
[ -f "$DEB" ] || { echo "  ERROR: no se genero el paquete." >&2; exit 1; }

# ---- 5. verificacion ---------------------------------------------
echo "  [4/7] Verificando el paquete..."
dpkg-deb --info "$DEB" >/dev/null
CONT="$(dpkg-deb --contents "$DEB" | wc -l)"
grep -q "^Package: iasolges" <(dpkg-deb --control "$DEB" control 2>/dev/null || true) 2>/dev/null || true
echo "      Version:    ${VERSION}"
echo "      Ficheros:   ${CONT}"
echo "      Tamano:     $(du -h "$DEB" | cut -f1)"

# ---- 6. commit + push --------------------------------------------
echo "  [5/7] Publicando el codigo..."
find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
git add -A
git -c user.name="JMBermejias" -c user.email="noreply@users.noreply.github.com" \
    commit -q -m "IASolges ${VERSION}: ${DESCRIPCION}"
git tag -a "v${VERSION}" -m "IASolges ${VERSION}"
git push "https://x-access-token:${GH_TOKEN}@github.com/JMBermejias/IASolges.git" main
git push "https://x-access-token:${GH_TOKEN}@github.com/JMBermejias/IASolges.git" "v${VERSION}"

# ---- 7. release --------------------------------------------------
echo "  [6/7] Creando la release en GitHub..."
cat > /tmp/iasolges-notes.md <<EOF
## IASolges ${VERSION}

${DESCRIPCION}

### Instalación

\`\`\`bash
sudo apt install ./iasolges_${VERSION}_all.deb
\`\`\`

Después abre **IASolges** desde el menú de aplicaciones o ejecuta \`iasolges\`.

### Requisitos

Solo \`python3\` (>= 3.8). Para la ventana nativa de escritorio se recomienda
\`python3-gi\` y \`gir1.2-webkit2-4.1\` (ya vienen en Zorin OS).

\`\`\`bash
sudo apt install python3-gi gir1.2-webkit2-4.1
\`\`\`

Sin esos paquetes la app sigue funcionando y abre la interfaz en el navegador.
EOF

gh release create "v${VERSION}" "$DEB" \
  --repo JMBermejias/IASolges \
  --title "IASolges ${VERSION}" \
  --notes-file /tmp/iasolges-notes.md

echo "  [7/7] Release publicada."
echo ""
echo "  --------------------------------------------------------"
echo "  Release ${VERSION} lista:"
echo "    https://github.com/JMBermejias/IASolges/releases/tag/v${VERSION}"
echo ""
echo "  Paquete local:  ${DEB}"
echo "  Para instalar:  sudo apt install ${DEB}"
echo "  --------------------------------------------------------"
echo ""
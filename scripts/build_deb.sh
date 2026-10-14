#!/usr/bin/env bash
# =============================================================
#  IASolges - constructor del paquete .deb para Zorin OS / Ubuntu
# =============================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PKG="iasolges"
APPDIR="/opt/$PKG"

# ---- metadatos ------------------------------------------------
NAME="IASolges"
DESC="Plataforma de inteligencia artificial para gestion comercial y generacion automatica de programas personalizados."
VERSION="$(sed -n 's/^__version__ = "\(.*\)"/\1/p' src/iasolges/__init__.py)"
VERSION="${VERSION:-1.0.0}"
ARCH="all"
SIZE_KB="$(du -sk src | cut -f1)"
INSTALLED_KB=$((SIZE_KB + 320))
MAINTAINER="JMBermejias <noreply@users.noreply.github.com>"
HOMEPAGE="https://github.com/JMBermejias/IASolges"
SECTION="utils"
PRIORITY="optional"

BUILD="$ROOT/build/$PKG"
DIST="$ROOT/dist"

echo ""
echo "  Construyendo $PKG $VERSION ($ARCH)"
echo "  ---------------------------------------------"

# ---- 1. limpieza ---------------------------------------------
rm -rf "$BUILD"
mkdir -p "$BUILD/DEBIAN" "$BUILD/opt" "$BUILD/usr/bin" "$BUILD/usr/share/applications" \
         "$BUILD/usr/share/metainfo" "$BUILD/usr/share/doc/$PKG" "$DIST"

# ---- 2. codigo de la aplicacion ------------------------------
echo "  [1/6] Copiando codigo a $APPDIR ..."
mkdir -p "$BUILD$APPDIR"
cp -r src/iasolges "$BUILD$APPDIR/iasolges"
cp packaging/run.py "$BUILD$APPDIR/run.py"

# Sin .pyc ni cachés dentro del paquete
find "$BUILD$APPDIR" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
find "$BUILD$APPDIR" -name '*.pyc' -delete 2>/dev/null || true
find "$BUILD$APPDIR" -name '.*' -type f -delete 2>/dev/null || true

# ---- 3. lanzador, escritorio, icono y documentacion ----------
echo "  [2/6] Instalando lanzador y entradas de menu ..."
install -m 0755 packaging/bin/"$PKG" "$BUILD/usr/bin/$PKG"
install -m 0644 packaging/"$PKG".desktop "$BUILD/usr/share/applications/$PKG.desktop"
install -m 0644 packaging/"$PKG".appdata.xml "$BUILD/usr/share/metainfo/$PKG.appdata.xml"

echo "  [3/6] Instalando iconos ..."
if [ -d packaging/icons/hicolor ]; then
    mkdir -p "$BUILD/usr/share/icons"
    cp -r packaging/icons/hicolor "$BUILD/usr/share/icons/"
    find "$BUILD/usr/share/icons" -type f -name '*.png' -exec chmod 0644 {} +
    find "$BUILD/usr/share/icons" -type f -name '*.svg' -exec chmod 0644 {} +
else
    python3 scripts/make_icons.py packaging/icons >/dev/null
    mkdir -p "$BUILD/usr/share/icons"
    cp -r packaging/icons/hicolor "$BUILD/usr/share/icons/"
fi

echo "  [4/6] Anadiendo documentacion ..."
for f in README.md LICENSE CHANGELOG.md; do
    [ -f "$ROOT/$f" ] && install -m 0644 "$ROOT/$f" "$BUILD/usr/share/doc/$PKG/$f"
done

# ---- 4. control ------------------------------------------------
echo "  [5/6] Escribiendo metadatos del paquete ..."
cat > "$BUILD/DEBIAN/control" <<EOF
Package: $PKG
Version: $VERSION
Section: $SECTION
Priority: $PRIORITY
Architecture: $ARCH
Depends: python3 (>= 3.8)
Recommends: xdg-utils | x11-utils
Maintainer: $MAINTAINER
Homepage: $HOMEPAGE
Installed-Size: $INSTALLED_KB
Description: $NAME
 $DESC
 .
 Modulos de la plataforma:
 .
  * Plataforma: Inicio, Mi Trabajo, Clientes, Contactos, Campanas, Favoritos.
  * Flujo de Trabajo: Mapa Localizador de Clientes, Generador de Prompts,
    Chequeo de Seguridad, Precios, Prospectores.
  * Adicionales: Nombres, Kit de Marca, Analizador, Presupuestos.
 .
 Incluye un motor de inteligencia artificial local que funciona sin conexion
 y sin claves. Opcionalmente puede delegar en OpenAI, OpenRouter, DeepSeek,
 Anthropic u Ollama (configuracion -> Inteligencia Artificial).
 .
 Los datos se almacenan localmente en ~/.local/share/iasolges/iasolges.db.
EOF

install -m 0755 packaging/DEBIAN/postinst "$BUILD/DEBIAN/postinst"
install -m 0755 packaging/DEBIAN/prerm    "$BUILD/DEBIAN/prerm"
install -m 0755 packaging/DEBIAN/postrm   "$BUILD/DEBIAN/postrm"

echo "  DEBIAN/control:"
sed 's/^/      /' "$BUILD/DEBIAN/control" | head -14

# ---- 5. construir ---------------------------------------------
echo "  [6/6] Empaquetando ..."
DEB="$DIST/${PKG}_${VERSION}_${ARCH}.deb"
rm -f "$DEB"

if [ "$(id -u)" -eq 0 ]; then
    dpkg-deb --root-owner-group --build "$BUILD" "$DEB"
elif command -v fakeroot >/dev/null 2>&1; then
    fakeroot -- dpkg-deb --root-owner-group --build "$BUILD" "$DEB"
else
    echo "  AVISO: sin root ni fakeroot; los permisos/propietario pueden quedar como $(id -un)." >&2
    dpkg-deb --build "$BUILD" "$DEB"
fi

# ---- 6. verificacion ------------------------------------------
echo ""
echo "  Verificacion del paquete:"
dpkg-deb --info "$DEB" | sed 's/^/      /'
echo ""
echo "      Ficheros incluidos: $(dpkg-deb --contents "$DEB" | wc -l)"
echo "      Tamano: $(du -h "$DEB" | cut -f1)"
echo ""
echo "  ------------------------------------------------------------"
echo "  Paquete generado: $DEB"
echo ""
echo "  Instalar con:"
echo "      sudo apt install $DEB"
echo "      (o bien:  sudo dpkg -i $DEB)"
echo ""
echo "  Tras instalar, abre IASolges desde el menu de aplicaciones"
echo "  o ejecuta 'iasolges' en la terminal."
echo "  ------------------------------------------------------------"
echo ""
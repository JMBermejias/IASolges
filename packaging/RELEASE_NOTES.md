## IASolges 1.0.0

Plataforma de inteligencia artificial para gestión comercial y generación
automática de programas personalizados, empaquetada para Zorin OS / Ubuntu / Debian.

### Instalación

```bash
sudo apt install ./iasolges_1.0.0_all.deb
```

Después abre **IASolges** desde el menú de aplicaciones o ejecuta `iasolges`.

### Dependencias

Solo `python3` (>= 3.8). Sin pip, sin npm, sin paso de compilación.

### Módulos

**Plataforma** — Inicio · Mi Trabajo · Clientes · Contactos · Campañas · Favoritos

**Flujo de Trabajo** — Mapa Localizador de Clientes · Generador de Prompts ·
Chequeo de Seguridad · Precios · Prospectores

**Adicionales** — Nombres · Kit de Marca · Analizador · Presupuestos

Los 15 módulos aparecen en la barra lateral izquierda y como tarjetas en el
dashboard de inicio.

### Constructor IA

Describe el objetivo, sector, funciones, lenguaje, despliegue y nivel de acabado;
recibe un programa completo con especificación funcional, arquitectura, código
inicial ejecutable, plan de pruebas y estimación económica.

### Inteligencia artificial

- **Motor IA Local** integrado: funciona sin conexión y sin claves API.
- Proveedores opcionales: OpenAI, OpenRouter, DeepSeek, Anthropic, Ollama y
  endpoints compatibles con OpenAI.
- Si el proveedor remoto falla, la app vuelve automáticamente al motor local.

### Privacidad

Todos los datos se guardan localmente en SQLite en
`~/.local/share/iasolges/iasolges.db`. El servidor escucha solo en `127.0.0.1`.
---

### Nota de la v1.0.0 revisada

La primera versión tenía un fallo de arranque: el lanzador dependía del modo
ventana de Chrome/Chromium, que no existe en Firefox (el navegador por defecto
de Zorin), y además se mostraba un modal vacío tapando la interfaz.

**Correcciones incluidas en este paquete:**

- **Ventana nativa GTK + WebKit2**: la aplicación se abre ahora como programa de
  escritorio real, sin depender del navegador. Si no está disponible, recurre a
  Chromium/Edge o al navegador del sistema, y si tampoco funciona te muestra la
  dirección para abrirla a mano.
- **Modal fantasma eliminado**: el atributo `hidden` ya no lo sobrescribe el
  `display` de las hojas de estilo.
- **Iconos del menú superior** corregidos (el botón de tema se veía vacío).
- **Los datos se guardan en la carpeta de trabajo**: `<carpeta>/data/iasolges.db`.

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
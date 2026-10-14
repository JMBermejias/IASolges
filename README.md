# IASolges

**Plataforma de inteligencia artificial para gestión comercial y generación automática de programas personalizados.**

IASolges es una aplicación de escritorio para Linux (Zorin OS, Ubuntu, Debian, Fedora…) que
reúne en una sola plataforma la gestión de clientes y una IA integrada capaz de **generar
programas completos de forma automática** a partir de los parámetros que describes en cada
módulo: sector, objetivo, funciones, presupuesto, identidad de marca…

Funciona **sin conexión y sin claves API** gracias a un motor de IA local integrado. Si
prefieres un modelo de lenguaje real, puedes delegar en OpenAI, OpenRouter, DeepSeek,
Anthropic u Ollama desde *Configuración*.

---

## Módulos

Los mismos 15 módulos están disponibles en la **barra lateral de la izquierda** y en el
**dashboard de Inicio**, agrupados en tres bloques:

### Plataforma
| Módulo | Qué hace |
|---|---|
| **Inicio** | Dashboard con KPIs, tarjetas de todos los módulos, actividad reciente y gráfico de crecimiento. |
| **Mi Trabajo** | Proyectos y programas generados con IA, con progreso y prioridad. |
| **Clientes** | Cartera, segmentación, valor anual y análisis de encaje por IA. |
| **Contactos** | Personas de contacto vinculadas a cada cliente, con su cargo y estado comercial. |
| **Campañas** | Estrategia, copy listo para publicar y calendario editorial generados por IA. |
| **Favoritos** | Todo lo marcado con estrella, agrupado por módulo. |

### Flujo de Trabajo
| Módulo | Qué hace |
|---|---|
| **Mapa Localizador Clientes** | Localiza oportunidades por localidad, radio y sector; devuelve un mapa con puntuación y análisis de mercado. |
| **Generador de Prompts** | Biblioteca de prompts con variables, optimizador y prueba de ejecución. |
| **Chequeo de Seguridad** | Audita textos, código y configuraciones: claves expuestas, datos personales, URLs sin HTTPS, inyecciones, permisos excesivos. |
| **Precios** | Coste/precio, margen, escenarios por volumen, precio recomendado y argumentario de venta. |
| **Prospectores** | Genera y cualifica prospectos con puntuación de ajuste, señal detectada, pitch de 15 s y secuencia multicanal de 21 días. |

### Adicionales
| Módulo | Qué hace |
|---|---|
| **Nombres** | Generador de nombres de marca con significado, dominio sugerido y puntuación. |
| **Kit de Marca** | Identidad completa: concepto de logo, paleta de color, tipografía, tono de voz, propuesta de valor y eslogan. |
| **Analizador** | Analiza cualquier contenido: puntuación por dimensión, debilidades y recomendaciones. |
| **Presupuestos** | Propuestas comerciales con líneas, descuentos, IVA, narrativa por IA y exportación a HTML/CSV. |

---

## El Constructor IA

El corazón de la aplicación es el **Constructor de programas**. Describes:

- **Nombre** y **tipo** de programa (web, automatización, dashboard, integración, móvil, flujo)
- **Objetivo** en una frase
- **Funciones** que necesitas (citas, pacientes, facturación…)
- **Lenguaje** (Python, JavaScript, TypeScript, PHP, Java, C#, o flujo sin código)
- **Sector**, **despliegue** y **nivel de acabado**

Y recibes un programa completo con:

1. Especificación funcional y tabla de módulos con esfuerzo estimado
2. Arquitectura del sistema
3. **Código inicial funcional y ejecutable**
4. Plan de pruebas
5. Entregables
6. Estimación económica por fases
7. Estructura de ficheros del proyecto

Puedes copiarlo a Markdown o descargarlo como `.md`.

---

## Inteligencia artificial

### Motor IA Local (por defecto)
Integrado en la propia aplicación, **sin conexión y sin claves**. No es unplaceholder:
analiza los parámetros, aplica reglas del sector y genera contenido estructurado real
(estrategias, copy, paletas de color, análisis de precios, código inicial, informes de
seguridad…).

### Proveedores remotos (opcionales)
Configura una clave en *Configuración → Inteligencia Artificial*:

| Proveedor | Notas |
|---|---|
| OpenAI | GPT-4o / GPT-4o-mini |
| OpenRouter | Acceso a decenas de modelos |
| DeepSeek | Coste muy bajo |
| Anthropic | Claude |
| Ollama | Modelos locales, sin salir del equipo |
| Compatible OpenAI | Cualquier endpoint propio |

Si el proveedor remoto falla o agota el tiempo de espera, **la aplicación cae
automáticamente al Motor IA Local** y lo indica en la respuesta. Nunca te quedas sin
resultado.

---

## Instalación

### Paquete `.deb` (Zorin OS / Ubuntu / Debian)

```bash
sudo apt install ./iasolges_1.0.0_all.deb
# o bien:
sudo dpkg -i iasolges_1.0.0_all.deb
```

Después, abre **IASolges** desde el menú de aplicaciones o ejecuta:

```bash
iasolges
```

Para desinstalar conservando tus datos:

```bash
sudo apt remove iasolges
```

Para desinstalar y borrar también los datos:

```bash
sudo apt purge iasolges
```

### Desde el código

```bash
git clone https://github.com/JMBermejias/IASolges.git
cd IASolges
python3 -m iasolges            # o: cd src && python3 -m iasolges
```

Sin dependencias externas: **solo Python 3.8+**.

---

## Datos y privacidad

- Base de datos SQLite en `~/.local/share/iasolges/iasolges.db`
- Modo `700` en el directorio de datos
- El servidor escucha **solo en `127.0.0.1`** (nunca en la red)
- Nada sale de tu equipo salvo que configures deliberadamente un proveedor de IA remoto
- Tus datos sobreviven a las actualizaciones; las migraciones de esquema son no destructivas

---

## Requisitos

- Linux (probado en Zorin OS 18.1, Ubuntu 24.04)
- Python 3.8 o superior
- Un navegador para la interfaz (se abre en modo aplicación; funciona en Chromium, Chrome,
  Firefox y Edge)

---

## Desarrollo

```bash
# Ejecutar las pruebas de API (127 pruebas)
python3 src/iasolges --port=8791 &
python3 tests/test_api.py http://127.0.0.1:8791

# Ejecutar las pruebas de vistas (59 pruebas)
node tests/test_views.mjs http://127.0.0.1:8791

# Construir el paquete .deb
./scripts/build_deb.sh

# Regenerar iconos
python3 scripts/make_icons.py packaging/icons

# Instantanea visual de una vista
node scripts/snapshot.mjs inicio /tmp/snap.html
```

### Estructura

```
src/iasolges/
├── __main__.py     punto de entrada
├── launcher.py     arranca el servidor y abre la ventana
├── app.py          servidor HTTP, API REST y rutas
├── db.py           esquema, migraciones y CRUD sobre SQLite
├── ai.py           motor de IA: proveedores + motor local
└── static/         interfaz (HTML, CSS y JS sin compilar)
```

---

## Autor y licencia

**Jose Manuel Bernabeu Mejias**

Medico Rafael Navarro 2, 2C
Novelda, 03660 Alicante, España

Software bajo **licencia MIT**. Eres libre de usar, copiar, modificar, publicar,
distribuir, sublicenciar y/o vender este software.

Copyright (c) 2026 Jose Manuel Bernabeu Mejias — ver [LICENSE](LICENSE).

---

## Novedades de esta version

### Botones de la barra superior

- **Inicio**: vuelve al panel principal desde cualquier pantalla.
- **Actualizar**: comprueba manualmente si hay una version nueva en GitHub. Si la hay,
  muestra las novedades y ofrece instalarla en un solo paso.
- **Acerca de**: ficha con los datos del autor y la licencia MIT.

### Actualizaciones automaticas

IASolges consulta la ultima release de GitHub al arrancar y cada 6 horas. Si detecta una
version nueva aparece un aviso con el boton **Actualizar ahora**.

La instalacion se hace con `pkexec`, que pide tu contrasena de forma grafica. Si `pkexec`
no esta disponible, la aplicacion te muestra el comando exacto para ejecutarlo.

Por seguridad solo se descargan paquetes publicados en la release oficial del repositorio
(`https://github.com/JMBermejias/IASolges`), siempre por HTTPS y siempre validados como
paquete `.deb` antes de instalarse.

### Paleta mas suave

Los colores de la interfaz son ahora mas suaves y de bajo contraste: azules apagados,
bordes difusos y sombras tenues. Los cinco temas disponibles son azul, celeste, morado,
naranja y elegante.
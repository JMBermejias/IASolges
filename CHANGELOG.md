# Changelog

Todas las novedades relevantes de IASolges.

## [1.0.0] - 2026-10-14

### Añadido

**Interfaz**
- Barra lateral izquierda con los 15 módulos agrupados en *Plataforma*,
  *Flujo de Trabajo* y *Adicionales*.
- Dashboard de inicio con los mismos módulos en forma de tarjetas, 8 KPIs,
  actividad reciente y gráfico de crecimiento de registros.
- 5 temas de color (azul, verde, morado, naranja, elegante).
- Diseño responsive con menú lateral plegable en pantallas pequeñas.

**Núcleo de inteligencia artificial**
- Motor IA Local integrado: genera contenido estructurado real sin conexión
  ni claves API.
- Soporte para OpenAI, OpenRouter, DeepSeek, Anthropic, Ollama y cualquier
  endpoint compatible con OpenAI.
- Regreso automático al Motor IA Local si el proveedor remoto falla.
- Configuración de proveedor, modelo, clave, temperatura y tokens máximos.

**Módulos**
- *Mi Trabajo* y **Constructor IA**: generación automática de programas completos
  (especificación, arquitectura, código inicial, pruebas y presupuesto) en
  Python, JavaScript, TypeScript, PHP, Java, C# o sin código.
- *Clientes* y *Contactos* con vinculación, segmentación y análisis de encaje.
- *Campañas* con estrategia, copy publicable y calendario editorial.
- *Mapa Localizador de Clientes* con mapa de oportunidades por zona, sector y tipo
  de negocio, puntuación y análisis de mercado.
- *Generador de Prompts* con variables, optimizador y prueba de ejecución.
- *Chequeo de Seguridad* con 10 tipos de reglas y plan de remediación.
- *Precios* con margen, escenarios por volumen, precio recomendado y argumentario.
- *Prospectores* con puntuación de ajuste, pitch y secuencia multicanal de 21 días.
- *Nombres* con significado, dominio sugerido y puntuación.
- *Kit de Marca* con logo, paleta, tipografía, tono de voz y eslogan.
- *Analizador* con puntuación por dimensión y recomendaciones.
- *Presupuestos* con líneas, descuentos, IVA, narrativa por IA y exportación
  HTML/CSV.
- *Favoritos* unificados de todos los módulos.

**Empaquetado**
- Paquete `.deb` para Zorin OS / Ubuntu / Debian.
- Iconos de la aplicación en 8 tamaños más versión escalable SVG.
- Entrada de menú de aplicaciones y metadatos AppStream.
- Scripts `postinst`, `prerm` y `postrm` correctos.
- La instalación nunca borra los datos del usuario salvo con `apt purge`.

**Calidad**
- 127 pruebas de integración de API.
- 59 pruebas de vistas del frontend ejecutadas contra la API real.
- Migraciones de esquema no destructivas entre versiones.

### Seguridad
- Servidor enlazado solo a `127.0.0.1`.
- Lista blanca para las columnas `ORDER BY`.
- Consultas SQL parametrizadas en todas las rutas de búsqueda y filtrado.
- Protección contra path traversal en el servidor de ficheros estáticos.
- Validación de acceso a ficheros estáticos contra el directorio raíz.
- Cabecera `X-Content-Type-Options: nosniff`.
- Las claves API nunca se devuelven al cliente, solo un indicio de los 4 últimos
  caracteres.
- Directorio de datos del usuario con permisos `700`.

[1.0.0]: https://github.com/JMBermejias/IASolges/releases/tag/v1.0.0
## [1.1.0] - 2026-10-14

Cambia el verde decorativo por azul claro: acento #2EC4B6 -> #7DD3FC, tema 'verde' -> 'celeste' (#0C4A6E/#0284C7/#7DD3FC), icono y favicon. Anade scripts/release.sh para publicar una release completa con un solo comando.


## [1.2.0] - 2026-10-14

Colores mas suaves en toda la interfaz (azules apagados, bordes difusos, sombras tenues), boton Inicio en todas las pantallas, actualizaciones automaticas con boton manual que detecta nuevas versiones en GitHub y las instala con pkexec, boton de credenciales con los datos del autor, y licencia MIT con los datos completos. La version ahora se lee de un unico sitio, corrigiendo que el comprobador de actualizaciones comparaba contra una version obsoleta.


## [1.2.1] - 2026-10-14

Reduce el tamano de los iconos y las tarjetas del panel de inicio: iconos de 38px a 29px (glifo de 19px a 15px), altura minima de tarjeta de 132px a 96px, padding y tipografia mas ajustados, y rejilla de 228px a 186px para que quepan mas modulos por fila.


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


## [1.2.2] - 2026-10-14

Arregla los iconos enormes de los encabezados de panel (Actividad reciente, Trabajos recientes, Crecimiento de registros) y hace que la ventana arranque maximizada. La causa era que icon() genera los SVG sin width/height y no existia ninguna regla CSS que los limitara, por lo que el navegador los pintaba al tamano por defecto (300x150). Se anade la regla global svg{width:1em} como red de seguridad y una regla explicita para los encabezados de panel.


## [1.2.3] - 2026-10-14

Anade boton de limpieza en los tres paneles del inicio. Actividad reciente vacia el registro de acciones (log, no afecta a datos de negocio); Trabajos recientes elimina los registros de Mi Trabajo con confirmacion y aviso de que no se puede deshacer; Crecimiento de registros reinicia la ventana temporal del grafico sin borrar ningun dato, con opcion de restaurarlo a 6 meses. Cada limpieza pide confirmacion indicando cuantos registros hay.


## [1.2.4] - 2026-10-14

Anade boton Salir al pie de la barra lateral (y atajo Ctrl+Q). Confirma la salida, avisa de que los datos quedan guardados y cierra de verdad: detiene el servidor, cierra la ventana nativa y termina el proceso. La ventana nativa incorpora un vigilante que la cierra sola si el servidor deja de responder.


## [1.3.0] - 2026-10-14

Anade OpenCode como proveedor de IA con su catalogo de 8 modelos (Space Bunny Free, Cat Jam Free, LongCat 2.5 Preview Free, MiMo-V2.6-Flash Free, Step 5 Preview Free, Muse Spark 1.3 Free, Nemotron 3.5 Lightning Free y Big Pickle) y un endpoint /api/modelos que descarga el catalogo completo del proveedor para alimentar un selector de modelos. Envia User-Agent propio (el endpoint devuelve 403 con el de urllib por defecto) y traduce al castellano los errores conocidos del proveedor.


## [1.3.1] - 2026-10-14

Arregla la carga de modelos en Configuracion. El selector era un campo de texto con datalist, que WebKit no despliega en la ventana nativa: ahora es un select real que se rellena solo y se recarga al cambiar de proveedor. Anade listas de modelos sugeridos por proveedor (OpenAI, Anthropic, DeepSeek, Ollama, OpenCode y Motor IA Local) para que siempre haya opciones aunque el catalogo remoto falle por falta de clave, mas un campo para escribir el identificador a mano.


## [1.3.2] - 2026-10-14

Arregla el selector de modelos, que se quedaba vacio al navegar a Configuracion. Solo se rellenaba en el arranque de la aplicacion, nunca despues de navegar a la vista, asi que el desplegable llegaba sin opciones. Se inicializa ahora en afterRender, con cada entrada a la vista. Anade tests/test_dom.mjs: prueba de interfaz con DOM real que reproduce el flujo del usuario (arrancar en Inicio y pulsar en Configuracion) y comprueba que el selector trae modelos y que se recarga al cambiar de proveedor.


## [1.3.3] - 2026-10-15

Arregla los cuatro modulos indicados. Seguridad: el informe se borraba 50 ms despues de pintarse (la vista se re-renderizaba), ahora se queda; pasa de 10 a 23 reglas de deteccion; y el analisis con IA se lanza solo 1,5 s despues de dejar de escribir, con botones 'Analizar ahora' y 'Cargar ejemplo'. Mapa localizador: los marcadores y las filas no tenian manejador de clic, ahora son seleccionables, con panel de detalle, seleccion multiple y boton 'Analizar seleccion con IA' que dice que tienen y que les falta a los resultados. Generador de prompts: al describir la idea se genera solo el prompt en codigo. Kit de marca: boton 'Generar la marca con IA' dentro del formulario de nueva marca, que rellena los campos deducidos y muestra la previsualizacion.


## [1.3.4] - 2026-10-15

Arregla el Mapa Localizador: el analisis de mercado mostraba JSON crudo en vez del informe, y los puntos del mapa se deformaban en elipses gigantes porque el SVG usaba preserveAspectRatio none. El boton Analizar seleccion con IA ahora muestra el resultado en el propio panel de detalle, junto al boton, con contador de seleccionados y boton de copiar. Reescribe el renderizador de Markdown por lineas: las listas partidas en varias lineas reiniciaban la numeracion y los parrafos se mezclaban con las listas.


## [1.3.5] - 2026-10-15

Arregla el guardado del modelo y la ortografia. Al elegir un modelo del desplegable y guardar, se conservaba el anterior porque el campo de texto manual siempre sobreescribia la eleccion; ahora solo cuenta si se elige la opcion de escribirlo a mano. Anade indicadores visibles: el modelo en uso aparece al pie de la barra lateral y en Configuracion > Informacion, y el aviso de guardado dice que modelo se ha guardado. Corrige la ortografia de 'campana' por 'campaña' en toda la interfaz.


## [1.3.6] - 2026-10-15

Anade el selector de tipo de analisis en Chequeo de Seguridad, que antes no existia y solo se anunciaba en un texto pequeno. Ahora hay dos opciones: 'Automatico con IA' (por defecto, analiza solo 1,5 s despues de escribir) y 'Manual' (espera a que pulses Analizar ahora). El aviso bajo el desplegable indica el modo activo y lo que esta haciendo. El campo Titulo ya no viene con 'Chequeo manual' por defecto. Añade el boton Reanalizar. Corrige dos detalles de la v1.3.5: el icono de informacion salia relleno en negro y el lateral seguia mostrando el texto largo del motor en vez del nombre corto con el modelo debajo.


## [1.3.7] - 2026-10-15

Arregla el Mapa Localizador de Clientes. Al abrir una busqueda guardada el mapa se dibujaba pero no respondia: no se montaba Geo, asi que la seleccion estaba vacia, los marcadores no hacian nada y 'Analizar seleccion con IA' se quejaba de que no habia nada elegido. Ahora afterRender monta el mapa y la seleccion al reabrir una busqueda. Ademas, las busquedas guardadas por versiones antiguas tienen el analisis guardado como volcado JSON en vez de informe; ahora se detecta y se regenera solo, sin perder la busqueda. Corrige dos errores de la v1.3.6 que rompian la vista del mapa al ejecutar las pruebas.


## [1.3.8] - 2026-10-15

El Mapa Localizador pasa a datos REALES. Tres cosas: (1) Los nombres ya no son inventados. Antes generaba 'Asesoria S.L. 1', 'Asesoria S.L. 2' con telefonos y correos tambien falsos; ahora consulta OpenStreetMap y devuelve negocios y centros que existen de verdad, con su direccion y coordenadas exactas. Importante: OSM no publica telefono ni correo, asi que se muestran como 'Sin dato publico' en vez de inventarlos, y no se les pone puntuacion porque no hay datos para puntuarlos. Sin conexion, o si el sector no devuelve nada, se cae a los datos de muestra como antes. (2) El desplegable 'Tipo de negocio' estaba vacio: solo tenia 'Todos los tipos'. Ahora se rellena con las actividades del sector elegido y se actualiza al cambiarlo, y anade las detectadas de verdad en la zona. (3) El mapa ya tiene fondo de callejero real con los tiles de OpenStreetMap. Los tiles se piden a traves del servidor porque OSM devuelve 403 a quien no se identifica, y se cachean en disco. Se respeta su politica: 1 peticion por segundo, cache de 7 dias y User-Agent propio. La busqueda guardia ahora de que fuente salieron los datos, y las fichas de una busqueda guardada se reconstruyen con su centro y su fuente.


## [1.3.9] - 2026-10-15

Arregla la busqueda del Mapa Localizador, que seguia dando datos inventados. Tres causas: (1) Las palabras clave eran demasiado abstractas. OpenStreetMap esta etiquetado con lugares y oficios concretos, no con categorias de empresa: buscar 'constructora' en Novelda devuelve 0 aunque haya empresas de reformas, y buscar 'fontaneria' devuelve 4. Ahora cada sector busca oficios reales y, si no salen suficientes, se amplia a otros antes de rendirse. El sector construccion en Novelda pasa de 0 a 9 negocios reales. (2) Cuando no habia datos reales, la app caia a los de muestra en silencio, sin decir nada. Es el peor fallo posible en esta funcion: un negocio inventado con un telefono inventado acaba en una llamada a un desconocido. Ahora avisa con un cartel rojo sobre el mapa que dice que NO son reales, que no los llames, y por que motivo se han usado. (3) Se corrigio que el aviso apareciera despues de los resultados y que el motivo saliera con doble punto. Ademas se explica que la busqueda real tarda 10-15 segundos porque consulta una base mundial, y se guardan el aviso y la fuente en las busquedas.


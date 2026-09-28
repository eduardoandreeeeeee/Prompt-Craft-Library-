# Especificación universal del plugin de biblioteca de prompts

Versión 2. Reemplaza la versión anterior, que estaba ajustada a una sola persona. Base: análisis de los ocho PDF del diplomado (IAGO módulos 1 a 4 y las cuatro lecciones de Principios para la Ingeniería de Prompts).

El plugin no asume ninguna persona, sector ni estructura de carpetas. Implementa las reglas del método del curso (anatomía de cinco elementos, tres técnicas, ciclo de refinamiento y contenido mínimo de una entrada de biblioteca) y deja que cada persona ingrese su propia información: dominios de trabajo, sectores, herramientas, roles, criterios y estilo de redacción. La configuración personal de eduardoandreeeeeee pasa a ser un ejemplo de configuración (documento `configuracion-eduardoandreeeeeee.md`) y no parte del producto.

Claves de fuente usadas en este documento: **F** = Fundamentos de la ingeniería de prompts, **FS** = Few-shot learning, **CoT** = Chain of thought, **RI** = Refinamiento iterativo y biblioteca, **M1** a **M4** = módulos IAGO (IA generativa, Copilot, ChatGPT, n8n). Los números de página remiten al PDF.

---

## 1. Qué aporta el material al plugin

El curso entrega tres piezas que se traducen directamente en diseño de software. La primera es una anatomía del prompt de cinco elementos (rol, contexto, tarea, formato y restricciones), que permite tratar el prompt como un objeto estructurado y no como un bloque de texto. La segunda es un conjunto de tres técnicas (prompt estructurado, few-shot y chain of thought) más un ciclo de refinamiento de cuatro pasos (probar, evaluar, diagnosticar, ajustar) con una tabla de diagnóstico que relaciona síntoma, causa y ajuste. La tercera es una definición explícita de qué debe contener una entrada de biblioteca: el prompt completo (con sus ejemplos si usa few-shot), para qué tarea sirve y una nota de qué ajustar al reutilizarlo (RI p.7). Esa definición es el esquema mínimo obligatorio del plugin.

Los módulos IAGO aportan el contexto de uso: las herramientas de destino (chat, Copilot en Word, Excel y PowerPoint, GPT personalizado, nodo de IA en n8n), un banco de casos por sector chileno y los riesgos que la biblioteca debe ayudar a mitigar (alucinaciones, datos sensibles, sesgos, dependencia).

## 2. Arquitectura: tres capas y ejes de clasificación

### 2.1 Tres capas

| Capa | Qué contiene | Quién la modifica | Ejemplos |
|---|---|---|---|
| Núcleo del método | Reglas del curso, fijas | Solo las versiones del plugin | Los cinco elementos, las tres técnicas y el ciclo de refinamiento; el contenido mínimo de una entrada; la regla de no inventar datos en contextos sensibles; el catálogo de diagnóstico; los vocabularios cerrados |
| Configuración de la persona | Información que cada usuaria o usuario ingresa | La persona, en el asistente de primer uso y en ajustes | Carpeta raíz, dominios de trabajo, herramientas, sectores, verbos de tarea propios, roles, criterios de decisión, perfil de estilo de redacción |
| Paquete inicial (opcional) | Prompts, bloques y roles de ejemplo, genéricos y editables | La persona: importa, edita o elimina | Contenido de la sección 8 |

Regla de diseño: el código del plugin solo conoce el núcleo. Ningún nombre de carpeta, sector, herramienta, rol o preferencia de redacción vive en el código; todo eso pertenece a la segunda o a la tercera capa.

### 2.2 Ejes de clasificación

Una carpeta solo puede expresar un eje. El **dominio de trabajo** es el eje que la persona define y se refleja como carpeta y como campo de frontmatter (así una nota movida de carpeta conserva su dominio). Todos los demás ejes viven como campos, de modo que el plugin los use para filtrar, buscar y validar.

| Eje | Campo | Cardinalidad | Vocabulario | Origen |
|---|---|---|---|---|
| Dominio de trabajo | `dominio` (y carpeta) | 1 | abierto, definido por la persona | configuración |
| Tipo de nota | `tipo` | 1 | cerrado | propio del plugin |
| Técnica | `tecnica` | 1 o más | cerrado | F, FS, CoT, RI |
| Madurez | `estado` | 1 | cerrado | RI p.3 a p.9 |
| Sensibilidad de datos | `sensibilidad` | 1 | cerrado | F p.5, M1 p.20, M2 p.13, M3 p.10 |
| Tipo de tarea | `tarea` | 1 o más | abierto, con valores iniciales | F p.4, M2, M3 |
| Herramienta de destino | `herramienta` | 1 o más | abierto, con valores iniciales | M2, M3, M4 |
| Sector o contexto de ejemplo | `sector` | 0 o más | abierto, con valores iniciales | F, FS, CoT, RI, M3 |

Los vocabularios **cerrados** expresan reglas del método y no se editan, porque de ellos depende la validación. Los **abiertos** traen valores iniciales tomados del curso y la persona puede agregar, renombrar o eliminar.

## 3. Tipos de nota

| `tipo` | Qué es | Carpeta sugerida | Base en el curso |
|---|---|---|---|
| `prompt` | Entrada de biblioteca lista para usar | `<raíz>/Prompts/<dominio>` | RI p.7 |
| `meta-prompt` | Prompt que ayuda a construir, revisar o diagnosticar otros prompts | `<raíz>/Sistema/Meta-prompts` | F p.3, RI p.5 |
| `bloque` | Fragmento reutilizable de un elemento (rol, restricción, formato, criterios) | `<raíz>/Sistema/Bloques` | F p.3 a p.5 |
| `ejemplos` | Banco de ejemplos para few-shot, reutilizable por varios prompts | `<raíz>/Sistema/Ejemplos` | FS p.5, p.9 |
| `bitacora` | Registro de versión 0, iteraciones y respuesta final de un prompt | `<raíz>/Sistema/Bitácoras` | RI p.9 |
| `instrucciones` | Instrucciones fijas para un GPT personalizado o un proyecto de asistente | `<raíz>/Prompts/<dominio>` | M3 p.12 y p.13 |
| `diagnostico` | Tabla de referencia síntoma, causa y ajuste (una sola nota, consultada por el plugin) | `<raíz>/Sistema/Referencia` | RI p.5, F p.10 |

`<raíz>` es un ajuste (por defecto `Biblioteca de prompts`). El plugin crea las subcarpetas de `Sistema` al primer uso y las de `Prompts/<dominio>` a medida que la persona define sus dominios. Todos los nombres de carpeta son editables en ajustes.

## 4. Esquema de frontmatter

Campos obligatorios para `tipo: prompt` (los tres primeros salen literalmente de RI p.7):

```yaml
---
tipo: prompt
titulo: Rechazo a postulante
dominio: selección de personal      # definido por la persona; coincide con la carpeta
# --- mínimo del curso (RI p.7) ---
# 1. el prompt completo vive en el cuerpo de la nota, bajo "## Prompt"
tarea_que_resuelve: Redactar comunicaciones de rechazo con tono institucional consistente
nota_reutilizacion: Cambiar el cargo y la etapa alcanzada; reemplazar los dos ejemplos si cambia el tono de la organización
# --- clasificación ---
tecnica: [few-shot]                 # ver vocabulario 5.1
tarea: [redactar, adaptar-tono]     # ver 5.2
herramienta: [chat]                 # ver 5.3
sector: [rrhh]                      # ver 5.4, opcional
sensibilidad: datos-personales      # ver 5.5
estado: validado                    # ver 5.6
# --- anatomía (opcional, activa el modo constructor) ---
elementos:
  rol: Analista de selección
  contexto: Postulante que llegó hasta la segunda entrevista
  tarea: Redactar un correo de rechazo
  formato: Correo formal breve
  restricciones: Tono cálido y agradecido, sin sonar genérico
ejemplos_ref: "[[Ejemplos - Rechazo a postulante]]"   # solo si tecnica incluye few-shot
criterios: []                       # solo si tecnica incluye chain-of-thought
# --- ciclo de vida ---
version: 2
iteraciones: 2
origen: curso                       # curso | derivado | propio
fuente: "RI p.3-4"
revisar_en: 2027-03-28
---
```

Reglas de validación derivadas del curso: `tarea_que_resuelve`, `nota_reutilizacion` y el cuerpo con el prompt son obligatorios; si `tecnica` incluye `few-shot` debe haber entre 2 y 5 ejemplos (FS p.3); si incluye `chain-of-thought` debe haber al menos 3 criterios (CoT p.9); si `sensibilidad` es `contexto-sensible` debe estar presente la restricción de no inventar datos (F p.5). Los campos abiertos aceptan valores nuevos sin romper la validación; los cerrados no.

## 5. Vocabularios

Los de técnica, sensibilidad y estado son cerrados (reglas del método). Los de tarea, herramienta y sector son abiertos: los valores que siguen son iniciales y cada persona puede agregar, renombrar o eliminar. El dominio no tiene valores iniciales; lo define cada persona.

### 5.1 Técnica (`tecnica`)

| Valor | Cuándo | Fuente |
|---|---|---|
| `estructurado` | Cinco elementos, sin ejemplos (zero-shot). Tareas generales o poco ambiguas | F p.3 a p.5, FS p.3 |
| `few-shot` | El criterio o tono es difícil de describir pero fácil de reconocer con casos; también cuando zero-shot no fue consistente | FS p.3 y p.4 |
| `chain-of-thought` | Cálculos con varias variables, decisiones multicriterio, planificación con etapas, diagnóstico con varias causas | CoT p.3 |
| `few-shot+cot` | Ambas palancas combinadas (integración final del curso) | RI p.2 |
| `meta` | El prompt trabaja sobre otros prompts o sobre el método de trabajo con la IA | F p.11, RI p.5 |
| `iterativo` | Prompt en proceso de refinamiento con bitácora abierta | RI p.3 |

Regla de uso incluida en la nota de referencia: chain of thought no se usa en tareas simples y directas, porque solo alarga la respuesta (CoT p.3 y p.8).

### 5.2 Tipo de tarea (`tarea`)

Los verbos específicos son la forma de evitar el error de verbo vago (F p.4). Valores propuestos:

`redactar`, `resumir`, `reescribir`, `adaptar-tono`, `traducir-idioma`, `traducir-lenguaje-ciudadano`, `clasificar`, `priorizar`, `extraer-datos`, `comparar-decidir`, `analizar-datos`, `ordenar-estructurar`, `planificar`, `ideacion`, `explicar-ensenar`, `diagnosticar`, `generar-formula-codigo`, `generar-presentacion`, `responder-frecuentes`.

### 5.3 Herramienta de destino (`herramienta`)

| Valor | Observación | Fuente |
|---|---|---|
| `chat` | Cualquier IA conversacional (Claude, ChatGPT, Gemini, Copilot en modo chat) | F p.12 |
| `copilot-word` | El prompt asume un documento base abierto | M2 p.6 |
| `copilot-excel` | El prompt asume una tabla con columnas nombradas | M2 p.7 y p.8 |
| `copilot-powerpoint` | Parte de un documento o minuta existente | M2 p.9 |
| `gpt-personalizado` | Instrucciones fijas más archivos de referencia; también aplica a proyectos de asistente | M3 p.12 y p.13 |
| `n8n` | Prompt dentro de un nodo de IA con variables del flujo | M4 p.7 |

Los valores anteriores son iniciales; cada persona agrega las herramientas que use (otro asistente conversacional, uno interno de su organización u otro sistema).

### 5.4 Sector o contexto (`sector`)

Valores del curso: `mineria`, `retail`, `salud`, `banca-finanzas`, `rrhh`, `sector-publico`, `educacion`, `atencion-cliente`, `turismo`, `construccion`, `agricola`, `operaciones`. El curso los usa como ejemplos de aplicación y ninguno es obligatorio. El campo es opcional, editable y sirve para buscar por analogía cuando se adapta un prompt a otro rubro; cada persona define los propios.

### 5.5 Sensibilidad (`sensibilidad`)

Tres módulos IAGO advierten sobre datos sensibles (M1 p.20, M2 p.13, M3 p.10) y la lección de fundamentos define la restricción de no inventar información en contextos sensibles (F p.5).

| Valor | Significado | Comportamiento del plugin |
|---|---|---|
| `general` | Sin datos personales ni dominio delicado | ninguno |
| `datos-personales` | El prompt se completa con nombres, RUT, contratos u otros datos identificables | aviso antes de copiar: no pegar en herramientas públicas; sugerir reemplazar por marcadores |
| `contexto-sensible` | Salud, legal, financiero o situaciones de derechos de personas | además del aviso, exige o inserta el bloque `no-inventar` y sugiere revisión humana antes de usar la respuesta |

Extensión propuesta: en ajustes, la persona puede registrar términos o patrones propios (por ejemplo, formatos de identificador nacional) que el plugin detecta en las variables ya completadas para reforzar el aviso.

### 5.6 Madurez (`estado`)

| Valor | Criterio | Fuente |
|---|---|---|
| `borrador` | Versión 0, sin probar | RI p.9 |
| `en-iteracion` | Con bitácora abierta | RI p.3 |
| `validado` | Cumple el objetivo de la tarea; no requiere perfección en cada detalle | RI p.6 |
| `revisar` | Pasó la fecha `revisar_en` o cambió el contexto de trabajo | RI p.8 |
| `archivado` | Ya no se usa | propio |

Regla de detención (RI p.6): se deja de iterar cuando la respuesta cumple el objetivo o tras tres a cuatro iteraciones sin mejora significativa; en ese punto el problema suele ser información que el modelo no tiene, y hay que adjuntar un documento de referencia.

## 6. Catálogo de diagnóstico

Nota `tipo: diagnostico`. Es la base del comando "diagnosticar" del plugin: la persona elige el síntoma y recibe el ajuste; el plugin registra la iteración en la bitácora.

| Código | Síntoma | Causa probable | Elemento o técnica | Ajuste recomendado | Fuente |
|---|---|---|---|---|---|
| D01 | Respuesta demasiado genérica | Falta contexto o rol | contexto, rol | Agregar contexto específico: para quién, en qué sector, qué ocurrió antes | RI p.5 |
| D02 | Formato distinto al necesario | Falta indicación de formato | formato | Especificar formato exacto de salida (tabla, lista numerada, carta, JSON) | RI p.5 |
| D03 | Tono o criterio inconsistente entre respuestas | Falta few-shot | técnica | Agregar dos o tres ejemplos del patrón esperado | RI p.5 |
| D04 | La conclusión ignora factores o no explica por qué una opción quedó primero | Falta chain of thought | técnica | Pedir razonamiento paso a paso nombrando cada criterio | RI p.5 y p.6 |
| D05 | Respuesta demasiado larga o corta | Falta restricción de extensión | restricciones | Límite explícito de palabras, párrafos o extensión de página | RI p.5, F p.10 |
| D06 | El modelo inventa un dato que no se le dio | Falta restricción contra inventar | restricciones | «Si no tienes este dato, indícalo en vez de asumirlo» | RI p.5, F p.5 |
| D07 | Omite un elemento importante (por ejemplo un incidente) | El modelo prioriza brevedad sobre exhaustividad | restricciones | Restricción explícita: «nunca omitas X, aunque parezca menor» | RI p.6 |
| D08 | Tono inadecuado (alarmista, frío o genérico) | Falta restricción de tono | restricciones | Definir tono («neutral y factual, sin adjetivos alarmistas» o «cálido y agradecido») y, si persiste, few-shot | RI p.3 y p.6 |
| D09 | Resuelve mal o prioriza mal cuando se piden varias cosas | Varias tareas mezcladas en un prompt | tarea | Separar en prompts distintos o desglosar: «primero X, luego Y, finalmente Z» | F p.4 y p.10 |
| D10 | Ignora información dada antes | Se asumió memoria del modelo | contexto | Repetir el contexto necesario en cada prompt nuevo | F p.10 |
| D11 | Explica cuando se quería un resumen, u opina cuando se quería una lista | Verbo vago | tarea | Reemplazar por verbo específico: redacta, resume, compara, clasifica, analiza, traduce, prioriza | F p.4 y p.10 |
| D12 | El modelo no replica el patrón mostrado | Ejemplos ambiguos, contradictorios, idénticos o sin caso límite | técnica | Revisar los ejemplos: variedad, mismo formato y criterio, incluir un caso dudoso resuelto | FS p.5 y p.11 |
| D13 | Suena neutro o extranjero | No se indicó el contexto cultural local | contexto | Indicar que es para el contexto chileno y el público específico | M3 p.10 |
| D14 | Tres a cuatro iteraciones sin mejora | El modelo carece de información que solo la persona tiene | fuera del prompt | Adjuntar documento de referencia (norma, formato, ejemplo real) | RI p.6 |

## 7. Bloques reutilizables

Nota `tipo: bloque`, con campo `elemento` (rol, contexto, tarea, formato, restricciones, criterios). El plugin los inserta en el modo constructor. Todos los textos usan `{{variable}}` cuando requieren completarse. Los bloques 7.1 a 7.4 forman parte del paquete inicial; los bloques propios de cada persona se agregan de la misma forma.

### 7.1 Roles

Tomados de los ejemplos del curso, escritos de forma específica porque un rol acotado delimita mejor el marco de referencia (F p.3). Cada persona agrega sus propios roles como bloques.

| Bloque | Texto | Fuente |
|---|---|---|
| `rol-analista-financiero` | Actúa como analista financiero. | F p.6 |
| `rol-supervisor-turno` | Actúa como supervisor de turno en {{tipo de faena u operación}}. | F p.7 |
| `rol-enfermeria-educadora` | Actúa como enfermero/a que educa a una persona recién operada. | F p.3, p.8 |
| `rol-funcionario-oirs` | Actúa como funcionario/a de la Oficina de Informaciones (OIRS) de {{institución}}. | F p.9 |
| `rol-analista-seleccion` | Actúa como analista de selección. | RI p.4 |
| `rol-copywriter` | Actúa como copywriter profesional especializado en páginas web de venta de servicios, con enfoque en persuasión y conversión. | derivado |

### 7.2 Restricciones

| Bloque | Texto | Fuente |
|---|---|---|
| `no-inventar` | Si no cuentas con algún dato necesario, indícalo explícitamente en lugar de asumir un valor o inventarlo. | F p.5, RI p.5 |
| `no-recomendar` | No des recomendaciones de {{tratamiento, decisión o resolución}}; eso corresponde a {{responsable}}. | F p.5 |
| `no-omitir` | Nunca omitas {{tipo de elemento crítico}}, aunque parezca menor. | RI p.6 |
| `tono-neutral-factual` | Usa un tono neutral y factual, sin adjetivos alarmistas. | RI p.6 |
| `tono-calido-formal` | Usa un tono cálido y agradecido, formal e institucional, sin sonar genérico. | RI p.4, M3 p.5 |
| `sin-tecnicismos` | Usa lenguaje simple y cercano, sin tecnicismos, pensado para {{destinatario}}. | F p.3 y p.8 |
| `extension-palabras` | Extensión máxima: {{n}} palabras. | F p.6 |
| `extension-parrafos` | Máximo {{n}} párrafo(s). | F p.9 |
| `contexto-chileno` | Adapta el texto al contexto chileno y al público específico indicado; evita giros de otros países. | M3 p.10 |
| `senalar-no-asumir` | Si alguna indicación del texto original no queda clara, señálalo en lugar de completarla. | F p.8 |

### 7.3 Formatos

| Bloque | Texto | Fuente |
|---|---|---|
| `formato-tabla-comparativa` | Entrega una tabla con una fila por {{elemento}} y columnas fijas: {{columnas}}. | F p.4 |
| `formato-lista-numerada-gravedad` | Entrega una lista numerada ordenada por gravedad, con el formato: fecha, área, descripción breve. | F p.4 |
| `formato-carta-formal` | Redáctalo como carta formal, con encabezado, cuerpo y despedida institucional. | F p.4 |
| `formato-json-campos-fijos` | Entrega solo un objeto JSON con estos campos: {{campos}}, sin texto adicional. | F p.4 |
| `formato-secciones-fijas` | Organiza la respuesta en {{n}} secciones: {{sección 1}}, {{sección 2}} y {{sección 3}}. | F p.7 |
| `formato-n-hallazgos` | Resume los {{n}} hallazgos más relevantes en formato de lista, con lenguaje ejecutivo. | F p.6 |

### 7.4 Criterios (para chain of thought)

| Bloque | Criterios | Fuente |
|---|---|---|
| `criterios-proveedor` | precio, plazo de entrega, calidad reportada | CoT p.4 |
| `criterios-candidato` | experiencia previa en equipos similares, formación, pretensión de renta frente al presupuesto | CoT p.4 |
| `criterios-credito` | ingreso declarado, historial de pago, monto solicitado frente a la política interna de endeudamiento | CoT p.5 |
| `criterios-prioridad-solicitudes` | tiempo pendiente, situación de vulnerabilidad declarada, plazo legal próximo a vencer | CoT p.5 |

### 7.5 Perfil de estilo (configurable)

Los bloques de estilo no vienen incluidos: la persona los define una vez y el plugin los inserta como restricciones. El curso sustenta la idea en tres puntos: el contexto es el elemento que más falta en el día a día (F p.3), las restricciones evitan tener que «podar» o «suavizar» la respuesta después (F p.5) e ignorar el tono cultural o local es un error frecuente (M3 p.10).

| Campo del perfil | Qué ingresa la persona | Restricción que genera el plugin |
|---|---|---|
| `contexto-base` | Descripción breve de quién es y para quién redacta | Contexto: {{descripción}}. |
| `idioma-variante` | Idioma y variante regional | Redacta en {{idioma y variante}}; evita giros de otras variantes. |
| `tratamiento` | Forma de dirigirse a las personas | Dirígete a las personas con {{tratamiento}}. |
| `registro` | Nivel de formalidad y estructura | Usa un registro {{registro}}. |
| `terminos` | Pares «usar / evitar» | Usa «{{término preferido}}» en lugar de «{{término a evitar}}». |
| `cierre` | Firma o despedida habitual | Firma con: {{firma}}. |

El plugin genera una restricción por cada campo completado y permite activarla o desactivarla en cada prompt desde el constructor. Un ejemplo completo de perfil está en `configuracion-eduardoandreeeeeee.md`.

## 8. Paquete inicial (opcional)

Contenido de ejemplo, genérico y editable, que el asistente de primer uso ofrece importar (todo, una selección o nada). Cada semilla indica técnica, tarea, herramienta, sensibilidad y origen. Los prompts usan variables para que cada persona ingrese su propia información y ninguno contiene datos ni preferencias personales. Al importar, la persona elige bajo qué dominio quedan. Los prompts se dejan en tuteo neutro (algunos ejemplos de M2 estaban escritos con voseo). La nota de reutilización acompaña a cada prompt como exige el curso.

### 8.1 Meta-prompts (`<raíz>/Sistema/Meta-prompts`)

**MP-01 · Plantilla base de cinco elementos**
`tecnica: estructurado · tarea: [redactar] · herramienta: [chat] · sensibilidad: general · origen: curso (F p.3 a p.5, p.11)`

> Actúa como {{rol}}. Contexto: {{contexto: para quién es, en qué sector, qué ocurrió antes}}. Tarea: {{verbo específico + qué debe producir}}. Formato: {{tabla, lista numerada, carta, párrafo de máximo n palabras, JSON}}. Restricciones: {{extensión, tono, qué evitar, público}}. Si no cuentas con algún dato necesario, indícalo en lugar de asumir un valor.

Nota de reutilización: para tareas simples bastan dos o tres elementos; usar los cinco cuando la respuesta no sirva y haya que diagnosticar cuál falta.

**MP-02 · Plantilla few-shot**
`tecnica: few-shot · tarea: [redactar, clasificar, extraer-datos] · origen: curso (FS p.3, p.5, p.9, p.10)`

> Voy a mostrarte {{n: entre 2 y 5}} ejemplos de {{qué se hace: respuestas redactadas, casos clasificados o extracciones de datos}} ya resueltos, ordenados de lo más simple a lo más complejo. El último ejemplo es un caso límite. Aprende el criterio, el tono y el formato exactos que se repiten en ellos. Ejemplos: {{ejemplo 1}} / {{ejemplo 2}} / {{ejemplo 3}}. Ahora resuelve este caso nuevo aplicando exactamente el mismo criterio y formato: {{caso nuevo}}.

Nota de reutilización: revisar antes que los ejemplos no se contradigan y que incluyan al menos un caso dudoso resuelto. Verificar siempre las primeras respuestas nuevas; few-shot mejora la consistencia pero no la garantiza.

**MP-03 · Plantilla chain of thought**
`tecnica: chain-of-thought · tarea: [comparar-decidir] · origen: curso (CoT p.6)`

> Actúa como {{rol}}. Contexto: {{decisión a tomar y su contexto}}. Compara {{opción A}} y {{opción B}} considerando {{criterio 1}}, {{criterio 2}} y {{criterio 3}}. Razona paso a paso cada criterio por separado antes de concluir. Entrega la conclusión al final, como una recomendación condicionada que indique de qué depende. Si falta algún dato, señálalo en lugar de asumirlo.

Nota de reutilización: leer el razonamiento completo y no solo la conclusión; si un paso no tiene sentido, pedir que se revise ese paso específico. No usar en tareas simples.

**MP-04 · Auditoría de un prompt (revisión con «colega nuevo»)**
`tecnica: meta · herramienta: [chat] · origen: derivado de F p.3 y p.10`

> Revisa el siguiente prompt como si fueras un colega nuevo en mi puesto que no conoce el contexto. Indica cuáles de estos cinco elementos faltan o están ambiguos: rol, contexto, tarea, formato y restricciones. Señala además si incurre en alguno de estos errores: verbo vago, varias tareas mezcladas, ausencia de restricción de extensión o suposición de que recuerdas una conversación anterior. No reescribas todo el prompt: propón solo el ajuste mínimo para cada elemento faltante. Prompt a revisar: {{prompt}}

Nota de reutilización: usar antes de guardar un prompt en la biblioteca.

**MP-05 · Diagnóstico de un resultado insatisfactorio**
`tecnica: meta · origen: derivado de RI p.3 a p.6`

> Este es el prompt que envié: {{prompt}}. Esta es la respuesta que obtuve: {{respuesta}}. Lo que no me sirvió es: {{síntoma}}. Diagnostica cuál de los cinco elementos (rol, contexto, tarea, formato, restricciones) o cuál técnica (few-shot, chain of thought) explica el problema. Propón un único ajuste, indicando qué elemento cambia y por qué, para que yo pueda probarlo y comparar de forma controlada.

Nota de reutilización: cambiar un solo elemento por iteración; si tras tres o cuatro iteraciones no hay mejora, adjuntar un documento de referencia.

### 8.2 Comunicación, informes y decisión (prefijo AD)

**AD-01 · Correo formal de retraso con nueva fecha**
`estructurado · redactar · chat · datos-personales · curso (M3 p.5, caso 1)`

> Redacta un correo formal para {{destinatario y cargo}}. Explica que por razones {{motivo}} no podremos cumplir con {{compromiso}} para {{fecha original}}, y solicita una extensión de {{plazo}}. El tono debe ser respetuoso, proactivo y con compromiso. Incluye una nueva fecha de entrega, reafirma el compromiso con los estándares de calidad y agradece la comprensión. Extensión máxima: {{n}} palabras.

Nota: cambiar motivo, plazo y tono según la relación con el destinatario.

**AD-02 · Comunicar un cambio interno con empatía**
`estructurado · redactar · chat · general · curso (M3 p.5, caso 2)`

> Redacta un correo para {{equipo}} explicando de forma clara y empática que {{cambio}} por razones {{motivo}}. Usa un tono cercano, sin perder seriedad, evita tecnicismos y explica el motivo sin generar tensión interna. Extensión máxima: {{n}} palabras.

**AD-03 · Resumen para una audiencia no especializada**
`estructurado · resumir · chat · general · curso (M3 p.6, caso 3)`

> Resume este documento en un máximo de {{n}} puntos clave, redactados en lenguaje simple, para explicar el contenido a {{audiencia}}. Evita palabras técnicas. Documento: {{texto o adjunto}}

Nota: mientras más contexto se dé sobre quién leerá el resumen, más ajustado será el nivel de lenguaje.

**AD-04 · Síntesis ejecutiva de un informe**
`estructurado · resumir · chat · general · curso (F p.6 y M3 p.6, caso 4)`

> Actúa como analista. Este es el informe {{tipo y periodo}} de {{organización o área}} (adjunto). Resume los {{5}} hallazgos más relevantes para presentar a {{directorio, jefatura}}, en formato de lista, con lenguaje ejecutivo, máximo {{150}} palabras.

**AD-05 · Reescribir un mensaje con tono firme pero formativo**
`estructurado · reescribir, adaptar-tono · chat · datos-personales · curso (M3 p.7, caso 5)`

> Reescribe este mensaje en un tono firme pero formativo, para indicar que {{situación}}, pero que existe la opción de {{alternativa}}. El tono debe ser {{académico, institucional}}, sin ironía ni agresividad. Debe señalar el problema, ofrecer una solución concreta y mantener una postura ética sin escalar el conflicto. Mensaje: {{texto}}

**AD-06 · Respuesta a consultas frecuentes (versión few-shot)**
`few-shot · responder-frecuentes · chat · general · curso (M3 p.7 caso 6 y FS p.10)`

> Aquí tienes tres ejemplos de respuestas a consultas frecuentes de atención de público, ya redactadas con el tono y el nivel de detalle que quiero estandarizar: {{ejemplo 1}} / {{ejemplo 2}} / {{ejemplo 3}}. Redacta una respuesta con el mismo tono y estructura para esta consulta nueva: {{consulta}}. Dirígete a la persona con {{tratamiento}}.

Nota: guardar los tres ejemplos en una nota `tipo: ejemplos` y enlazarla. Revisar que los tres respondan con el mismo tono y nivel de detalle.

**AD-07 · Traducir a lenguaje ciudadano**
`estructurado · traducir-lenguaje-ciudadano · chat · general · curso (M3 p.8, caso 7)`

> Explica en lenguaje simple, para {{destinatarios}}, {{tema o cambio}}. Sé breve y cálido, y considera que {{condición del público: por ejemplo, personas mayores que pueden sentirse confundidas}}. Texto de origen: {{texto técnico o administrativo}}

**AD-08 · Respuesta formal a una solicitud ciudadana (OIRS)**
`estructurado · redactar · chat · datos-personales · curso (F p.9)`

> Actúa como funcionario/a de la OIRS de {{institución}}. Esta persona solicita información sobre el estado de {{trámite}} (correo adjunto). Redacta una respuesta formal indicando el estado actual del trámite y el próximo paso, en tono cordial pero institucional, de no más de un párrafo. Si el estado no aparece en los antecedentes, indícalo en lugar de asumirlo. Dirígete a la persona con {{tratamiento}}. Correo: {{texto}}

**AD-09 · Ordenar un reporte en secciones fijas sin omitir incidentes**
`estructurado · ordenar-estructurar · chat · general · curso (F p.7 y RI p.6)`

> Actúa como {{supervisor de turno o rol equivalente}}. Este es el reporte de {{turno o periodo}} (adjunto). Organízalo en tres secciones: {{producción o avance}}, {{incidentes o hechos relevantes, si los hay}} y {{pendientes para el siguiente turno}}. Usa lenguaje técnico del rubro, máximo media página. Nunca omitas un incidente, aunque parezca menor.

**AD-10 · Explicar indicaciones sin inventar**
`estructurado · explicar-ensenar · chat · contexto-sensible · curso (F p.8)`

> Actúa como {{profesional}}. {{Situación de la persona}} recibió estas indicaciones (adjuntas). Explícaselas en lenguaje simple, sin tecnicismos, en formato de lista de cuidados. Si alguna indicación no queda clara en el texto original, señálalo en vez de inventar un cuidado que no fue indicado.

Nota: aplicar `no-inventar` y revisión humana antes de entregar.

**AD-11 · Clasificar por prioridad con ejemplos**
`few-shot · clasificar, priorizar · chat · contexto-sensible · curso (FS p.8)`

> Clasifica {{tipo de solicitudes}} según su prioridad ({{urgente, preferente, regular}}) siguiendo estos ejemplos, ordenados de lo más simple a lo más delicado. Ejemplo 1: «{{caso}}» → {{categoría}} ({{razón breve}}). Ejemplo 2: «{{caso}}» → {{categoría}} ({{razón}}). Ejemplo 3: «{{caso}}» → {{categoría}} ({{razón}}). Nuevo caso: «{{caso nuevo}}» → ? Indica la categoría y la razón, comparando con el ejemplo más parecido.

Nota: incluir un caso límite entre los ejemplos; la clasificación la confirma siempre una persona.

**AD-12 · Extraer datos de texto libre a campos fijos**
`few-shot · extraer-datos · chat · datos-personales · curso (FS p.7)`

> Extrae los siguientes campos del texto: {{campo 1}}, {{campo 2}}, {{campo 3}}. Ejemplo de entrada: «{{texto de ejemplo}}». Ejemplo de salida: {{salida con los campos fijos}}. Aplica exactamente el mismo formato al siguiente texto y, si un campo no aparece, escribe «no informado» en vez de deducirlo. Texto: {{texto nuevo}}

**AD-13 · Decisión multicriterio con razonamiento visible**
`chain-of-thought · comparar-decidir · chat · general · curso (CoT p.4 a p.7)`

> Actúa como {{rol}}. Debo decidir entre {{opción A}} y {{opción B}} para {{propósito}}. Datos de A: {{datos}}. Datos de B: {{datos}}. Evalúa cada criterio por separado y paso a paso: {{criterio 1}}, {{criterio 2}} y {{criterio 3}}. Al final entrega una recomendación condicionada que indique de qué depende la elección y no una respuesta cerrada.

Nota: usar los bloques `criterios-*` según el caso.

**AD-14 · Priorizar solicitudes con criterio explícito**
`chain-of-thought · priorizar · chat · datos-personales · curso (CoT p.5)`

> Compara estas {{n}} solicitudes considerando el tiempo que llevan pendientes, si involucran una situación de vulnerabilidad declarada y si tienen un plazo legal próximo a vencer. Razona cada criterio antes de ordenarlas por prioridad de atención y deja el razonamiento escrito para poder justificar el orden. Solicitudes: {{lista}}

**AD-15 · Rechazo amable a postulante (versión final del ejemplo iterativo)**
`few-shot · redactar · chat · datos-personales · curso (RI p.3 y p.4)`

> Actúa como analista de selección. Redacta un correo de rechazo para un postulante al cargo de {{cargo}}, que llegó hasta {{etapa}}. Usa un tono cálido y agradecido, sin sonar genérico. Guíate por estos dos correos ya redactados con el tono exacto de la organización: {{ejemplo 1}} / {{ejemplo 2}}.

Nota: es el ejemplo completo de refinamiento del curso; conviene guardar su bitácora (versión 0, iteración 1 con rol, contexto y tono, iteración 2 con few-shot).

**AD-16 · Minuta convertida en informe ejecutivo**
`estructurado · redactar, resumir · copilot-word · general · curso (M2 p.4)`

> Convierte este texto en un informe profesional para {{destinatario}}, tono formal, máximo {{2 páginas}}.

**AD-17 · Análisis de datos, fórmula y gráfico**
`estructurado · analizar-datos, generar-formula-codigo · copilot-excel · datos-personales · curso (M2 p.7 y p.8)`

> Identifica los {{5}} {{elementos}} que más {{crecieron, bajaron}} en {{periodo}}. Crea una fórmula que calcule {{resultado esperado}} entre la columna {{B}} y la columna {{C}}. Haz un gráfico de {{tipo}} que compare {{variables}}. Encuentra errores o valores atípicos en esta planilla.

Nota: no requiere conocer el nombre de la función; basta describir el resultado. Trabajar con datos anonimizados.

**AD-18 · Presentación desde un documento, con notas del orador**
`estructurado · generar-presentacion · copilot-powerpoint · general · curso (M2 p.9)`

> Genera una presentación de {{7}} diapositivas para mostrar este informe a {{audiencia}}. Agrega una portada, agenda y cierre. Resume el contenido en una presentación clara y visual, con iconos y gráficos, y redacta notas para el orador con los datos clave.

Nota: el mejor punto de partida es un documento o minuta ya existente.

**AD-19 · Nodo de IA en n8n: respuesta automática a un formulario**
`estructurado · responder-frecuentes · n8n · datos-personales · curso (M4 p.7)`

> Redacta una respuesta amable al siguiente mensaje: «{{Mensaje}}». Firma con: Saludos cordiales, equipo de atención.

Nota: la variable `{{Mensaje}}` pertenece a n8n y no al plugin; en el prompt se escribe escapada como `\{{Mensaje}}`; el plugin la entrega como `{{Mensaje}}` al copiar (ver sección 10).

### 8.3 Marketing y contenidos (prefijo MK)

**MK-01 · Nombres para una campaña**
`estructurado · ideacion · chat · general · curso (M3 p.8, caso 8)`

> Sugiere {{10}} nombres creativos para una campaña de {{tema}} en {{tipo de organización y lugar}}. Deben ser cercanos, fáciles de recordar y en español de Chile.

**MK-02 · Ideas de publicaciones**
`estructurado · ideacion · chat · general · curso (M3 p.9, caso 9)`

> Dame {{5}} ideas de publicaciones en {{red social}} dirigidas a {{público}}, promoviendo {{tema}}. Tono {{profesional pero motivador}}. Entrega ideas, títulos, hashtags y estructura de cada publicación.

**MK-03 · Varias versiones de un mismo mensaje**
`estructurado · redactar, ideacion · chat · general · curso (M3 p.9, caso 10)`

> Redacta {{5}} versiones distintas de {{mensaje}} para {{ocasión}}. Debe motivar {{acción}} sin sonar agresivo ni repetir frases. Formato: versiones aptas para {{redes sociales, email, cartelera}}.

Nota: cuando no se está seguro del tono, pedir varias versiones a la vez es más rápido que iterar una sola idea.

### 8.4 Instrucciones para asistente (prefijo IN)

**IN-01 · Instrucciones de un GPT o proyecto personalizado**
`gpt-personalizado · origen: derivado de M3 p.12 y p.13`

> Tu función es {{tarea que debe cumplir}}. Debes responder con un tono {{tono}} y dirigirte a {{público}}. Usa como base los documentos de referencia adjuntos ({{manuales, reglamentos, protocolos}}). Si la información necesaria no está en ellos, indícalo en lugar de inventarla. Formato de respuesta: {{formato}}. Restricciones: {{extensión, temas que evitar}}.

Nota: un GPT o proyecto personalizado no reemplaza los prompts bien escritos; los reemplaza por instrucciones fijas más los archivos de referencia, para que cada persona obtenga el mismo estándar sin redactar el prompt cada vez.

## 9. Comportamientos del plugin

La columna «base» indica qué pasaje del material justifica cada comportamiento.

| # | Comportamiento | Base | Versión |
|---|---|---|---|
| 1 | Asistente de primer uso: carpeta raíz, dominios, herramientas, sectores, perfil de estilo e importación opcional del paquete inicial | sección 11 | MVP |
| 2 | Pestaña de ajustes para editar vocabularios abiertos, perfil de estilo y nombres de carpeta | sección 11 | MVP |
| 3 | Formulario de nueva entrada con los tres campos obligatorios (prompt, para qué tarea sirve, nota de reutilización) | RI p.7 | MVP |
| 4 | Selectores: vocabularios cerrados fijos y abiertos editables | secciones 2.2 y 5 | MVP |
| 5 | Búsqueda difusa con filtros por cualquier campo y por dominio | RI p.7 (organizar por sector o función) | MVP |
| 6 | Variables `{{nombre\|default\|hint}}` con formulario previo al copiado | referencia: plugin Promptbox | MVP |
| 7 | Modo constructor de cinco elementos, con las cinco preguntas como guía y opción de insertar bloques | F p.11 | MVP |
| 8 | Aviso de sensibilidad antes de copiar e inserción del bloque `no-inventar` | F p.5, M1 p.20, M2 p.13 | MVP |
| 9 | Inserción del perfil de estilo como restricciones, activable por prompt | F p.3 y p.5, M3 p.10 | MVP |
| 10 | Comando «diagnosticar»: elige el síntoma (D01 a D14), muestra el ajuste y abre la bitácora | RI p.5 | v2 |
| 11 | Bitácora automática: versión 0, iteraciones con qué cambió y por qué, un elemento modificado por iteración, y respuesta final | RI p.8 y p.9 | v2 |
| 12 | Validador few-shot: entre 2 y 5 ejemplos, sugiere orden progresivo y un caso límite | FS p.3, p.5, p.9 | v2 |
| 13 | Validador chain of thought: mínimo tres criterios, inserta la instrucción de razonar paso a paso y concluir al final; advierte si la tarea es simple | CoT p.3, p.6 | v2 |
| 14 | Linter de errores comunes: verbo vago, ausencia de formato, ausencia de extensión, varias tareas y referencia a memoria previa | F p.10 | v2 |
| 15 | Regla de detención: tras tres o cuatro iteraciones sin mejora, sugiere adjuntar un documento de referencia | RI p.6 | v2 |
| 16 | Campo `revisar_en` y vista de prompts por revisar | RI p.8 | v2 |
| 17 | Exportar e importar paquetes (prompts, bloques, roles) para compartir entre personas o equipos | RI p.7 (una biblioteca compartida multiplica el valor) | v2 |
| 18 | Rúbricas opcionales de autoevaluación (calidad de ejemplos, consistencia, utilidad para reutilizar; documentación, mejora, biblioteca) | FS p.11, RI p.10 | v3 |

## 10. Riesgos de diseño y decisiones abiertas

**Conflicto de delimitadores con n8n.** Los prompts de nodos de IA en n8n usan `{{ }}` para variables propias del flujo (M4 p.7), la misma sintaxis que usará el plugin. **Decisión:** escape `\{{Mensaje}}`, que el plugin no trata como variable y entrega como `{{Mensaje}}` al copiar. No se desactiva el reemplazo por herramienta.

**Datos volátiles fuera del modelo de datos.** Versiones de modelos, precios de licencias, créditos de uso y disponibilidad de planes (M2 p.10 a p.12, M3 p.3 y p.4) cambian con frecuencia. No se incluyen en el esquema ni en el paquete inicial.

**Ejemplos del curso como ilustración.** Las respuestas mostradas en los PDF (cifras del informe de ventas, reporte de turno, etc.) son ilustrativas; se usaron solo los prompts, adaptados y genéricos, no sus resultados.

**Derechos sobre el contenido.** El material del curso pertenece a la institución que lo dicta. Si el plugin se publica, el paquete inicial debe estar redactado con ejemplos propios y no reproducir textualmente los casos del curso. Las técnicas (cinco elementos, few-shot, chain of thought, refinamiento) son de uso general y están ampliamente difundidas, pero conviene no usar el nombre del curso ni de la universidad como marca sin autorización. Esto no es asesoría legal; corresponde confirmarlo con la institución antes de publicar. Mientras el repositorio sea privado y de uso personal, esto no bloquea el desarrollo.

**Decisiones tomadas (28 de septiembre de 2026):**

1. **Idioma.** Se prepara la traducción desde el inicio. Español como idioma base; el detalle técnico está en la sección 12, punto 6.
2. **Alcance y evolución.** La primera versión implementa el MVP de la sección 9 y las funciones v2 y v3 se agregan después como actualizaciones del mismo plugin. Los mecanismos que lo permiten están en la sección 13.
3. **Distribución.** Repositorio privado en GitHub para pruebas y, más adelante, posible publicación. Mientras sea privado y de uso personal, el riesgo de derechos sobre el contenido es bajo; debe revisarse antes de hacerlo público (ver párrafo de derechos y sección 13).
4. **Herramientas iniciales.** Se mantiene `n8n` (y el resto del vocabulario inicial) porque puede servir para crear automatizaciones. Por eso la regla de delimitadores de esta sección deja de ser opcional: el plugin debe manejar el conflicto de `{{ }}` desde el MVP.

## 11. Configuración por persona: asistente de primer uso

Todo lo que cada persona ingresa. Los ajustes se guardan en la configuración del plugin; los bloques, roles y prompts son notas Markdown dentro de la carpeta raíz.

| Paso | Qué ingresa | Dónde se guarda | Obligatorio |
|---|---|---|---|
| 1. Carpeta raíz | Nombre de la carpeta de la biblioteca (por defecto `Biblioteca de prompts`) | ajustes | sí |
| 2. Dominios de trabajo | Lista libre, mínimo uno. El campo muestra ejemplos como texto de ayuda, sin prellenar, para no sesgar (por ejemplo: atención de público, informes, redes sociales) | ajustes; crea las carpetas | sí |
| 3. Herramientas | Selección de la lista inicial y opción de agregar otras | ajustes | sí, al menos una |
| 4. Sectores | Lista opcional; puede partir de los valores iniciales | ajustes | no |
| 5. Perfil de estilo | Los seis campos de la sección 7.5 | ajustes | no |
| 6. Paquete inicial | Importar todo, elegir o ninguno, y bajo qué dominio | crea notas | no |

Cualquier paso se puede repetir o editar después desde ajustes. El asistente no exige completar el perfil de estilo ni importar el paquete: una biblioteca vacía con la estructura del método ya es utilizable.

## 12. Requisitos para que lo use cualquier persona

1. **Sin valores fijos.** Ninguna ruta absoluta, nombre de carpeta, sector o preferencia personal en el código.
2. **Todo local.** El plugin no envía el contenido de los prompts a ningún servicio ni pide claves de API. La única salida es copiar al portapapeles. Es coherente con la advertencia del curso sobre datos sensibles (M1 p.20).
3. **Formato abierto.** Notas Markdown con frontmatter, legibles sin el plugin; desinstalarlo no pierde información.
4. **Versión de esquema.** Un campo `esquema` en el frontmatter para migrar notas cuando cambie el modelo de datos.
5. **Escritorio y móvil.** Evitar APIs exclusivas de escritorio para que la biblioteca sea consultable desde el teléfono.
6. **Internacionalización desde el inicio.** Todo texto visible sale de archivos de idioma (`es` como base; `en` y otros se agregan después) y nunca de la lógica. Los valores de los vocabularios se guardan como identificadores estables (`few-shot`, `chain-of-thought`) y se muestran con la etiqueta del idioma activo, de modo que una nota escrita con el plugin en un idioma se lee bien en otro. El paquete inicial y el catálogo de diagnóstico también se organizan como archivos por idioma. El idioma se toma del de Obsidian y se puede cambiar en ajustes.

## 13. Evolución, actualizaciones y repositorio

El plugin está pensado para crecer sin romper lo que cada persona ya guardó. Los mecanismos son los siguientes.

| Mecanismo | Qué garantiza |
|---|---|
| Datos en notas Markdown con frontmatter abierto | Actualizar o desinstalar el plugin no modifica ni pierde las notas |
| Campo `esquema` en cada nota | Cuando un cambio del modelo de datos lo requiera, el plugin ofrece una migración explícita, con respaldo previo, en lugar de reescribir notas en silencio |
| Campos desconocidos preservados | Si una nota trae campos de una versión más nueva o propios de la persona, el plugin los conserva |
| Vocabularios abiertos | Agregar valores no requiere actualizar el plugin; los vocabularios cerrados solo cambian en versiones documentadas |
| Funciones v2 y v3 como módulos activables | Se incorporan por actualización y pueden activarse o no desde ajustes, sin alterar el uso diario |
| Paquete inicial versionado | Importar una versión nueva del paquete no sobrescribe las notas que la persona ya editó |
| Versionado semántico en `manifest.json` | Los cambios incompatibles solo llegan en versiones mayores |

**Flujo con GitHub privado.** Desarrollo en el repositorio; un release por versión con los tres archivos que Obsidian carga (`main.js`, `manifest.json` y `styles.css`). Para probar basta copiarlos a la carpeta del plugin dentro de `.obsidian/plugins/`; para recibir actualizaciones sin copiar a mano existe el plugin comunitario BRAT, cuyo soporte para repositorios privados conviene verificar en su documentación antes de depender de él. El repositorio debe incluir un `.gitignore` para las dependencias y el resultado de compilación, y no debe contener la bóveda ni notas personales.

**Antes de hacerlo público.** Quitar `configuracion-eduardoandreeeeeee.md` del repositorio (contiene preferencias personales), reemplazar el paquete inicial por ejemplos propios, elegir una licencia y revisar el punto de derechos de la sección 10.

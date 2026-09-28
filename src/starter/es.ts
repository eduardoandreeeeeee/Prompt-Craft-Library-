import type { StarterSpec } from "./types";

const es: StarterSpec = {
	domains: { redaccion: "Redacción", analisis: "Análisis", organizacion: "Organización" },

	blocks: [
		{
			id: "no-inventar",
			titulo: "No inventar datos",
			texto: "No inventes datos, cifras, nombres ni referencias. Si falta información para responder, indícalo y pídela en lugar de suponerla.",
		},
		{
			id: "pedir-aclaracion",
			titulo: "Pedir aclaración",
			texto: "Antes de responder, si falta información esencial, hazme hasta tres preguntas concretas y espera mi respuesta.",
		},
		{
			id: "tono-claro",
			titulo: "Tono claro",
			texto: "Escribe con frases cortas, en voz activa y sin jerga. Si usas un término técnico, explícalo la primera vez que aparezca.",
		},
		{
			id: "indicar-supuestos",
			titulo: "Indicar supuestos",
			texto: "Al final, lista los supuestos que hiciste para responder, de modo que pueda corregirlos si no son correctos.",
		},
	],

	banks: [
		{
			key: "clasificar",
			titulo: "Ejemplos de clasificación de consultas",
			tarea_que_resuelve: "Ejemplos de entrada y salida para clasificar consultas de personas en categorías fijas.",
			ejemplos: [
				{ input: "¿Cómo puedo cambiar la dirección registrada en mi cuenta?", output: "Categoría: Datos de cuenta" },
				{ input: "Llevo tres días esperando mi pedido y nadie me responde.", output: "Categoría: Reclamo por entrega" },
				{ input: "¿Atienden los sábados y hasta qué hora?", output: "Categoría: Información general" },
			],
		},
		{
			key: "extraer",
			titulo: "Ejemplos de extracción de datos de correos",
			tarea_que_resuelve: "Ejemplos de correos y de la ficha de datos que se espera obtener de cada uno.",
			ejemplos: [
				{
					input: "Hola, soy Marta Ruiz. Necesito que me envíen el contrato firmado antes del 15 de marzo, por favor.",
					output: "- Remitente: Marta Ruiz\n- Solicitud: enviar el contrato firmado\n- Fecha límite: 15 de marzo",
				},
				{
					input: "Buenos días. Les escribo de la empresa Norte para pedir una reunión la próxima semana.",
					output: "- Remitente: empresa Norte\n- Solicitud: agendar una reunión\n- Fecha límite: la próxima semana",
				},
			],
		},
	],

	prompts: [
		{
			titulo: "Redactar un correo formal",
			dominio: "redaccion",
			tarea: ["redactar"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Redactar un correo formal claro y breve a partir de un motivo y unos datos.",
			nota_reutilizacion: "Cambia el destinatario, el motivo y los datos. Ajusta el tono en las restricciones si el correo es más cercano.",
			bloques: ["tono-claro", "no-inventar"],
			prompt: `Rol: Eres una persona con experiencia en comunicación escrita formal.

Contexto: Debo escribir un correo a {{destinatario|una persona externa a mi organización|Quién lo recibirá y qué relación tienes con esa persona}}. El motivo es: {{motivo||Qué quieres lograr con el correo}}.

Tarea: Redacta el correo completo, con asunto, saludo, cuerpo y despedida. Incluye estos datos: {{datos|ninguno adicional|Fechas, cifras o nombres que deben aparecer}}.

Formato: Asunto en una línea y luego el cuerpo en no más de tres párrafos cortos.

Restricciones: Tono formal y cordial. No agregues información que no te di.`,
		},
		{
			titulo: "Reescribir un texto con otro tono",
			dominio: "redaccion",
			tarea: ["adaptar-tono"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Reescribir un texto existente con otro tono sin cambiar su contenido.",
			nota_reutilizacion: "Pega tu texto y elige el tono. Si el resultado cambia el sentido, agrega en las restricciones qué frases deben quedar iguales.",
			bloques: ["tono-claro"],
			prompt: `Rol: Eres un editor de textos.

Contexto: Tengo un texto que quiero adaptar para {{publico|el público general|A quién va dirigido}}.

Tarea: Reescribe el texto con un tono {{tono|cercano y profesional|Por ejemplo: formal, cercano, técnico}} sin cambiar su contenido.

Formato: Entrega solo el texto reescrito, en el mismo orden de ideas que el original.

Restricciones: Conserva todas las cifras, nombres y fechas tal como están.

Texto:
{{texto}}`,
		},
		{
			titulo: "Resumir un documento largo",
			dominio: "redaccion",
			tarea: ["resumir"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Resumir un documento largo en una versión corta para quien no lo leyó.",
			nota_reutilizacion: "Cambia la extensión y para quién es el resumen. Si el documento es muy largo, pégalo por partes.",
			bloques: ["no-inventar"],
			prompt: `Rol: Eres un analista que prepara resúmenes para personas con poco tiempo.

Contexto: El resumen es para {{lector|una persona que no conoce el tema|Quién lo va a leer}}.

Tarea: Resume el documento que aparece al final destacando las ideas principales y las decisiones o acciones pendientes.

Formato: Un párrafo de no más de {{extension|120|Cantidad máxima de palabras}} palabras y después una lista con las acciones pendientes.

Restricciones: Usa solo información del documento.

Documento:
{{documento}}`,
		},
		{
			titulo: "Clasificar consultas en categorías",
			dominio: "analisis",
			tarea: ["clasificar"],
			tecnica: ["few-shot"],
			sensibilidad: "general",
			tarea_que_resuelve: "Asignar cada consulta recibida a una categoría de una lista fija.",
			nota_reutilizacion: "Cambia las categorías del prompt y actualiza los ejemplos del banco enlazado para que usen tus mismas categorías.",
			bloques: [],
			ejemplos: "clasificar",
			prompt: `Rol: Eres una persona que ordena las consultas que llegan a una organización.

Contexto: Cada consulta debe quedar en una sola categoría.

Tarea: Clasifica la consulta que aparece al final.

Formato: Responde solo con «Categoría: » y el nombre de la categoría.

Restricciones: Usa únicamente estas categorías: {{categorias|Datos de cuenta, Reclamo por entrega, Información general|Lista separada por comas}}. Si ninguna corresponde, responde «Categoría: Otra».

Consulta:
{{consulta}}`,
		},
		{
			titulo: "Extraer datos de un correo",
			dominio: "analisis",
			tarea: ["extraer-datos"],
			tecnica: ["few-shot"],
			sensibilidad: "general",
			tarea_que_resuelve: "Obtener una ficha de datos (remitente, solicitud, fecha límite) a partir de un correo.",
			nota_reutilizacion: "Cambia los campos de la ficha y ajusta los ejemplos del banco enlazado para que muestren los mismos campos.",
			bloques: ["no-inventar"],
			ejemplos: "extraer",
			prompt: `Rol: Eres un asistente que ordena la información de los correos.

Contexto: Necesito una ficha breve de cada correo para registrarla.

Tarea: Extrae los datos del correo que aparece al final.

Formato: Una lista con los campos «Remitente», «Solicitud» y «Fecha límite», uno por línea.

Restricciones: Si un dato no aparece en el correo, escribe «no indicado».

Correo:
{{correo}}`,
		},
		{
			titulo: "Comparar dos opciones y recomendar",
			dominio: "analisis",
			tarea: ["comparar-decidir"],
			tecnica: ["chain-of-thought"],
			sensibilidad: "general",
			tarea_que_resuelve: "Comparar dos opciones con criterios explícitos y recomendar una, mostrando el razonamiento.",
			nota_reutilizacion: "Cambia las opciones y los criterios de decisión. Si tus criterios tienen distinto peso, indícalo en el contexto.",
			bloques: ["indicar-supuestos"],
			criterios: [
				"Listar los hechos conocidos de cada opción",
				"Evaluar cada opción según los criterios de decisión entregados",
				"Justificar la recomendación y señalar el principal riesgo",
			],
			prompt: `Rol: Eres un asesor que ayuda a decidir con criterio.

Contexto: Debo elegir entre {{opcionA}} y {{opcionB}}. Los criterios de decisión son: {{criterios|costo, riesgo y tiempo|Lo que más importa para decidir}}.

Tarea: Razona paso a paso: primero lista los hechos de cada opción, luego evalúa cada una según los criterios y al final recomienda una.

Formato: Tres secciones con los títulos «Hechos», «Evaluación» y «Recomendación».

Restricciones: No inventes datos; si falta información para evaluar un criterio, dilo.`,
		},
		{
			titulo: "Ordenar los hechos de un caso",
			dominio: "analisis",
			tarea: ["ordenar-estructurar"],
			tecnica: ["estructurado"],
			sensibilidad: "contexto-sensible",
			tarea_que_resuelve: "Ordenar cronológicamente los hechos de un caso y proponer preguntas para completarlo.",
			nota_reutilizacion: "Usa siempre datos anonimizados o ficticios. Revisa el resultado con tu criterio profesional antes de usarlo.",
			bloques: ["no-inventar", "indicar-supuestos"],
			prompt: `Rol: Eres un asistente que ayuda a ordenar información de casos.

Contexto: Tengo notas desordenadas sobre un caso. Los datos están anonimizados: no contienen nombres ni documentos de identidad.

Tarea: Ordena los hechos cronológicamente y luego propone las preguntas que faltan para entender mejor el caso.

Formato: Una línea de tiempo con fecha y hecho, y después una lista de preguntas pendientes.

Restricciones: No saques conclusiones ni hagas diagnósticos; solo ordena y pregunta.

Notas:
{{notas}}`,
		},
		{
			titulo: "Planificar un proyecto en etapas",
			dominio: "organizacion",
			tarea: ["planificar"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Dividir un objetivo en etapas con responsables, plazos y riesgos.",
			nota_reutilizacion: "Cambia el objetivo, el plazo y los recursos. Si ya tienes etapas definidas, pégalas en el contexto.",
			bloques: ["pedir-aclaracion", "indicar-supuestos"],
			prompt: `Rol: Eres una persona con experiencia en gestión de proyectos.

Contexto: Mi objetivo es {{objetivo}}. Tengo {{plazo|un mes|Tiempo disponible}} y cuento con {{recursos|los recursos habituales|Personas, herramientas y presupuesto}}.

Tarea: Propón un plan en etapas para lograr el objetivo.

Formato: Una tabla con las columnas «Etapa», «Qué se hace», «Plazo» y «Riesgo principal».

Restricciones: Máximo seis etapas. Prioriza lo esencial.`,
		},
		{
			titulo: "Preparar la agenda de una reunión",
			dominio: "organizacion",
			tarea: ["planificar"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Preparar una agenda con tiempos y objetivos para una reunión.",
			nota_reutilizacion: "Cambia el tema, la duración y quiénes asisten. Agrega los puntos que ya sabes que deben tratarse.",
			bloques: ["tono-claro"],
			prompt: `Rol: Eres una persona que facilita reuniones de trabajo.

Contexto: Tengo una reunión sobre {{tema}} de {{duracion|60 minutos}} con {{asistentes|mi equipo|Quiénes participan}}.

Tarea: Prepara la agenda de la reunión.

Formato: Lista numerada con el punto, el tiempo asignado y el resultado esperado de cada uno. Al final, una línea con las decisiones que deben quedar tomadas.

Restricciones: Los tiempos deben sumar la duración total.`,
		},
		{
			titulo: "Priorizar una lista de tareas",
			dominio: "organizacion",
			tarea: ["priorizar"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Ordenar una lista de tareas según urgencia e importancia.",
			nota_reutilizacion: "Pega tus tareas y cambia el criterio de prioridad si el tuyo es distinto (por ejemplo, según impacto).",
			bloques: ["pedir-aclaracion"],
			prompt: `Rol: Eres una persona que ayuda a organizar el trabajo.

Contexto: Tengo estas tareas pendientes y tiempo limitado. El criterio de prioridad es: {{criterio|urgencia e importancia|Cómo decides qué va primero}}.

Tarea: Ordena las tareas de la más a la menos prioritaria.

Formato: Lista numerada. Junto a cada tarea, una frase con el motivo de su lugar.

Restricciones: No agregues tareas nuevas.

Tareas:
{{tareas}}`,
		},
	],

	metas: [
		{
			titulo: "Mejorar un prompt",
			tarea: ["diagnosticar"],
			tecnica: ["meta"],
			sensibilidad: "general",
			tarea_que_resuelve: "Pedir a una IA que revise un prompt y proponga una versión mejorada.",
			nota_reutilizacion: "Pega tu prompt en la variable y copia el resultado. Cambia un solo elemento por iteración y revisa el resultado antes de aceptarlo.",
			bloques: [],
			prompt: `Rol: Eres un experto en diseñar instrucciones para asistentes de IA.

Contexto: A continuación hay un prompt que uso y no me da los resultados que espero.

Tarea: Revisa el prompt según los cinco elementos (rol, contexto, tarea, formato y restricciones). Indica cuál falta o está débil y propón una versión mejorada.

Formato: Primero un diagnóstico en una lista breve, luego el prompt mejorado en un bloque de texto.

Restricciones: Mantén la intención original. Cambia solo lo necesario y explica cada cambio en una frase.

Prompt a mejorar:
{{prompt}}`,
		},
		{
			titulo: "Convertir una idea en un prompt de cinco elementos",
			tarea: ["ordenar-estructurar"],
			tecnica: ["meta"],
			sensibilidad: "general",
			tarea_que_resuelve: "Transformar una idea suelta en un prompt con rol, contexto, tarea, formato y restricciones.",
			nota_reutilizacion: "Describe la idea con tus palabras. Si la IA hace preguntas, respóndelas antes de usar el prompt resultante.",
			bloques: ["pedir-aclaracion"],
			prompt: `Rol: Eres un experto en redactar prompts claros.

Contexto: Tengo una idea de lo que quiero pedirle a una IA, pero no sé cómo escribirla.

Tarea: Convierte mi idea en un prompt con los cinco elementos: rol, contexto, tarea, formato y restricciones.

Formato: El prompt final, con cada elemento en un párrafo que empiece con su nombre.

Restricciones: Marca con \\{{nombre}} (llaves dobles) los datos que yo deba completar cada vez que lo use.

Mi idea:
{{idea}}`,
		},
		{
			titulo: "Crear ejemplos para un prompt few-shot",
			tarea: ["ideacion"],
			tecnica: ["meta"],
			sensibilidad: "general",
			tarea_que_resuelve: "Generar borradores de ejemplos de entrada y salida para usar en un prompt few-shot.",
			nota_reutilizacion: "Revisa y corrige cada ejemplo antes de guardarlo: los ejemplos definen lo que la IA imitará. Usa entre dos y cinco.",
			bloques: ["no-inventar"],
			prompt: `Rol: Eres un experto en preparar ejemplos para enseñar a una IA una tarea.

Contexto: Quiero un prompt que haga lo siguiente: {{tarea}}.

Tarea: Escribe {{cantidad|3|Entre 2 y 5}} ejemplos variados de entrada y de la salida ideal.

Formato: Para cada uno, «Ejemplo N», luego «Entrada:» y «Salida:».

Restricciones: Los ejemplos deben ser realistas, distintos entre sí y con la misma forma de salida. Usa datos ficticios.`,
		},
	],
};

export default es;

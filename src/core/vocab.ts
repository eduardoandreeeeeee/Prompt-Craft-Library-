/**
 * Vocabularios del plugin.
 *
 * Cerrados: expresan reglas del método y no se editan; de ellos depende la validación.
 * Abiertos: traen valores iniciales y cada persona puede agregar, renombrar o eliminar.
 *
 * Los valores son identificadores estables (sin acentos ni espacios). Lo que ve la
 * persona es una etiqueta traducida desde i18n, nunca el identificador.
 */

export const TECNICAS = [
	"estructurado",
	"few-shot",
	"chain-of-thought",
	"few-shot+cot",
	"meta",
	"iterativo",
] as const;

export const ESTADOS = [
	"borrador",
	"en-iteracion",
	"validado",
	"revisar",
	"archivado",
] as const;

export const SENSIBILIDADES = [
	"general",
	"datos-personales",
	"contexto-sensible",
] as const;

export const TIPOS_NOTA = [
	"prompt",
	"meta-prompt",
	"bloque",
	"ejemplos",
	"bitacora",
	"instrucciones",
	"diagnostico",
] as const;

/** Los cinco elementos de la anatomía de un prompt. */
export const ELEMENTOS = [
	"rol",
	"contexto",
	"tarea",
	"formato",
	"restricciones",
] as const;

export type Tecnica = (typeof TECNICAS)[number];
export type Estado = (typeof ESTADOS)[number];
export type Sensibilidad = (typeof SENSIBILIDADES)[number];
export type TipoNota = (typeof TIPOS_NOTA)[number];
export type Elemento = (typeof ELEMENTOS)[number];

export const CLOSED_VOCAB = {
	tecnica: TECNICAS,
	estado: ESTADOS,
	sensibilidad: SENSIBILIDADES,
	tipo: TIPOS_NOTA,
} as const;

export type ClosedField = keyof typeof CLOSED_VOCAB;

export function isClosedValue(field: ClosedField, value: unknown): boolean {
	return (CLOSED_VOCAB[field] as readonly string[]).includes(String(value));
}

/** Valores iniciales de los vocabularios abiertos. */
export const TAREAS_INICIALES = [
	"redactar",
	"resumir",
	"reescribir",
	"adaptar-tono",
	"traducir-idioma",
	"traducir-lenguaje-ciudadano",
	"clasificar",
	"priorizar",
	"extraer-datos",
	"comparar-decidir",
	"analizar-datos",
	"ordenar-estructurar",
	"planificar",
	"ideacion",
	"explicar-ensenar",
	"diagnosticar",
	"generar-formula-codigo",
	"generar-presentacion",
	"responder-frecuentes",
] as const;

export const HERRAMIENTAS_INICIALES = [
	"chat",
	"copilot-word",
	"copilot-excel",
	"copilot-powerpoint",
	"gpt-personalizado",
	"n8n",
] as const;

/**
 * Ejemplos de sector que se muestran como sugerencia. No forman parte del vocabulario inicial:
 * cada persona ingresa los sectores en que trabaja.
 */
export const SECTORES_EJEMPLO = [
	"mineria",
	"retail",
	"salud",
	"banca-finanzas",
	"rrhh",
	"sector-publico",
	"educacion",
	"atencion-cliente",
	"turismo",
	"construccion",
	"agricola",
	"operaciones",
] as const;

export type OpenField = "tarea" | "herramienta" | "sector";

export const OPEN_VOCAB_INITIAL: Record<OpenField, readonly string[]> = {
	tarea: TAREAS_INICIALES,
	herramienta: HERRAMIENTAS_INICIALES,
	sector: [],
};

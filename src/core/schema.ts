/**
 * Esquema de las notas y validación de una entrada de biblioteca.
 *
 * Contenido mínimo de una entrada según el método: el prompt completo (con sus ejemplos
 * si usa few-shot), para qué tarea sirve y una nota de qué ajustar al reutilizarlo.
 */

import {
	ClosedField,
	Elemento,
	Estado,
	Sensibilidad,
	Tecnica,
	TipoNota,
	isClosedValue,
} from "./vocab";

/** Versión del esquema de frontmatter. Se incrementa cuando cambia el modelo de datos. */
export const ESQUEMA_ACTUAL = 1;

/** Identificador del bloque que evita que el modelo invente datos. */
export const BLOQUE_NO_INVENTAR = "no-inventar";

export const FEW_SHOT_MIN = 2;
export const FEW_SHOT_MAX = 5;
export const COT_MIN_CRITERIOS = 3;

export interface PromptFrontmatter {
	esquema: number;
	tipo: TipoNota;
	titulo?: string;
	dominio?: string;
	tarea_que_resuelve?: string;
	nota_reutilizacion?: string;
	tecnica?: Tecnica[];
	tarea?: string[];
	herramienta?: string[];
	sector?: string[];
	sensibilidad?: Sensibilidad;
	estado?: Estado;
	elementos?: Partial<Record<Elemento, string>>;
	ejemplos_ref?: string;
	criterios?: string[];
	/** Identificadores de los bloques reutilizables que usa el prompt. */
	bloques?: string[];
	version?: number;
	iteraciones?: number;
	iteraciones_sin_mejora?: number;
	origen?: "curso" | "derivado" | "propio" | "paquete-inicial" | "importado";
	fuente?: string;
	revisar_en?: string;
}

export type IssueCode =
	| "unknown-type"
	| "missing-required"
	| "invalid-closed-value"
	| "few-shot-examples-range"
	| "cot-min-criteria"
	| "sensitive-requires-no-invent";

export interface ValidationIssue {
	code: IssueCode;
	field: string;
}

export interface ValidateOptions {
	/** Cantidad de ejemplos de la nota enlazada; lo resuelve quien llama, no este módulo. */
	ejemplosCount?: number;
}

export function toList(value: unknown): string[] {
	if (typeof value === "string") return value.trim() ? [value.trim()] : [];
	if (Array.isArray(value)) {
		return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
	}
	return [];
}

/** Texto bajo el encabezado "## Prompt", hasta el siguiente encabezado de nivel 2. */
export function extractPromptSection(body: string): string {
	const lines = body.split(/\r?\n/);
	const start = lines.findIndex((l) => /^##\s+prompt\s*$/i.test(l));
	if (start === -1) return "";
	const collected: string[] = [];
	for (let i = start + 1; i < lines.length; i++) {
		if (/^##\s/.test(lines[i])) break;
		collected.push(lines[i]);
	}
	return collected.join("\n").trim();
}

function hasText(value: unknown): boolean {
	return typeof value === "string" && value.trim() !== "";
}

export function validatePrompt(
	fm: Record<string, unknown>,
	body: string,
	opts: ValidateOptions = {},
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (!isClosedValue("tipo", fm.tipo)) {
		return [{ code: "unknown-type", field: "tipo" }];
	}
	// Los meta-prompts cumplen el mismo mínimo que los prompts; los demás tipos no se validan aquí.
	if (fm.tipo !== "prompt" && fm.tipo !== "meta-prompt") return issues;

	if (!hasText(fm.tarea_que_resuelve)) {
		issues.push({ code: "missing-required", field: "tarea_que_resuelve" });
	}
	if (!hasText(fm.nota_reutilizacion)) {
		issues.push({ code: "missing-required", field: "nota_reutilizacion" });
	}
	if (extractPromptSection(body) === "") {
		issues.push({ code: "missing-required", field: "prompt" });
	}

	const tecnicas = toList(fm.tecnica);
	for (const value of tecnicas) {
		if (!isClosedValue("tecnica", value)) {
			issues.push({ code: "invalid-closed-value", field: "tecnica" });
			break;
		}
	}
	const singles: [ClosedField, unknown][] = [
		["estado", fm.estado],
		["sensibilidad", fm.sensibilidad],
	];
	for (const [field, value] of singles) {
		if (value !== undefined && !isClosedValue(field, value)) {
			issues.push({ code: "invalid-closed-value", field });
		}
	}

	const usesFewShot = tecnicas.includes("few-shot") || tecnicas.includes("few-shot+cot");
	if (usesFewShot && opts.ejemplosCount !== undefined) {
		if (opts.ejemplosCount < FEW_SHOT_MIN || opts.ejemplosCount > FEW_SHOT_MAX) {
			issues.push({ code: "few-shot-examples-range", field: "ejemplos_ref" });
		}
	}

	const usesCot = tecnicas.includes("chain-of-thought") || tecnicas.includes("few-shot+cot");
	if (usesCot && toList(fm.criterios).length < COT_MIN_CRITERIOS) {
		issues.push({ code: "cot-min-criteria", field: "criterios" });
	}

	if (fm.sensibilidad === "contexto-sensible" && !toList(fm.bloques).includes(BLOQUE_NO_INVENTAR)) {
		issues.push({ code: "sensitive-requires-no-invent", field: "bloques" });
	}

	return issues;
}

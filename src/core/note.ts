/**
 * Borrador de una nota de prompt: lo que completa la persona en el formulario y su
 * conversión a frontmatter y cuerpo de nota. No depende de Obsidian.
 */

import { sanitizeFolderName } from "./paths";
import { BLOQUE_NO_INVENTAR, ESQUEMA_ACTUAL, ValidationIssue, validatePrompt } from "./schema";
import { labelFor } from "../i18n";
import { ELEMENTOS, Elemento, Estado, Sensibilidad, Tecnica } from "./vocab";

/** Tipos de nota que se crean con el formulario de prompts. */
export type DraftTipo = "prompt" | "meta-prompt";

/** Texto de cada uno de los cinco elementos, cuando se arma el prompt paso a paso. */
export type ElementTexts = Record<Elemento, string>;

export function emptyElements(): ElementTexts {
	return { rol: "", contexto: "", tarea: "", formato: "", restricciones: "" };
}

/** Elementos que faltan (vacíos), en el orden del método. */
export function missingElements(el: ElementTexts): Elemento[] {
	return ELEMENTOS.filter((k) => el[k].trim() === "");
}

/** Prompt armado a partir de los cinco elementos; omite los vacíos. */
export function composeElements(el: ElementTexts): string {
	return ELEMENTOS.filter((k) => el[k].trim() !== "")
		.map((k) => `${labelFor("elemento", k)}: ${el[k].trim()}`)
		.join("\n\n");
}

export interface PromptDraft {
	tipo: DraftTipo;
	titulo: string;
	/** Nombre de la carpeta de dominio; vacío = directamente en la carpeta de prompts. */
	dominio: string;
	tarea_que_resuelve: string;
	nota_reutilizacion: string;
	tecnica: Tecnica[];
	sensibilidad: Sensibilidad;
	estado: Estado;
	tarea: string[];
	herramienta: string[];
	sector: string[];
	criterios: string[];
	ejemplos_ref: string;
	bloques: string[];
	prompt: string;
}

export function emptyDraft(): PromptDraft {
	return {
		tipo: "prompt",
		titulo: "",
		dominio: "",
		tarea_que_resuelve: "",
		nota_reutilizacion: "",
		tecnica: ["estructurado"],
		sensibilidad: "general",
		estado: "borrador",
		tarea: [],
		herramienta: [],
		sector: [],
		criterios: [],
		ejemplos_ref: "",
		bloques: [],
		prompt: "",
	};
}

/** Campos del frontmatter en orden de aparición; los vacíos se omiten. */
export function draftToFrontmatter(d: PromptDraft): Record<string, unknown> {
	const fm: Record<string, unknown> = {
		esquema: ESQUEMA_ACTUAL,
		tipo: d.tipo,
	};
	const put = (key: string, value: unknown) => {
		if (typeof value === "string" ? value.trim() !== "" : Array.isArray(value) ? value.length > 0 : true) {
			fm[key] = typeof value === "string" ? value.trim() : value;
		}
	};
	put("titulo", d.titulo);
	put("dominio", d.dominio);
	put("tarea_que_resuelve", d.tarea_que_resuelve);
	put("nota_reutilizacion", d.nota_reutilizacion);
	put("tecnica", d.tecnica);
	put("tarea", d.tarea);
	put("herramienta", d.herramienta);
	put("sector", d.sector);
	put("sensibilidad", d.sensibilidad);
	put("estado", d.estado);
	put("criterios", d.criterios);
	put("ejemplos_ref", d.ejemplos_ref);
	put("bloques", d.bloques);
	fm.version = 1;
	fm.origen = "propio";
	return fm;
}

/** Cuerpo de la nota: el prompt bajo el encabezado «## Prompt». */
export function draftToBody(d: PromptDraft): string {
	return `## Prompt\n\n${d.prompt.trim()}\n`;
}

/** Problemas del borrador: las reglas del método más el título, que el formulario exige. */
export function validateDraft(d: PromptDraft, ejemplosCount?: number): ValidationIssue[] {
	const issues = validatePrompt(draftToFrontmatter(d), draftToBody(d), { ejemplosCount });
	if (d.titulo.trim() === "") {
		issues.unshift({ code: "missing-required", field: "titulo" });
	}
	const usesFewShot = d.tecnica.includes("few-shot") || d.tecnica.includes("few-shot+cot");
	if (usesFewShot && d.ejemplos_ref.trim() === "") {
		issues.push({ code: "few-shot-examples-range", field: "ejemplos_ref" });
	}
	return issues;
}

/** Agrega o quita el bloque «no inventar datos» sin duplicarlo. */
export function withNoInvent(bloques: string[], enabled: boolean): string[] {
	const rest = bloques.filter((b) => b !== BLOQUE_NO_INVENTAR);
	return enabled ? [...rest, BLOQUE_NO_INVENTAR] : rest;
}

/** Nombre de archivo (sin carpeta) a partir del título. */
export function noteFileName(titulo: string): string {
	return `${sanitizeFolderName(titulo) || "Sin título"}.md`;
}

/** Ruta libre: si ya existe una nota con ese nombre agrega « 2», « 3», etc. */
export function uniquePath(folder: string, fileName: string, exists: (path: string) => boolean): string {
	const dot = fileName.lastIndexOf(".");
	const stem = dot === -1 ? fileName : fileName.slice(0, dot);
	const ext = dot === -1 ? "" : fileName.slice(dot);
	const build = (n: number) => `${folder ? folder + "/" : ""}${n === 1 ? stem : `${stem} ${n}`}${ext}`;
	let n = 1;
	while (exists(build(n))) n++;
	return build(n);
}

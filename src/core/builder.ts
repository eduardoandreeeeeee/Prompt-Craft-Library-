/**
 * Constructor de prompts: convierte el prompt de una nota en el texto final que se copia.
 * No depende de Obsidian.
 */

import type { StyleProfile } from "./settings";
import { BLOQUE_NO_INVENTAR, FEW_SHOT_MAX, FEW_SHOT_MIN, toList } from "./schema";
import { buildStyleBlock } from "./style";
import { renderPrompt } from "./variables";

/**
 * Texto que se copia realmente: si la sección es un solo bloque de código o una cita
 * completa (líneas con «>»), se quita ese formato de la nota.
 */
export function cleanPromptText(section: string): string {
	const text = section.trim();

	const fenced = /^```[^\n]*\n([\s\S]*?)\n```$/.exec(text);
	if (fenced) return fenced[1].trim();

	const lines = text.split(/\r?\n/);
	const filled = lines.filter((l) => l.trim() !== "");
	if (filled.length > 0 && filled.every((l) => /^\s*>/.test(l))) {
		return lines.map((l) => l.replace(/^\s*>\s?/, "")).join("\n").trim();
	}
	return text;
}

export interface BuildResult {
	text: string;
	/** Variables que quedaron sin valor. */
	missing: string[];
}

export interface PromptExtras {
	/** Ejemplos ya formateados (few-shot); se agregan después del prompt. */
	examples?: string;
	/** Textos de los bloques reutilizables; se agregan después de los ejemplos. */
	blocks?: string[];
}

/** Texto del prompt con sus ejemplos y bloques, antes de reemplazar las variables. */
export function composePrompt(section: string, extras: PromptExtras = {}): string {
	return [cleanPromptText(section), extras.examples ?? "", ...(extras.blocks ?? [])]
		.map((part) => part.trim())
		.filter(Boolean)
		.join("\n\n");
}

/** Prompt final: variables reemplazadas y, si se pide, el bloque de estilo al final. */
export function buildFinalPrompt(
	section: string,
	values: Record<string, string>,
	style: StyleProfile | null,
	extras: PromptExtras = {},
): BuildResult {
	const rendered = renderPrompt(composePrompt(section, extras), values);
	const block = style ? buildStyleBlock(style) : "";
	return { text: block ? `${rendered.text}\n\n${block}` : rendered.text, missing: rendered.missing };
}

export type ExamplesAdvice = "none" | "ok" | "missing" | "range";

/** Aviso sobre los ejemplos de un prompt few-shot: sin banco enlazado o fuera de 2 a 5. */
export function examplesAdvice(tecnica: unknown, count: number | undefined): ExamplesAdvice {
	const list = toList(tecnica);
	if (!list.includes("few-shot") && !list.includes("few-shot+cot")) return "none";
	if (count === undefined) return "missing";
	return count < FEW_SHOT_MIN || count > FEW_SHOT_MAX ? "range" : "ok";
}

export type SensitivityLevel = "general" | "personal" | "sensitive";

export interface SensitivityAdvice {
	level: SensitivityLevel;
	/** En contexto sensible se pide confirmar antes de copiar. */
	requiresConfirmation: boolean;
	/** Contexto sensible sin la restricción de no inventar datos. */
	missingNoInvent: boolean;
}

export function sensitivityAdvice(sensibilidad: unknown, bloques: unknown): SensitivityAdvice {
	const level: SensitivityLevel =
		sensibilidad === "contexto-sensible" ? "sensitive" : sensibilidad === "datos-personales" ? "personal" : "general";
	return {
		level,
		requiresConfirmation: level === "sensitive",
		missingNoInvent: level === "sensitive" && !toList(bloques).includes(BLOQUE_NO_INVENTAR),
	};
}

/**
 * Catálogo de diagnóstico: síntoma observado en la respuesta de una IA, qué parte del
 * prompt conviene ajustar y cómo. Los textos están en los archivos de idioma.
 */

import { hasKey, labelFor, t } from "../i18n";
import { ELEMENTOS, Elemento } from "./vocab";

export const DIAGNOSTIC_IDS = [
	"D01", "D02", "D03", "D04", "D05", "D06", "D07",
	"D08", "D09", "D10", "D11", "D12", "D13", "D14",
] as const;
export type DiagnosticId = (typeof DIAGNOSTIC_IDS)[number];

/** Qué se ajusta en una iteración: uno de los cinco elementos, la técnica o algo fuera del prompt. */
export const ADJUST_TARGETS = [...ELEMENTOS, "tecnica", "fuera-del-prompt"] as const;
export type AdjustTarget = Elemento | "tecnica" | "fuera-del-prompt";

/** Parte del prompt que corrige cada síntoma. */
export const DIAGNOSTIC_TARGET: Record<DiagnosticId, AdjustTarget> = {
	D01: "contexto",
	D02: "formato",
	D03: "tecnica",
	D04: "tecnica",
	D05: "restricciones",
	D06: "restricciones",
	D07: "restricciones",
	D08: "restricciones",
	D09: "tarea",
	D10: "contexto",
	D11: "tarea",
	D12: "tecnica",
	D13: "contexto",
	D14: "fuera-del-prompt",
};

/** Cantidad de iteraciones seguidas sin mejora a partir de la cual se sugiere adjuntar un documento de referencia. */
export const STOP_AFTER = 3;

export function isDiagnosticId(value: string): value is DiagnosticId {
	return (DIAGNOSTIC_IDS as readonly string[]).includes(value);
}

export function symptomText(id: DiagnosticId): string {
	return t(`diag.${id}.symptom`);
}

export function fixText(id: DiagnosticId): string {
	return t(`diag.${id}.fix`);
}

export function adjustLabel(target: AdjustTarget): string {
	return (ELEMENTOS as readonly string[]).includes(target)
		? labelFor("elemento", target)
		: hasKey(`adjust.${target}`)
			? t(`adjust.${target}` as "adjust.tecnica")
			: target;
}

/** Partes del prompt que conviene ajustar según los síntomas elegidos, sin repetir y en orden. */
export function targetsFor(ids: string[]): AdjustTarget[] {
	const result: AdjustTarget[] = [];
	for (const id of ids) {
		if (!isDiagnosticId(id)) continue;
		const target = DIAGNOSTIC_TARGET[id];
		if (!result.includes(target)) result.push(target);
	}
	return result;
}

export function shouldSuggestReference(sinMejora: number): boolean {
	return sinMejora >= STOP_AFTER;
}

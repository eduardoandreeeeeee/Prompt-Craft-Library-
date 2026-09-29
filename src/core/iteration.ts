/**
 * Ciclo de refinamiento: cada iteración registra qué síntoma se vio, qué elemento se ajustó
 * (uno por iteración) y en qué quedó el prompt. La bitácora guarda el historial y la nota
 * del prompt conserva solo la versión vigente. No depende de Obsidian.
 */

import { AdjustTarget, adjustLabel, isDiagnosticId, symptomText } from "./diagnostics";
import { t } from "../i18n";
import { extractPromptSection } from "./schema";
import type { Estado } from "./vocab";

export type Outcome = "mejoro" | "igual" | "empeoro";
export const OUTCOMES: readonly Outcome[] = ["mejoro", "igual", "empeoro"];

export interface IterationInput {
	/** Opcional: en el registro rápido puede no haber síntomas. */
	symptoms?: string[];
	target: AdjustTarget;
	/** Opcional: en el registro rápido puede no haber nota. */
	note?: string;
	outcome: Outcome;
	/** Texto del prompt después del ajuste. */
	newPrompt: string;
	estado: Estado;
	/** Fecha en formato AAAA-MM-DD. */
	date: string;
}

export interface Counters {
	version: number;
	iteraciones: number;
	sinMejora: number;
}

const num = (value: unknown, fallback: number): number =>
	typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

/**
 * Modo del registro: el diagnóstico completo parte de los síntomas; el registro rápido es para
 * ajustes obvios y solo pide el elemento ajustado, el prompt resultante y el resultado.
 */
export type IterationMode = "completo" | "rapido";

/**
 * ¿Hay lo mínimo para guardar? En el diagnóstico completo, al menos un síntoma o una nota; en el
 * registro rápido basta el elemento ajustado y el resultado, que siempre tienen valor.
 */
export function canSaveIteration(mode: IterationMode, input: Pick<IterationInput, "symptoms" | "note">): boolean {
	if (mode === "rapido") return true;
	return (input.symptoms ?? []).length > 0 || (input.note ?? "").trim() !== "";
}

/** Contadores de la nota del prompt después de registrar una iteración; la versión sube solo si el prompt cambió. */
export function nextCounters(fm: Record<string, unknown>, outcome: Outcome, promptChanged = true): Counters {
	const iteraciones = num(fm.iteraciones, 0) + 1;
	const version = num(fm.version, 1);
	return {
		version: promptChanged ? version + 1 : version,
		iteraciones,
		sinMejora: outcome === "mejoro" ? 0 : num(fm.iteraciones_sin_mejora, 0) + 1,
	};
}

/** Cambia el texto bajo «## Prompt» sin tocar el resto de la nota. */
export function replacePromptSection(body: string, newText: string): string {
	const lines = body.split(/\r?\n/);
	const start = lines.findIndex((l) => /^##\s+prompt\s*$/i.test(l));
	const text = newText.trim();
	if (start === -1) return `${body.replace(/\s+$/, "")}\n\n## Prompt\n\n${text}\n`;

	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		if (/^##\s/.test(lines[i])) {
			end = i;
			break;
		}
	}
	const rest = lines.slice(end);
	return [...lines.slice(0, start + 1), "", text, "", ...rest].join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "\n");
}

/** Cita de Obsidian: cada línea con «> ». */
export function quoteLines(text: string): string {
	return text
		.trim()
		.split(/\r?\n/)
		.map((l) => (l ? `> ${l}` : ">"))
		.join("\n");
}

function promptCallout(title: string, text: string): string {
	return `> [!note]- ${title}\n${quoteLines(text)}`;
}

/** Cuerpo inicial de una bitácora: el prompt tal como estaba antes de la primera iteración. */
export function initialLogBody(promptText: string): string {
	return `## ${t("log.initial")}\n\n${promptCallout(t("log.promptLabel", { version: 1 }), promptText)}\n`;
}

function symptomLine(id: string): string {
	return isDiagnosticId(id) ? `${id} · ${symptomText(id)}` : id;
}

/** Entrada de bitácora para una iteración. `version` es la versión que resulta. */
export function iterationEntry(input: IterationInput, iteration: number, version: number, promptChanged: boolean): string {
	const lines = [`## ${t("log.iteration", { n: iteration, date: input.date })}`, ""];
	const symptoms = input.symptoms ?? [];
	const note = (input.note ?? "").trim();
	if (symptoms.length) lines.push(`- ${t("log.symptoms")}: ${symptoms.map(symptomLine).join("; ")}`);
	lines.push(`- ${t("log.adjusted")}: ${adjustLabel(input.target)}`);
	lines.push(`- ${t("log.outcome")}: ${t(`outcome.${input.outcome}`)}`);
	if (note) lines.push(`- ${t("log.note")}: ${note.replace(/\r?\n/g, " ")}`);
	lines.push("");
	lines.push(
		promptChanged
			? promptCallout(t("log.promptLabel", { version }), input.newPrompt)
			: `_${t("log.unchanged")}_`,
	);
	return `${lines.join("\n")}\n`;
}

/** Agrega una entrada al final del cuerpo de una bitácora. */
export function appendToLog(body: string, entry: string): string {
	return `${body.replace(/\s+$/, "")}\n\n${entry}`;
}

/** Texto del prompt vigente de una nota, tal como está escrito. */
export function currentPrompt(body: string): string {
	return extractPromptSection(body);
}

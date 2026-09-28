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
	symptoms: string[];
	target: AdjustTarget;
	note: string;
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
	if (input.symptoms.length) lines.push(`- ${t("log.symptoms")}: ${input.symptoms.map(symptomLine).join("; ")}`);
	lines.push(`- ${t("log.adjusted")}: ${adjustLabel(input.target)}`);
	lines.push(`- ${t("log.outcome")}: ${t(`outcome.${input.outcome}`)}`);
	if (input.note.trim()) lines.push(`- ${t("log.note")}: ${input.note.trim().replace(/\r?\n/g, " ")}`);
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

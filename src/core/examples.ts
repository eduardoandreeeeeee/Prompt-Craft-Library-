/**
 * Banco de ejemplos para few-shot: una nota con un encabezado «### Ejemplo N» por ejemplo,
 * cada uno con una entrada y una salida.
 */

import { t } from "../i18n";

export const EXAMPLES_MIN = 2;
export const EXAMPLES_MAX = 5;

const HEADING = /^###\s+(ejemplo|example)\b/i;
const INPUT_LABEL = /^\*\*(entrada|input)\*\*\s*$/i;
const OUTPUT_LABEL = /^\*\*(salida|output)\*\*\s*$/i;

export interface Example {
	input: string;
	output: string;
}

/** Cuerpo de la nota de un banco de ejemplos. */
export function buildExamplesBody(examples: Example[]): string {
	return (
		examples
			.map(
				(e, i) =>
					`### ${t("example.heading")} ${i + 1}\n\n**${t("example.input")}**\n\n${e.input.trim()}\n\n**${t("example.output")}**\n\n${e.output.trim()}\n`,
			)
			.join("\n") || ""
	);
}

/** Ejemplos de una nota. Acepta las etiquetas en español o en inglés. */
export function parseExamples(body: string): Example[] {
	const sections: string[][] = [];
	let current: string[] | null = null;
	for (const line of body.split(/\r?\n/)) {
		if (HEADING.test(line)) {
			current = [];
			sections.push(current);
		} else if (/^#{1,3}\s/.test(line)) {
			current = null;
		} else if (current) {
			current.push(line);
		}
	}

	return sections.map((lines) => {
		const inputAt = lines.findIndex((l) => INPUT_LABEL.test(l.trim()));
		const outputAt = lines.findIndex((l) => OUTPUT_LABEL.test(l.trim()));
		const clean = (l: string[]) => l.join("\n").trim();
		if (inputAt === -1 && outputAt === -1) return { input: clean(lines), output: "" };
		const inputEnd = outputAt > inputAt ? outputAt : lines.length;
		return {
			input: inputAt === -1 ? "" : clean(lines.slice(inputAt + 1, inputEnd)),
			output: outputAt === -1 ? "" : clean(lines.slice(outputAt + 1)),
		};
	});
}

/** Texto de los ejemplos para agregar al final de un prompt few-shot. */
export function formatExamplesForPrompt(examples: Example[]): string {
	if (examples.length === 0) return "";
	const blocks = examples.map((e, i) => {
		const parts = [`${t("example.heading")} ${i + 1}`];
		if (e.input) parts.push(`${t("example.input")}: ${e.input}`);
		if (e.output) parts.push(`${t("example.output")}: ${e.output}`);
		return parts.join("\n");
	});
	return `${t("example.intro")}\n\n${blocks.join("\n\n")}`;
}

export type ExamplesIssue = "count" | "empty";

/** Problemas de un banco de ejemplos antes de guardarlo. */
export function validateExamples(examples: Example[]): ExamplesIssue[] {
	const issues: ExamplesIssue[] = [];
	if (examples.length < EXAMPLES_MIN || examples.length > EXAMPLES_MAX) issues.push("count");
	if (examples.some((e) => e.input.trim() === "" || e.output.trim() === "")) issues.push("empty");
	return issues;
}

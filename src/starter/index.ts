/**
 * Paquete inicial: bloques, bancos de ejemplos, prompts y meta-prompts de partida, escritos
 * como contenido propio del plugin. Se instala con el mismo mecanismo que un paquete
 * importado y cada persona lo puede editar o borrar después.
 */

import { buildExamplesBody } from "../core/examples";
import { getLocale } from "../i18n";
import { PromptDraft, draftToBody, draftToFrontmatter, emptyDraft } from "../core/note";
import { ESQUEMA_ACTUAL } from "../core/schema";
import { sanitizeFolderName } from "../core/paths";
import { ParsedNote, StringifyYaml, composeNote } from "../core/pack";
import en from "./en";
import es from "./es";
import type { StarterPrompt, StarterSpec } from "./types";

export const STARTER_ORIGIN = "paquete-inicial";

export function starterSpec(locale: string = getLocale()): StarterSpec {
	return locale === "en" ? en : es;
}

function parsed(fm: Record<string, unknown>, body: string, stringify: StringifyYaml): ParsedNote {
	return {
		raw: composeNote(fm, body, stringify),
		frontmatter: fm,
		body,
		tipo: String(fm.tipo),
		titulo: String(fm.titulo),
	};
}

function promptNote(spec: StarterSpec, p: StarterPrompt, tipo: "prompt" | "meta-prompt", stringify: StringifyYaml): ParsedNote {
	const bank = p.ejemplos ? spec.banks.find((b) => b.key === p.ejemplos) : undefined;
	const draft: PromptDraft = {
		...emptyDraft(),
		tipo,
		titulo: p.titulo,
		dominio: p.dominio ? spec.domains[p.dominio] : "",
		tarea_que_resuelve: p.tarea_que_resuelve,
		nota_reutilizacion: p.nota_reutilizacion,
		tecnica: p.tecnica,
		sensibilidad: p.sensibilidad,
		tarea: p.tarea,
		herramienta: tipo === "prompt" ? ["chat"] : [],
		criterios: p.criterios ?? [],
		ejemplos_ref: bank ? `[[${sanitizeFolderName(bank.titulo)}]]` : "",
		bloques: p.bloques,
		prompt: p.prompt,
	};
	return parsed({ ...draftToFrontmatter(draft), origen: STARTER_ORIGIN }, draftToBody(draft), stringify);
}

/** Todas las notas del paquete inicial en el idioma activo. */
export function starterNotes(stringify: StringifyYaml, locale: string = getLocale()): ParsedNote[] {
	const spec = starterSpec(locale);
	const notes: ParsedNote[] = [];

	for (const b of spec.blocks) {
		notes.push(
			parsed(
				{ esquema: ESQUEMA_ACTUAL, tipo: "bloque", titulo: b.titulo, bloque_id: b.id, origen: STARTER_ORIGIN },
				`# ${b.titulo}\n\n${b.texto}`,
				stringify,
			),
		);
	}
	for (const bank of spec.banks) {
		notes.push(
			parsed(
				{
					esquema: ESQUEMA_ACTUAL,
					tipo: "ejemplos",
					titulo: bank.titulo,
					tarea_que_resuelve: bank.tarea_que_resuelve,
					origen: STARTER_ORIGIN,
				},
				buildExamplesBody(bank.ejemplos),
				stringify,
			),
		);
	}
	for (const p of spec.prompts) notes.push(promptNote(spec, p, "prompt", stringify));
	for (const m of spec.metas) notes.push(promptNote(spec, m, "meta-prompt", stringify));
	return notes;
}

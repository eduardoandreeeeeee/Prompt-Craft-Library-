/**
 * Paquetes de prompts: un archivo Markdown que reúne varias notas para compartirlas.
 *
 * Formato: frontmatter (`tipo: paquete`, `esquema_paquete`, nombre, descripción, fecha) y,
 * en el cuerpo, cada nota completa dentro de un bloque de código con la etiqueta
 * `promptcraft-note`. La valla del bloque siempre es más larga que cualquier secuencia de
 * comillas invertidas de la nota, así que el contenido nunca la cierra por accidente.
 *
 * No depende de Obsidian: quien llama entrega las funciones de lectura y escritura de YAML.
 */

import { slugify } from "./blocks";

export const PACK_SCHEMA = 1;
export const PACK_FENCE_LABEL = "promptcraft-note";

export type ParseYaml = (text: string) => unknown;
export type StringifyYaml = (value: unknown) => string;

export interface ParsedNote {
	/** Texto completo de la nota, con su frontmatter. */
	raw: string;
	frontmatter: Record<string, unknown>;
	body: string;
	tipo: string;
	titulo: string;
}

export interface PackInfo {
	nombre: string;
	descripcion: string;
	/** Fecha AAAA-MM-DD. */
	creado: string;
}

export type PackError = "not-a-pack" | "unsupported-schema" | "empty";

export type PackResult =
	| { ok: true; info: PackInfo; notes: ParsedNote[] }
	| { ok: false; error: PackError };

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Interpreta el texto de una nota. Un YAML inválido se trata como frontmatter vacío. */
export function parseNote(raw: string, parseYaml: ParseYaml): ParsedNote {
	const match = FRONTMATTER.exec(raw);
	let frontmatter: Record<string, unknown> = {};
	if (match) {
		try {
			frontmatter = asRecord(parseYaml(match[1]));
		} catch {
			frontmatter = {};
		}
	}
	const body = match ? raw.slice(match[0].length) : raw;
	const heading = /^#\s+(.+)$/m.exec(body);
	return {
		raw,
		frontmatter,
		body,
		tipo: text(frontmatter.tipo),
		titulo: text(frontmatter.titulo) || (heading ? heading[1].trim() : ""),
	};
}

/** Nota a partir de su frontmatter y su cuerpo. */
export function composeNote(fm: Record<string, unknown>, body: string, stringify: StringifyYaml): string {
	return `---\n${stringify(fm).trimEnd()}\n---\n\n${body.trim()}\n`;
}

/** Copia de la nota con el frontmatter modificado; `undefined` en un cambio elimina el campo. */
export function withFrontmatter(
	note: ParsedNote,
	changes: Record<string, unknown>,
	stringify: StringifyYaml,
): ParsedNote {
	const fm: Record<string, unknown> = { ...note.frontmatter };
	for (const [key, value] of Object.entries(changes)) {
		if (value === undefined) delete fm[key];
		else fm[key] = value;
	}
	return { ...note, frontmatter: fm, tipo: text(fm.tipo), raw: composeNote(fm, note.body, stringify) };
}

/** Identificador del bloque: el campo `bloque_id` o, si falta, el nombre del archivo o el título. */
export function blockId(fm: Record<string, unknown>, fallbackName: string): string {
	return text(fm.bloque_id) || slugify(fallbackName);
}

/** Valla de bloque de código más larga que cualquier secuencia de comillas invertidas del texto. */
export function fenceFor(content: string): string {
	let longest = 0;
	for (const run of content.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
	return "`".repeat(Math.max(4, longest + 1));
}

export function serializePack(info: PackInfo, notes: ParsedNote[], stringify: StringifyYaml): string {
	const fm: Record<string, unknown> = {
		tipo: "paquete",
		esquema_paquete: PACK_SCHEMA,
		nombre: info.nombre.trim(),
	};
	if (info.descripcion.trim()) fm.descripcion = info.descripcion.trim();
	fm.creado = info.creado;
	fm.cantidad = notes.length;

	const parts = [`# ${info.nombre.trim()}`];
	if (info.descripcion.trim()) parts.push(info.descripcion.trim());
	parts.push(notes.map((n) => `- ${n.titulo || "?"} (${n.tipo || "?"})`).join("\n"));
	for (const note of notes) {
		const content = note.raw.trim();
		const fence = fenceFor(content);
		parts.push(`${fence}${PACK_FENCE_LABEL}\n${content}\n${fence}`);
	}
	return `---\n${stringify(fm).trimEnd()}\n---\n\n${parts.join("\n\n")}\n`;
}

/** Contenido de cada bloque `promptcraft-note` de un texto. */
export function extractFencedNotes(source: string): string[] {
	const lines = source.split(/\r?\n/);
	const found: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		const open = new RegExp(`^(\`{4,})${PACK_FENCE_LABEL}\\s*$`).exec(lines[i]);
		if (!open) continue;
		const size = open[1].length;
		const content: string[] = [];
		let closed = false;
		for (i = i + 1; i < lines.length; i++) {
			const close = /^(`{4,})\s*$/.exec(lines[i]);
			if (close && close[1].length >= size) {
				closed = true;
				break;
			}
			content.push(lines[i]);
		}
		if (closed) found.push(content.join("\n"));
	}
	return found;
}

export function parsePack(source: string, parseYaml: ParseYaml): PackResult {
	const match = FRONTMATTER.exec(source);
	if (!match) return { ok: false, error: "not-a-pack" };
	let fm: Record<string, unknown>;
	try {
		fm = asRecord(parseYaml(match[1]));
	} catch {
		return { ok: false, error: "not-a-pack" };
	}
	if (fm.tipo !== "paquete") return { ok: false, error: "not-a-pack" };
	const schema = typeof fm.esquema_paquete === "number" ? fm.esquema_paquete : 0;
	if (schema < 1 || schema > PACK_SCHEMA) return { ok: false, error: "unsupported-schema" };

	const notes = extractFencedNotes(source.slice(match[0].length)).map((raw) => parseNote(raw, parseYaml));
	if (notes.length === 0) return { ok: false, error: "empty" };
	return {
		ok: true,
		info: { nombre: text(fm.nombre), descripcion: text(fm.descripcion), creado: text(fm.creado) },
		notes,
	};
}

/**
 * Frontmatter de una nota importada: se quitan los contadores de iteración (la bitácora no
 * viaja en el paquete), la versión vuelve a 1 y se marca el origen. Un bloque sin
 * identificador recibe uno a partir de su título.
 */
export function importedChanges(note: ParsedNote): Record<string, unknown> {
	const fm = note.frontmatter;
	const changes: Record<string, unknown> = {
		iteraciones: undefined,
		iteraciones_sin_mejora: undefined,
	};
	if ("version" in fm || note.tipo === "prompt" || note.tipo === "meta-prompt") changes.version = 1;
	if (fm.origen !== "paquete-inicial") changes.origen = "importado";
	if (note.tipo === "bloque" && !text(fm.bloque_id)) {
		changes.bloque_id = slugify(note.titulo);
	}
	return changes;
}

/** Identificadores de bloque que usan las notas, sin repetir. */
export function referencedBlocks(notes: ParsedNote[]): string[] {
	const ids = new Set<string>();
	for (const n of notes) {
		const list = n.frontmatter.bloques;
		if (Array.isArray(list)) for (const id of list) if (typeof id === "string" && id.trim()) ids.add(id.trim());
	}
	return [...ids];
}

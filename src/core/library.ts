/**
 * Lectura de notas de la biblioteca: interpreta una nota ya leída (frontmatter y cuerpo)
 * sin depender de Obsidian.
 */

import { ValidationIssue, validatePrompt } from "./schema";

export interface NoteSource {
	path: string;
	frontmatter: Record<string, unknown> | null;
	body: string;
}

export interface LibraryEntry {
	path: string;
	title: string;
	frontmatter: Record<string, unknown>;
	body: string;
}

export interface NoteResult {
	path: string;
	name: string;
	issues: ValidationIssue[];
}

/** Nombre de la nota sin carpeta ni extensión. */
export function baseName(path: string): string {
	const file = path.slice(path.lastIndexOf("/") + 1);
	return file.replace(/\.md$/i, "");
}

export function entryFromNote(src: NoteSource): LibraryEntry {
	const fm = src.frontmatter ?? {};
	const title = typeof fm.titulo === "string" && fm.titulo.trim() ? fm.titulo.trim() : baseName(src.path);
	return { path: src.path, title, frontmatter: fm, body: src.body };
}

/** Quita el bloque de frontmatter del inicio del texto de una nota. */
export function stripFrontmatter(content: string): string {
	const match = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(content);
	return match ? content.slice(match[0].length) : content;
}

/**
 * Cantidad de ejemplos de una nota de ejemplos: encabezados de nivel 3 cuyo texto
 * empieza con «Ejemplo» o «Example».
 */
export function countExamples(body: string): number {
	return body.split(/\r?\n/).filter((l) => /^###\s+(ejemplo|example)/i.test(l)).length;
}

/** Destino de un enlace de Obsidian: «[[Nota|alias#sección]]» entrega «Nota». */
export function linkTarget(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const match = /^\s*\[\[([^\]]+)\]\]\s*$/.exec(value);
	if (!match) return null;
	const target = match[1].split("|")[0].split("#")[0].trim();
	return target || null;
}

export function validateNote(src: NoteSource, ejemplosCount?: number): NoteResult {
	return {
		path: src.path,
		name: entryFromNote(src).title,
		issues: validatePrompt(src.frontmatter ?? {}, src.body, { ejemplosCount }),
	};
}

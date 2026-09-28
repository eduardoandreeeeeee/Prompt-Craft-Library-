/**
 * Bloques reutilizables: fragmentos de texto (roles, restricciones, formatos) que se agregan
 * al final de un prompt. Cada bloque es una nota `tipo: bloque` cuyo cuerpo es el texto.
 */

import { t } from "../i18n";
import { BLOQUE_NO_INVENTAR } from "./schema";

export interface BlockNote {
	id: string;
	title: string;
	text: string;
}

/** Identificador estable a partir de un texto: minúsculas, sin tildes y con guiones. */
export function slugify(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Texto de un bloque: el cuerpo de la nota, sin un encabezado de nivel 1 inicial. */
export function blockText(body: string): string {
	return body.replace(/^\s*#\s[^\n]*\n?/, "").trim();
}

/** Texto de respaldo para los bloques que el plugin conoce y que no existen como nota. */
export function builtinBlockText(id: string): string | null {
	return id === BLOQUE_NO_INVENTAR ? t("block.no-inventar.text") : null;
}

export interface ResolvedBlocks {
	texts: string[];
	/** Identificadores sin nota ni texto de respaldo. */
	missing: string[];
}

export function resolveBlocks(ids: string[], available: BlockNote[]): ResolvedBlocks {
	const texts: string[] = [];
	const missing: string[] = [];
	for (const id of ids) {
		const found = available.find((b) => b.id === id);
		const text = found?.text || builtinBlockText(id);
		if (text) texts.push(text);
		else missing.push(id);
	}
	return { texts, missing };
}

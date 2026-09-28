import { hasKey, t } from "../i18n";
import type { ValidationIssue } from "./schema";

/** Nombre legible de un campo del frontmatter; si no tiene traducción se muestra el identificador. */
export function fieldLabel(field: string): string {
	const key = `field.${field}`;
	return hasKey(key) ? t(key) : field;
}

/** Mensaje de un problema de validación en el idioma activo. */
export function formatIssue(issue: ValidationIssue): string {
	return t(`issue.${issue.code}`, { field: fieldLabel(issue.field) });
}

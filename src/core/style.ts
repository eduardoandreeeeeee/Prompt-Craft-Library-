import { t } from "../i18n";
import type { StyleProfile } from "./settings";

/**
 * Bloque de preferencias de estilo para agregar al final de un prompt.
 * Devuelve texto vacío si el perfil no tiene ningún dato.
 */
export function buildStyleBlock(profile: StyleProfile): string {
	const lines: string[] = [];
	const add = (key: "style.block.context" | "style.block.language" | "style.block.address" | "style.block.register" | "style.block.closing", value: string) => {
		if (value.trim()) lines.push(`- ${t(key, { value: value.trim() })}`);
	};
	add("style.block.context", profile.contextoBase);
	add("style.block.language", profile.idiomaVariante);
	add("style.block.address", profile.tratamiento);
	add("style.block.register", profile.registro);
	for (const rule of profile.terminos) {
		lines.push(`- ${t("style.block.term", { use: rule.usar, avoid: rule.evitar })}`);
	}
	add("style.block.closing", profile.cierre);

	return lines.length ? `${t("style.block.heading")}\n${lines.join("\n")}` : "";
}

/**
 * Valores del perfil de estilo por nombre de campo, para prellenar variables del mismo nombre
 * (`{{tratamiento}}`, `{{idioma-variante}}`, `{{cierre}}`…). Solo incluye los campos con dato.
 */
export function styleVariableValues(profile: StyleProfile): Record<string, string> {
	const fields: Record<string, string> = {
		"contexto-base": profile.contextoBase,
		"idioma-variante": profile.idiomaVariante,
		tratamiento: profile.tratamiento,
		registro: profile.registro,
		cierre: profile.cierre,
	};
	return Object.fromEntries(
		Object.entries(fields)
			.map(([name, value]) => [name, value.trim()])
			.filter(([, value]) => value !== ""),
	);
}

import en from "./locales/en";
import es, { TranslationKey } from "./locales/es";

export type { TranslationKey };
export type Locale = "es" | "en";
export type LanguageSetting = "auto" | Locale;

export const LOCALES: readonly Locale[] = ["es", "en"];

const dictionaries: Record<Locale, Partial<Record<TranslationKey, string>>> = { es, en };

let current: Locale = "es";

/**
 * Idioma efectivo a partir del ajuste y del idioma de Obsidian.
 * Si el idioma de Obsidian no está traducido, se usa inglés como idioma internacional.
 */
export function resolveLocale(setting: LanguageSetting, systemLanguage?: string | null): Locale {
	if (setting !== "auto") return setting;
	const code = (systemLanguage ?? "").toLowerCase().slice(0, 2);
	return (LOCALES as readonly string[]).includes(code) ? (code as Locale) : "en";
}

export function setLocale(locale: Locale): void {
	current = locale;
}

export function getLocale(): Locale {
	return current;
}

export function hasKey(key: string): key is TranslationKey {
	return Object.prototype.hasOwnProperty.call(es, key);
}

/** Traduce una clave. Si falta en el idioma activo se usa el español; si falta en ambos, la clave. */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
	const template: string = dictionaries[current][key] ?? es[key] ?? key;
	if (!vars) return template;
	return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
		name in vars ? String(vars[name]) : whole,
	);
}

/**
 * Etiqueta visible de un valor de vocabulario. Los valores agregados por la persona
 * (sin traducción) se muestran tal cual.
 */
export function labelFor(field: string, id: string): string {
	const key = `vocab.${field}.${id}`;
	return hasKey(key) ? t(key) : id;
}

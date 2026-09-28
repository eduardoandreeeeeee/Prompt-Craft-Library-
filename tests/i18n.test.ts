import { afterEach, describe, expect, it } from "vitest";
import {
	CLOSED_VOCAB,
	ELEMENTOS,
	OPEN_VOCAB_INITIAL,
	SECTORES_EJEMPLO,
} from "../src/core/vocab";
import { hasKey, labelFor, resolveLocale, setLocale, t } from "../src/i18n";
import en from "../src/i18n/locales/en";
import es from "../src/i18n/locales/es";

afterEach(() => setLocale("es"));

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe("integridad de los idiomas", () => {
	it("el inglés no tiene claves que no existan en español", () => {
		for (const key of Object.keys(en)) {
			expect(hasKey(key), `clave sobrante en en.ts: ${key}`).toBe(true);
		}
	});

	it("el inglés conserva los mismos marcadores {…} que el español", () => {
		for (const [key, value] of Object.entries(en)) {
			const base = (es as Record<string, string>)[key];
			expect(placeholders(value as string), key).toEqual(placeholders(base));
		}
	});

	it("todo valor de vocabulario inicial y cerrado tiene etiqueta en español", () => {
		const missing: string[] = [];
		for (const [field, values] of Object.entries(CLOSED_VOCAB)) {
			for (const v of values) if (!hasKey(`vocab.${field}.${v}`)) missing.push(`${field}.${v}`);
		}
		for (const [field, values] of Object.entries(OPEN_VOCAB_INITIAL)) {
			for (const v of values) if (!hasKey(`vocab.${field}.${v}`)) missing.push(`${field}.${v}`);
		}
		for (const v of SECTORES_EJEMPLO) if (!hasKey(`vocab.sector.${v}`)) missing.push(`sector.${v}`);
		for (const v of ELEMENTOS) if (!hasKey(`vocab.elemento.${v}`)) missing.push(`elemento.${v}`);
		expect(missing).toEqual([]);
	});

	it("el inglés traduce todos los valores de vocabulario", () => {
		const missing = Object.keys(es).filter((k) => k.startsWith("vocab.") && !(k in en));
		expect(missing).toEqual([]);
	});
});

describe("resolveLocale", () => {
	it("respeta un idioma elegido", () => {
		expect(resolveLocale("en", "es")).toBe("en");
		expect(resolveLocale("es", "en")).toBe("es");
	});

	it("en automático usa el de Obsidian y, si no está traducido, inglés", () => {
		expect(resolveLocale("auto", "es")).toBe("es");
		expect(resolveLocale("auto", "en-GB")).toBe("en");
		expect(resolveLocale("auto", "pt-BR")).toBe("en");
		expect(resolveLocale("auto", null)).toBe("en");
	});
});

describe("t y labelFor", () => {
	it("traduce según el idioma activo e interpola variables", () => {
		expect(t("notice.foldersCreated", { count: 3 })).toBe("Estructura creada: 3 carpetas nuevas.");
		setLocale("en");
		expect(t("notice.foldersCreated", { count: 3 })).toBe("Structure created: 3 new folders.");
	});

	it("deja intacto un marcador sin valor", () => {
		expect(t("notice.foldersCreated", {})).toContain("{count}");
	});

	it("muestra tal cual un valor agregado por la persona", () => {
		expect(labelFor("herramienta", "mi-asistente")).toBe("mi-asistente");
		expect(labelFor("herramienta", "chat")).toBe("Chat con IA");
		setLocale("en");
		expect(labelFor("herramienta", "chat")).toBe("AI chat");
	});
});

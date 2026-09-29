/**
 * Modelo de los ajustes. Es la "configuración de la persona": todo lo que cada usuaria
 * o usuario ingresa. El código solo conoce la forma de estos datos, no sus valores.
 */

import type { LanguageSetting } from "../i18n";
import type { FolderNames } from "./paths";
import { sanitizeFolderName } from "./paths";
import { ESTADOS, Estado, OPEN_VOCAB_INITIAL, SENSIBILIDADES, Sensibilidad } from "./vocab";

/** Versión del formato de ajustes (distinta de la versión de esquema de las notas). */
export const SETTINGS_VERSION = 1;

export interface TermRule {
	usar: string;
	evitar: string;
}

/** Perfil de estilo: se traduce en restricciones que el constructor puede insertar. */
export interface StyleProfile {
	contextoBase: string;
	idiomaVariante: string;
	tratamiento: string;
	registro: string;
	terminos: TermRule[];
	cierre: string;
}

export interface OpenVocabulary {
	tarea: string[];
	herramienta: string[];
	sector: string[];
}

/** Valores con que abre el formulario de nueva nota. Vacío = sin valor por defecto. */
export interface ClassificationDefaults {
	herramienta: string;
	sensibilidad: Sensibilidad | "";
	estado: Estado | "";
}

export interface DefaultsSettings extends ClassificationDefaults {
	/** Excepciones por dominio; un campo vacío usa el valor general. */
	porDominio: Record<string, ClassificationDefaults>;
}

export function emptyClassificationDefaults(): ClassificationDefaults {
	return { herramienta: "", sensibilidad: "", estado: "" };
}

export interface PromptCraftSettings {
	settingsVersion: number;
	language: LanguageSetting;
	/** Vacío = valor por defecto traducido; "/" = raíz de la bóveda. */
	rootFolder: string;
	folderNames: FolderNames;
	domains: string[];
	vocab: OpenVocabulary;
	styleProfile: StyleProfile;
	setupCompleted: boolean;
	/** El asistente ya se abrió una vez automáticamente; no se vuelve a abrir solo. */
	setupPrompted: boolean;
	/** Muestra un acceso a la biblioteca en la barra de estado (solo escritorio). */
	showStatusBar: boolean;
	/** Abre la pantalla de inicio cada vez que se abre la bóveda. */
	openHomeOnStartup: boolean;
	defaults: DefaultsSettings;
	/** El registro de iteraciones abre en modo rápido (se recuerda el último usado). */
	iterationQuick: boolean;
	/** La sección «Para empezar» de la pantalla de inicio está plegada. */
	gettingStartedCollapsed: boolean;
}

export function defaultSettings(): PromptCraftSettings {
	return {
		settingsVersion: SETTINGS_VERSION,
		language: "auto",
		rootFolder: "",
		folderNames: {
			prompts: "",
			system: "",
			metaPrompts: "",
			blocks: "",
			examples: "",
			logs: "",
			reference: "",
			packs: "",
		},
		domains: [],
		vocab: {
			tarea: [...OPEN_VOCAB_INITIAL.tarea],
			herramienta: [...OPEN_VOCAB_INITIAL.herramienta],
			sector: [...OPEN_VOCAB_INITIAL.sector],
		},
		styleProfile: {
			contextoBase: "",
			idiomaVariante: "",
			tratamiento: "",
			registro: "",
			terminos: [],
			cierre: "",
		},
		setupCompleted: false,
		setupPrompted: false,
		showStatusBar: true,
		openHomeOnStartup: true,
		defaults: { ...emptyClassificationDefaults(), porDominio: {} },
		iterationQuick: false,
		gettingStartedCollapsed: false,
	};
}

type Bag = Record<string, unknown>;

const asBag = (value: unknown): Bag =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as Bag) : {};

const asString = (value: unknown, fallback: string): string =>
	typeof value === "string" ? value : fallback;

const asStringList = (value: unknown, fallback: string[]): string[] =>
	Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : fallback;

function asTermRules(value: unknown, fallback: TermRule[]): TermRule[] {
	if (!Array.isArray(value)) return fallback;
	return value
		.map(asBag)
		.filter((r) => typeof r.usar === "string" && typeof r.evitar === "string")
		.map((r) => ({ usar: r.usar as string, evitar: r.evitar as string }));
}

function asClassificationDefaults(value: unknown): ClassificationDefaults {
	const b = asBag(value);
	const closed = <T extends string>(v: unknown, list: readonly T[]): T | "" =>
		typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : "";
	return {
		herramienta: asString(b.herramienta, "").trim(),
		sensibilidad: closed(b.sensibilidad, SENSIBILIDADES),
		estado: closed(b.estado, ESTADOS),
	};
}

function asDefaults(value: unknown): DefaultsSettings {
	const b = asBag(value);
	const porDominio: Record<string, ClassificationDefaults> = {};
	for (const [dominio, entry] of Object.entries(asBag(b.porDominio))) {
		const d = asClassificationDefaults(entry);
		if (d.herramienta || d.sensibilidad || d.estado) porDominio[dominio] = d;
	}
	return { ...asClassificationDefaults(b), porDominio };
}

/**
 * Combina los ajustes guardados con los valores por defecto. Tolera datos incompletos
 * o de versiones anteriores: lo que falta se completa, lo que sobra se descarta.
 */
export function mergeSettings(saved: unknown): PromptCraftSettings {
	const d = defaultSettings();
	const s = asBag(saved);
	const names = asBag(s.folderNames);
	const vocab = asBag(s.vocab);
	const style = asBag(s.styleProfile);

	const language = s.language === "es" || s.language === "en" || s.language === "auto" ? s.language : d.language;

	return {
		settingsVersion: SETTINGS_VERSION,
		language,
		rootFolder: asString(s.rootFolder, d.rootFolder),
		folderNames: {
			prompts: asString(names.prompts, d.folderNames.prompts),
			system: asString(names.system, d.folderNames.system),
			metaPrompts: asString(names.metaPrompts, d.folderNames.metaPrompts),
			blocks: asString(names.blocks, d.folderNames.blocks),
			examples: asString(names.examples, d.folderNames.examples),
			logs: asString(names.logs, d.folderNames.logs),
			reference: asString(names.reference, d.folderNames.reference),
			packs: asString(names.packs, d.folderNames.packs),
		},
		domains: asStringList(s.domains, d.domains),
		vocab: {
			tarea: asStringList(vocab.tarea, d.vocab.tarea),
			herramienta: asStringList(vocab.herramienta, d.vocab.herramienta),
			sector: asStringList(vocab.sector, d.vocab.sector),
		},
		styleProfile: {
			contextoBase: asString(style.contextoBase, d.styleProfile.contextoBase),
			idiomaVariante: asString(style.idiomaVariante, d.styleProfile.idiomaVariante),
			tratamiento: asString(style.tratamiento, d.styleProfile.tratamiento),
			registro: asString(style.registro, d.styleProfile.registro),
			terminos: asTermRules(style.terminos, d.styleProfile.terminos),
			cierre: asString(style.cierre, d.styleProfile.cierre),
		},
		setupCompleted: typeof s.setupCompleted === "boolean" ? s.setupCompleted : d.setupCompleted,
		setupPrompted: typeof s.setupPrompted === "boolean" ? s.setupPrompted : d.setupPrompted,
		showStatusBar: typeof s.showStatusBar === "boolean" ? s.showStatusBar : d.showStatusBar,
		openHomeOnStartup: typeof s.openHomeOnStartup === "boolean" ? s.openHomeOnStartup : d.openHomeOnStartup,
		defaults: asDefaults(s.defaults),
		iterationQuick: typeof s.iterationQuick === "boolean" ? s.iterationQuick : d.iterationQuick,
		gettingStartedCollapsed:
			typeof s.gettingStartedCollapsed === "boolean" ? s.gettingStartedCollapsed : d.gettingStartedCollapsed,
	};
}

/** Convierte el texto de un área de texto (un dominio por línea) en una lista limpia y sin repetidos. */
export function parseDomainList(text: string): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const line of text.split(/\r?\n/)) {
		const name = sanitizeFolderName(line);
		const key = name.toLowerCase();
		if (name && !seen.has(key)) {
			seen.add(key);
			result.push(name);
		}
	}
	return result;
}

/**
 * Agrega un valor escrito por la persona a una lista abierta (tarea, herramienta, sector).
 * Si ya existe (por identificador o por etiqueta, sin distinguir mayúsculas), no lo duplica
 * y devuelve el existente. No modifica la lista de origen.
 */
export function addOpenValue(
	list: readonly string[],
	text: string,
	label: (id: string) => string = (id) => id,
): { list: string[]; value: string } {
	const value = text.replace(/\s+/g, " ").trim();
	if (!value) return { list: [...list], value: "" };
	const key = value.toLowerCase();
	const existing = list.find((id) => id.toLowerCase() === key || label(id).toLowerCase() === key);
	if (existing) return { list: [...list], value: existing };
	return { list: [...list, value], value };
}

/**
 * Valores por defecto de clasificación para un dominio: los del dominio, y lo que no tenga,
 * los generales. Un campo vacío significa que el formulario no propone nada.
 */
export function classificationDefaultsFor(defaults: DefaultsSettings, dominio: string): ClassificationDefaults {
	const own = defaults.porDominio[dominio] ?? emptyClassificationDefaults();
	return {
		herramienta: own.herramienta || defaults.herramienta,
		sensibilidad: own.sensibilidad || defaults.sensibilidad,
		estado: own.estado || defaults.estado,
	};
}

/**
 * Estado del asistente de primer uso y su traducción a ajustes. No depende de Obsidian.
 */

import type { LanguageSetting } from "../i18n";
import {
	PromptCraftSettings,
	StyleProfile,
	TermRule,
	parseDomainList,
} from "./settings";
import { labelFor } from "../i18n";
import { HERRAMIENTAS_INICIALES } from "./vocab";

export interface WizardState {
	language: LanguageSetting;
	rootFolder: string;
	domainsText: string;
	/** Herramientas iniciales marcadas. */
	herramientas: string[];
	herramientasOtras: string;
	/** Sectores en que trabaja la persona, uno por línea. */
	sectoresText: string;
	contextoBase: string;
	idiomaVariante: string;
	tratamiento: string;
	registro: string;
	terminosText: string;
	cierre: string;
	/** Instalar el paquete inicial al terminar. No forma parte de los ajustes. */
	installStarter: boolean;
}

/** Una regla por línea con el formato «usar | evitar»; descarta las líneas incompletas. */
export function parseTermRules(text: string): TermRule[] {
	const rules: TermRule[] = [];
	for (const line of text.split(/\r?\n/)) {
		const cut = line.indexOf("|");
		if (cut === -1) continue;
		const usar = line.slice(0, cut).trim();
		const evitar = line.slice(cut + 1).trim();
		if (usar && evitar) rules.push({ usar, evitar });
	}
	return rules;
}

export function formatTermRules(rules: TermRule[]): string {
	return rules.map((r) => `${r.usar} | ${r.evitar}`).join("\n");
}

/** Lista de valores propios, uno por línea, sin vacíos ni repetidos (sin distinguir mayúsculas). */
export function parseOtherList(text: string, alreadyPresent: readonly string[] = []): string[] {
	const seen = new Set(alreadyPresent.map((v) => v.toLowerCase()));
	const result: string[] = [];
	for (const line of text.split(/\r?\n/)) {
		const value = line.replace(/\s+/g, " ").trim();
		const key = value.toLowerCase();
		if (value && !seen.has(key)) {
			seen.add(key);
			result.push(value);
		}
	}
	return result;
}

export function stateFromSettings(s: PromptCraftSettings): WizardState {
	const isInitial = (list: readonly string[]) => (v: string) => list.includes(v);
	return {
		language: s.language,
		rootFolder: s.rootFolder,
		domainsText: s.domains.join("\n"),
		herramientas: s.vocab.herramienta.filter(isInitial(HERRAMIENTAS_INICIALES)),
		herramientasOtras: s.vocab.herramienta.filter((v) => !HERRAMIENTAS_INICIALES.includes(v as never)).join("\n"),
		// Los identificadores de versiones anteriores se muestran con su etiqueta.
		sectoresText: s.vocab.sector.map((v) => labelFor("sector", v)).join("\n"),
		contextoBase: s.styleProfile.contextoBase,
		idiomaVariante: s.styleProfile.idiomaVariante,
		tratamiento: s.styleProfile.tratamiento,
		registro: s.styleProfile.registro,
		terminosText: formatTermRules(s.styleProfile.terminos),
		cierre: s.styleProfile.cierre,
		// Se ofrece por defecto solo la primera vez.
		installStarter: !s.setupCompleted,
	};
}

/** Marcados (en el orden de la lista inicial) seguidos de los propios. */
function mergeOpen(initial: readonly string[], selected: string[], otherText: string): string[] {
	const marked = initial.filter((id) => selected.includes(id));
	return [...marked, ...parseOtherList(otherText, initial)];
}

/** Ajustes resultantes de aplicar lo ingresado en el asistente; no modifica los ajustes de origen. */
export function applyWizard(s: PromptCraftSettings, w: WizardState): PromptCraftSettings {
	const styleProfile: StyleProfile = {
		contextoBase: w.contextoBase.trim(),
		idiomaVariante: w.idiomaVariante.trim(),
		tratamiento: w.tratamiento.trim(),
		registro: w.registro.trim(),
		terminos: parseTermRules(w.terminosText),
		cierre: w.cierre.trim(),
	};
	return {
		...s,
		language: w.language,
		rootFolder: w.rootFolder.trim(),
		domains: parseDomainList(w.domainsText),
		vocab: {
			...s.vocab,
			herramienta: mergeOpen(HERRAMIENTAS_INICIALES, w.herramientas, w.herramientasOtras),
			sector: parseOtherList(w.sectoresText),
		},
		styleProfile,
		setupCompleted: true,
		setupPrompted: true,
	};
}

/** ¿Tiene el perfil de estilo algún dato? */
export function styleIsFilled(s: StyleProfile): boolean {
	return (
		[s.contextoBase, s.idiomaVariante, s.tratamiento, s.registro, s.cierre].some((v) => v.trim() !== "") ||
		s.terminos.length > 0
	);
}

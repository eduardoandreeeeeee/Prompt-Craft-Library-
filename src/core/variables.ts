/**
 * Variables de un prompt.
 *
 * Sintaxis: {{nombre}}, {{nombre|valor por defecto}} o {{nombre|valor por defecto|ayuda}}.
 *
 * Escape: una llave doble precedida de barra invertida, \{{Mensaje}}, no es una variable
 * del plugin; al copiar se entrega literalmente como {{Mensaje}}. Es necesario para
 * prompts de nodos de n8n, que usan la misma sintaxis para variables del flujo.
 */

export interface PromptVariable {
	name: string;
	defaultValue?: string;
	hint?: string;
}

export interface RenderResult {
	text: string;
	/** Variables sin valor ni valor por defecto; se dejan intactas en el texto. */
	missing: string[];
}

// Alternativa 1: llave doble escapada (grupo 1). Alternativa 2: variable (grupo 2).
const TOKEN = /\\(\{\{[\s\S]*?\}\})|\{\{([^{}]*)\}\}/g;

function parseInner(inner: string): PromptVariable | null {
	const parts = inner.split("|");
	const name = parts[0].trim();
	if (!name) return null;
	const defaultValue = parts.length > 1 ? parts[1].trim() || undefined : undefined;
	const hint = parts.length > 2 ? parts.slice(2).join("|").trim() || undefined : undefined;
	return { name, defaultValue, hint };
}

/** Variables únicas en orden de aparición. Ignora las escapadas. */
export function extractVariables(text: string): PromptVariable[] {
	const found = new Map<string, PromptVariable>();
	for (const match of text.matchAll(TOKEN)) {
		if (match[1] !== undefined) continue;
		const variable = parseInner(match[2]);
		if (!variable) continue;
		const previous = found.get(variable.name);
		if (!previous) {
			found.set(variable.name, variable);
		} else {
			previous.defaultValue ??= variable.defaultValue;
			previous.hint ??= variable.hint;
		}
	}
	return [...found.values()];
}

/** Reemplaza las variables por sus valores y desescapa las llaves literales. */
export function renderPrompt(text: string, values: Record<string, string>): RenderResult {
	const missing = new Set<string>();
	const rendered = text.replace(TOKEN, (whole, escaped: string | undefined, inner: string) => {
		if (escaped !== undefined) return escaped;
		const variable = parseInner(inner);
		if (!variable) return whole;
		const provided = values[variable.name];
		if (provided !== undefined && provided !== "") return provided;
		if (variable.defaultValue !== undefined) return variable.defaultValue;
		missing.add(variable.name);
		return whole;
	});
	return { text: rendered, missing: [...missing] };
}

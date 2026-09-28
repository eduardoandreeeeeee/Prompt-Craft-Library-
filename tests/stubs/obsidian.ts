// Sustituto mínimo del módulo «obsidian» para probar los servicios sin Obsidian.
import YAML from "yaml";

export const normalizePath = (p: string): string => p.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
export const parseYaml = (s: string): unknown => YAML.parse(s);
export const stringifyYaml = (v: unknown): string => YAML.stringify(v);
export class TFile {}

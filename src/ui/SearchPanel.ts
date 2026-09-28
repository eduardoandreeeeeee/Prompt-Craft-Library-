import { hueIndex } from "../core/hue";
import {
	FILTER_FIELDS,
	FilterField,
	SearchFilters,
	SearchItem,
	emptyFilters,
	facetOptions,
	hasActiveFilters,
	searchItems,
} from "../core/search";
import { labelFor, t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { loadSearchItems } from "../services/library";

export type SearchAction = "open" | "use";

const MAX_RESULTS = 50;
/** Cantidad de colores de la paleta del tema que se reparten entre los dominios. */
const DOMAIN_HUES = 6;

const FILTER_LABEL_KEYS = {
	dominio: "form.dominio",
	tecnica: "field.tecnica",
	tarea: "form.tarea",
	herramienta: "form.herramienta",
	sector: "form.sector",
	sensibilidad: "field.sensibilidad",
	estado: "field.estado",
} as const;

/** El dominio se muestra tal cual; el resto usa la etiqueta del vocabulario. */
const display = (field: FilterField, value: string): string =>
	field === "dominio" ? value : labelFor(field, value);

/**
 * Búsqueda por texto con filtros plegables. Se dibuja dentro de cualquier contenedor,
 * así que la usan tanto la ventana de búsqueda como el panel lateral.
 */
export class SearchPanel {
	private items: SearchItem[] = [];
	private results: SearchItem[] = [];
	private filters: SearchFilters = emptyFilters();
	private selected = 0;

	private inputEl!: HTMLInputElement;
	private toggleEl!: HTMLButtonElement;
	private filtersEl!: HTMLElement;
	private countEl!: HTMLElement;
	private listEl!: HTMLElement;
	private selects = new Map<FilterField, HTMLSelectElement>();

	constructor(
		private readonly container: HTMLElement,
		private readonly plugin: PromptCraftPlugin,
		/** Acción por defecto al elegir un resultado; el botón del resultado ofrece la otra. */
		private readonly mode: SearchAction,
		private readonly onActivate: (item: SearchItem, action: SearchAction) => void,
	) {}

	/** Dibuja la estructura y carga las notas. */
	async render(): Promise<void> {
		const c = this.container;
		c.addClass("prompt-craft-search");

		const bar = c.createDiv({ cls: "prompt-craft-searchbar" });
		this.inputEl = bar.createEl("input", {
			type: "search",
			placeholder: t("search.placeholder"),
			cls: "prompt-craft-search-input",
		});
		this.inputEl.addEventListener("input", () => {
			this.filters.query = this.inputEl.value;
			this.refresh();
		});
		this.inputEl.addEventListener("keydown", (event) => this.onKey(event));

		this.toggleEl = bar.createEl("button", { cls: "prompt-craft-filter-toggle" });
		this.toggleEl.hidden = true;
		this.toggleEl.addEventListener("click", () => {
			this.filtersEl.hidden = !this.filtersEl.hidden;
			this.updateToggle();
		});

		this.filtersEl = c.createDiv({ cls: "prompt-craft-filters" });
		this.filtersEl.hidden = true;
		this.countEl = c.createDiv({ cls: "prompt-craft-count" });
		this.listEl = c.createDiv({ cls: "prompt-craft-results" });

		await this.reload();
	}

	focus(): void {
		this.inputEl?.focus();
	}

	/** Vuelve a leer la biblioteca conservando el texto y los filtros elegidos. */
	async reload(): Promise<void> {
		this.items = await loadSearchItems(this.plugin.app, this.plugin.getPaths());
		this.buildFilters();
		this.refresh();
	}

	private activeFilterCount(): number {
		return FILTER_FIELDS.filter((f) => !!this.filters.values[f]).length;
	}

	private updateToggle(): void {
		const active = this.activeFilterCount();
		this.toggleEl.empty();
		this.toggleEl.createSpan({ text: t("search.filters") });
		if (active > 0) this.toggleEl.createSpan({ text: String(active), cls: "prompt-craft-filter-count" });
		this.toggleEl.setAttribute("aria-expanded", String(!this.filtersEl.hidden));
		this.toggleEl.toggleClass("is-active", active > 0 || !this.filtersEl.hidden);
	}

	private buildFilters(): void {
		this.filtersEl.empty();
		this.selects.clear();
		for (const field of FILTER_FIELDS) {
			const facets = facetOptions(this.items, field);
			if (facets.length === 0) {
				delete this.filters.values[field];
				continue;
			}

			const wrap = this.filtersEl.createDiv({ cls: "prompt-craft-filter" });
			wrap.createEl("label", { text: t(FILTER_LABEL_KEYS[field]) });
			const select = wrap.createEl("select", { cls: "dropdown" });
			select.createEl("option", { value: "", text: t("search.any") });
			for (const facet of facets) {
				select.createEl("option", {
					value: facet.value,
					text: `${display(field, facet.value)} (${facet.count})`,
				});
			}

			// Si el valor elegido ya no existe en la biblioteca, se quita el filtro.
			const current = this.filters.values[field] ?? "";
			if (current && !facets.some((f) => f.value === current)) delete this.filters.values[field];
			select.value = this.filters.values[field] ?? "";

			select.addEventListener("change", () => {
				this.filters.values[field] = select.value;
				this.refresh();
			});
			this.selects.set(field, select);
		}

		this.toggleEl.hidden = this.selects.size === 0;
		if (this.selects.size > 0) {
			const clear = this.filtersEl.createEl("button", { text: t("search.clear"), cls: "prompt-craft-clear" });
			clear.addEventListener("click", () => this.clearFilters());
		}
		this.updateToggle();
	}

	private clearFilters(): void {
		this.filters = emptyFilters();
		this.inputEl.value = "";
		for (const select of this.selects.values()) select.value = "";
		this.refresh();
		this.inputEl.focus();
	}

	private refresh(): void {
		this.results = searchItems(this.items, this.filters);
		this.selected = 0;
		this.updateToggle();
		this.renderResults();
	}

	private renderResults(): void {
		const { countEl, listEl } = this;
		listEl.empty();

		if (this.items.length === 0) {
			countEl.setText("");
			listEl.createEl("p", {
				text: t("search.emptyLibrary", { path: this.plugin.getPaths().prompts }),
				cls: "prompt-craft-empty",
			});
			return;
		}

		const shown = Math.min(this.results.length, MAX_RESULTS);
		countEl.setText(
			this.results.length > MAX_RESULTS
				? t("search.countLimited", { shown, total: this.results.length })
				: hasActiveFilters(this.filters)
					? t("search.count", { shown, total: this.items.length })
					: t("search.total", { total: this.items.length }),
		);

		if (this.results.length === 0) {
			listEl.createEl("p", { text: t("search.empty"), cls: "prompt-craft-empty" });
			return;
		}

		this.results.slice(0, MAX_RESULTS).forEach((item, index) => {
			const row = listEl.createDiv({ cls: "prompt-craft-result" });
			if (index === this.selected) row.addClass("is-selected");

			const head = row.createDiv({ cls: "prompt-craft-result-head" });
			head.createDiv({ text: item.title, cls: "prompt-craft-result-title" });
			if (item.sensibilidad && item.sensibilidad !== "general") {
				const flag = head.createSpan({ text: display("sensibilidad", item.sensibilidad), cls: "prompt-craft-flag" });
				flag.setAttribute("data-sensibilidad", item.sensibilidad);
			}
			const other: SearchAction = this.mode === "use" ? "open" : "use";
			const action = head.createEl("button", {
				text: other === "use" ? t("search.use") : t("search.open"),
				cls: "prompt-craft-result-action",
			});
			action.addEventListener("click", (event) => {
				event.stopPropagation();
				this.onActivate(item, other);
			});

			if (item.tareaQueResuelve) {
				row.createDiv({ text: item.tareaQueResuelve, cls: "prompt-craft-result-task" });
			}

			const meta = row.createDiv({ cls: "prompt-craft-result-meta" });
			if (item.dominio) {
				meta.createSpan({
					text: item.dominio,
					cls: `prompt-craft-chip prompt-craft-hue-${hueIndex(item.dominio, DOMAIN_HUES)}`,
				});
			}
			if (item.estado) {
				const state = meta.createSpan({ cls: "prompt-craft-state" });
				state.setAttribute("data-estado", item.estado);
				state.createSpan({ cls: "prompt-craft-dot" });
				state.appendText(display("estado", item.estado));
			}
			const rest = [
				...item.tecnica.map((v) => display("tecnica", v)),
				...item.herramienta.map((v) => display("herramienta", v)),
			];
			if (rest.length) meta.createSpan({ text: rest.join(" · ") });

			row.addEventListener("click", () => this.onActivate(item, this.mode));
			row.addEventListener("mousemove", () => this.select(index));
		});
	}

	private select(index: number): void {
		if (index === this.selected) return;
		this.selected = index;
		Array.from(this.listEl.children).forEach((row, i) => row.toggleClass("is-selected", i === index));
	}

	private onKey(event: KeyboardEvent): void {
		const last = Math.min(this.results.length, MAX_RESULTS) - 1;
		if (last < 0) return;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			this.select(Math.min(this.selected + 1, last));
			this.listEl.children[this.selected]?.scrollIntoView({ block: "nearest" });
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			this.select(Math.max(this.selected - 1, 0));
			this.listEl.children[this.selected]?.scrollIntoView({ block: "nearest" });
		} else if (event.key === "Enter") {
			event.preventDefault();
			const item = this.results[this.selected];
			if (item) this.onActivate(item, this.mode);
		}
	}
}

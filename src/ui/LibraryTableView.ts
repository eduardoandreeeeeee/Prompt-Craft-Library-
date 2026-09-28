import { ItemView, TFile, WorkspaceLeaf, debounce, setIcon } from "obsidian";
import { hueIndex } from "../core/hue";
import {
	FilterField,
	SearchFilters,
	SearchItem,
	emptyFilters,
	facetOptions,
	searchItems,
} from "../core/search";
import { SortState, TABLE_COLUMNS, TableColumn, nextSort, sortItems } from "../core/table";
import { getLocale, labelFor, t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { loadSearchItems } from "../services/library";
import { IterationModal } from "./IterationModal";

export const TABLE_VIEW_TYPE = "prompt-craft-table";

const DOMAIN_HUES = 6;
const FILTERS: { field: FilterField; label: "form.dominio" | "field.estado" | "field.tecnica" | "field.sensibilidad" }[] = [
	{ field: "dominio", label: "form.dominio" },
	{ field: "estado", label: "field.estado" },
	{ field: "tecnica", label: "field.tecnica" },
	{ field: "sensibilidad", label: "field.sensibilidad" },
];

const COLUMN_LABELS: Record<TableColumn, Parameters<typeof t>[0]> = {
	title: "field.titulo",
	dominio: "form.dominio",
	tecnica: "field.tecnica",
	herramienta: "form.herramienta",
	estado: "field.estado",
	sensibilidad: "field.sensibilidad",
	version: "table.col.version",
	iteraciones: "table.col.iteraciones",
	modificado: "table.col.modificado",
};

const display = (field: FilterField, value: string): string =>
	field === "dominio" ? value : labelFor(field, value);

/** Toda la biblioteca en una tabla que se puede ordenar por columna y filtrar. Se abre en una pestaña. */
export class LibraryTableView extends ItemView {
	private items: SearchItem[] = [];
	private filters: SearchFilters = emptyFilters();
	private sort: SortState = { key: "modificado", dir: "desc" };
	private toolbarEl!: HTMLElement;
	private bodyEl!: HTMLElement;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PromptCraftPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return TABLE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("table.title");
	}

	getIcon(): string {
		return "table";
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("prompt-craft-table-view");
		this.toolbarEl = root.createDiv({ cls: "prompt-craft-table-toolbar" });
		this.bodyEl = root.createDiv({ cls: "prompt-craft-table-body" });
		await this.reload();

		const reload = debounce(() => void this.reload(), 500, true);
		const inLibrary = (path: string) => path.startsWith(`${this.plugin.getPaths().prompts}/`);
		this.registerEvent(this.app.metadataCache.on("changed", (file) => inLibrary(file.path) && reload()));
		this.registerEvent(this.app.vault.on("delete", (file) => inLibrary(file.path) && reload()));
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => (inLibrary(file.path) || inLibrary(oldPath)) && reload()),
		);
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	/** Aplica un filtro desde fuera (por ejemplo, desde el inicio); sin argumentos quita todos. */
	setFilter(field?: FilterField, value?: string): void {
		this.filters = emptyFilters();
		if (field && value) this.filters.values[field] = value;
		if (this.toolbarEl) {
			this.renderToolbar();
			this.renderTable();
		}
	}

	async reload(): Promise<void> {
		this.items = await loadSearchItems(this.app, this.plugin.getPaths());
		this.renderToolbar();
		this.renderTable();
	}

	private renderToolbar(): void {
		const bar = this.toolbarEl;
		bar.empty();

		const home = bar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("action.home") } });
		setIcon(home, "layout-dashboard");
		home.addEventListener("click", () => void this.plugin.activateHome());

		const input = bar.createEl("input", {
			type: "search",
			placeholder: t("search.placeholder"),
			cls: "prompt-craft-search-input",
		});
		input.value = this.filters.query;
		input.addEventListener("input", () => {
			this.filters.query = input.value;
			this.renderTable();
		});

		for (const { field, label } of FILTERS) {
			const options = facetOptions(this.items, field);
			if (options.length === 0) continue;
			const select = bar.createEl("select", { cls: "dropdown", attr: { "aria-label": t(label) } });
			select.createEl("option", { value: "", text: `${t(label)}: ${t("search.any")}` });
			for (const o of options) {
				select.createEl("option", { value: o.value, text: `${display(field, o.value)} (${o.count})` });
			}
			select.value = this.filters.values[field] ?? "";
			select.addEventListener("change", () => {
				this.filters.values[field] = select.value;
				this.renderTable();
			});
		}

		const refresh = bar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("panel.refresh") } });
		setIcon(refresh, "refresh-cw");
		refresh.addEventListener("click", () => void this.reload());
	}

	private renderTable(): void {
		const body = this.bodyEl;
		body.empty();

		if (this.items.length === 0) {
			body.createEl("p", { text: t("search.emptyLibrary"), cls: "prompt-craft-muted" });
			return;
		}
		const rows = sortItems(searchItems(this.items, this.filters), this.sort);
		body.createEl("p", { text: t("table.count", { shown: rows.length, total: this.items.length }), cls: "prompt-craft-muted" });
		if (rows.length === 0) {
			body.createEl("p", { text: t("search.empty"), cls: "prompt-craft-muted" });
			return;
		}

		const wrap = body.createDiv({ cls: "prompt-craft-table-wrap" });
		const table = wrap.createEl("table", { cls: "prompt-craft-table" });
		const headRow = table.createEl("thead").createEl("tr");
		for (const column of TABLE_COLUMNS) {
			const th = headRow.createEl("th", { cls: "is-sortable" });
			th.setText(t(COLUMN_LABELS[column]));
			if (this.sort.key === column) {
				th.addClass("is-sorted");
				th.createSpan({ text: this.sort.dir === "asc" ? " ▲" : " ▼", cls: "prompt-craft-sort-mark" });
			}
			th.addEventListener("click", () => {
				this.sort = nextSort(this.sort, column);
				this.renderTable();
			});
		}
		headRow.createEl("th");

		const tbody = table.createEl("tbody");
		for (const item of rows) this.renderRow(tbody, item);
	}

	private renderRow(tbody: HTMLElement, item: SearchItem): void {
		const tr = tbody.createEl("tr");

		const title = tr.createEl("td", { cls: "prompt-craft-table-title" });
		const link = title.createEl("a", { text: item.title });
		link.addEventListener("click", (event) => {
			event.preventDefault();
			void this.plugin.activateItem(item.path, "open");
		});
		if (item.tareaQueResuelve) title.createDiv({ text: item.tareaQueResuelve, cls: "prompt-craft-result-task" });

		const dominio = tr.createEl("td");
		if (item.dominio) {
			dominio.createSpan({
				text: item.dominio,
				cls: `prompt-craft-chip prompt-craft-hue-${hueIndex(item.dominio, DOMAIN_HUES)}`,
			});
		}
		tr.createEl("td", { text: item.tecnica.map((v) => display("tecnica", v)).join(", ") });
		tr.createEl("td", { text: item.herramienta.map((v) => display("herramienta", v)).join(", ") });

		const estado = tr.createEl("td");
		if (item.estado) {
			const state = estado.createSpan({ cls: "prompt-craft-state" });
			state.setAttribute("data-estado", item.estado);
			state.createSpan({ cls: "prompt-craft-dot" });
			state.appendText(display("estado", item.estado));
		}

		const sens = tr.createEl("td");
		if (item.sensibilidad && item.sensibilidad !== "general") {
			sens.createSpan({ text: display("sensibilidad", item.sensibilidad), cls: "prompt-craft-flag" }).setAttribute(
				"data-sensibilidad",
				item.sensibilidad,
			);
		}

		tr.createEl("td", { text: `v${item.version}`, cls: "prompt-craft-num" });
		tr.createEl("td", { text: String(item.iteraciones), cls: "prompt-craft-num" });
		tr.createEl("td", {
			text: item.modificado ? new Date(item.modificado).toLocaleDateString(getLocale()) : "",
			cls: "prompt-craft-num",
		});

		const actions = tr.createEl("td", { cls: "prompt-craft-table-actions" });
		const use = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("search.use") } });
		setIcon(use, "wand-sparkles");
		use.addEventListener("click", () => void this.plugin.activateItem(item.path, "use"));
		const iterate = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("cmd.recordIteration") } });
		setIcon(iterate, "rotate-cw");
		iterate.addEventListener("click", () => {
			const file = this.app.vault.getAbstractFileByPath(item.path);
			if (file instanceof TFile) new IterationModal(this.app, this.plugin, file, () => void this.reload()).open();
		});
	}
}

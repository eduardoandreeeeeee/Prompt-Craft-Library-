import { ItemView, WorkspaceLeaf, debounce, setIcon } from "obsidian";
import { t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { SearchPanel } from "./SearchPanel";

export const VIEW_TYPE = "prompt-craft-view";

/** Panel lateral fijo con la búsqueda de la biblioteca y acceso a nueva nota. */
export class PromptCraftView extends ItemView {
	private panel: SearchPanel | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PromptCraftPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("ribbon.tooltip");
	}

	getIcon(): string {
		return "library";
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("prompt-craft-panel");

		const actions = root.createDiv({ cls: "prompt-craft-panel-actions" });
		const home = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("action.home") } });
		setIcon(home, "layout-dashboard");
		home.addEventListener("click", () => void this.plugin.activateHome());

		const add = actions.createEl("button", { cls: "mod-cta" });
		setIcon(add.createSpan(), "file-plus");
		add.createSpan({ text: t("panel.newNote") });
		add.addEventListener("click", () => this.plugin.openNewPromptForm());

		const refresh = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("panel.refresh") } });
		setIcon(refresh, "refresh-cw");
		refresh.addEventListener("click", () => void this.panel?.reload());

		const body = root.createDiv();
		this.panel = new SearchPanel(body, this.plugin, "open", (item, action) => {
			void this.plugin.activateItem(item.path, action);
		});
		await this.panel.render();

		// Mantiene la lista al día cuando cambian las notas de la biblioteca.
		const reload = debounce(() => void this.panel?.reload(), 500, true);
		const inLibrary = (path: string) => path.startsWith(`${this.plugin.getPaths().prompts}/`);
		this.registerEvent(this.app.metadataCache.on("changed", (file) => inLibrary(file.path) && reload()));
		this.registerEvent(this.app.vault.on("delete", (file) => inLibrary(file.path) && reload()));
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => (inLibrary(file.path) || inLibrary(oldPath)) && reload()),
		);
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
		this.panel = null;
	}
}

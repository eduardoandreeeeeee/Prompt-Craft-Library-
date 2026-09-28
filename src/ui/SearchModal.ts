import { App, Modal } from "obsidian";
import { t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { SearchAction, SearchPanel } from "./SearchPanel";

/** Ventana de búsqueda: envuelve el panel de búsqueda en un diálogo. */
export class SearchModal extends Modal {
	private panel: SearchPanel | null = null;

	constructor(
		app: App,
		private readonly plugin: PromptCraftPlugin,
		/** «open» abre la nota; «use» abre el constructor para completar y copiar el prompt. */
		private readonly mode: SearchAction = "open",
	) {
		super(app);
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass("prompt-craft-search-modal");
		this.titleEl.setText(this.mode === "use" ? t("search.titleUse") : t("search.title"));
		this.contentEl.empty();

		this.panel = new SearchPanel(this.contentEl, this.plugin, this.mode, (item, action) => {
			void this.plugin.activateItem(item.path, action);
			this.close();
		});
		this.panel.focus();
		await this.panel.render();
		this.panel.focus();
	}

	onClose(): void {
		this.modalEl.removeClass("prompt-craft-search-modal");
		this.contentEl.empty();
		this.panel = null;
	}
}

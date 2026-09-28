import { App, Modal, Setting } from "obsidian";
import { BlockNote } from "../core/blocks";
import { normalizeText } from "../core/search";
import { t } from "../i18n";

/** Elige varios bloques de una lista con búsqueda; sirve aunque haya muchos. */
export class BlockPickerModal extends Modal {
	private readonly selected: Set<string>;
	private query = "";
	private listEl!: HTMLElement;

	constructor(
		app: App,
		private readonly blocks: BlockNote[],
		selected: string[],
		private readonly onDone: (ids: string[]) => void,
	) {
		super(app);
		this.selected = new Set(selected);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText(t("picker.title"));

		new Setting(contentEl).setName(t("picker.search")).addSearch((search) =>
			search.setPlaceholder(t("picker.search.placeholder")).onChange((v) => {
				this.query = v;
				this.renderList();
			}),
		);
		this.listEl = contentEl.createDiv({ cls: "prompt-craft-picker-list" });
		this.renderList();

		new Setting(contentEl)
			.addButton((b) => b.setButtonText(t("form.cancel")).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(t("picker.done"))
					.setCta()
					.onClick(() => {
						this.onDone(this.blocks.filter((x) => this.selected.has(x.id)).map((x) => x.id));
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderList(): void {
		this.listEl.empty();
		const q = normalizeText(this.query.trim());
		const shown = this.blocks.filter((b) => !q || normalizeText(`${b.title} ${b.id} ${b.text}`).includes(q));
		if (shown.length === 0) {
			this.listEl.createEl("p", { text: t("picker.empty"), cls: "prompt-craft-muted" });
			return;
		}
		for (const block of shown) {
			const label = this.listEl.createEl("label", { cls: "prompt-craft-picker-item" });
			const input = label.createEl("input", { type: "checkbox" });
			input.checked = this.selected.has(block.id);
			input.addEventListener("change", () => {
				if (input.checked) this.selected.add(block.id);
				else this.selected.delete(block.id);
			});
			const text = label.createDiv();
			text.createDiv({ text: block.title });
			text.createDiv({ text: block.text.length > 110 ? `${block.text.slice(0, 110)}…` : block.text, cls: "prompt-craft-muted prompt-craft-picker-preview" });
		}
	}
}

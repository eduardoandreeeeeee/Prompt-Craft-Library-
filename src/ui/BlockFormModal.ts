import { App, Modal, Notice, Setting } from "obsidian";
import { slugify } from "../core/blocks";
import { noteFileName } from "../core/note";
import { ESQUEMA_ACTUAL } from "../core/schema";
import { t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { createNoteWith, loadBlocks } from "../services/library";

/** Crea un bloque reutilizable: un fragmento de texto que se agrega a los prompts que lo usan. */
export class BlockFormModal extends Modal {
	private titulo = "";
	private id = "";
	private idTouched = false;
	private texto = "";
	private idInput: HTMLInputElement | null = null;

	constructor(
		app: App,
		private readonly plugin: PromptCraftPlugin,
		/** Recibe el identificador del bloque creado. */
		private readonly onDone?: (id: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText(t("block.form.title"));
		contentEl.createEl("p", { text: t("block.form.intro"), cls: "prompt-craft-muted" });

		new Setting(contentEl).setName(t("field.titulo")).addText((text) =>
			text.setPlaceholder(t("block.form.placeholder")).onChange((v) => {
				this.titulo = v;
				if (!this.idTouched) {
					this.id = slugify(v);
					if (this.idInput) this.idInput.value = this.id;
				}
			}),
		);
		new Setting(contentEl)
			.setName(t("block.form.id"))
			.setDesc(t("block.form.id.desc"))
			.addText((text) => {
				this.idInput = text.inputEl;
				text.onChange((v) => {
					this.id = slugify(v);
					this.idTouched = true;
				});
			});
		const setting = new Setting(contentEl).setName(t("block.form.text")).setDesc(t("block.form.text.desc"));
		setting.settingEl.addClass("prompt-craft-stacked");
		setting.addTextArea((area) => {
			area.inputEl.rows = 6;
			area.onChange((v) => (this.texto = v));
		});

		new Setting(contentEl)
			.addButton((b) => b.setButtonText(t("form.cancel")).onClick(() => this.close()))
			.addButton((b) => b.setButtonText(t("form.save")).setCta().onClick(() => void this.save()));
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async save(): Promise<void> {
		const titulo = this.titulo.trim();
		const id = this.id || slugify(titulo);
		if (!titulo || !id || !this.texto.trim()) {
			new Notice(t("block.form.needs"));
			return;
		}
		const paths = this.plugin.getPaths();
		if ((await loadBlocks(this.app, paths)).some((b) => b.id === id)) {
			new Notice(t("block.form.exists", { id }));
			return;
		}
		try {
			const file = await createNoteWith(
				this.app,
				paths.blocks,
				noteFileName(titulo),
				{ esquema: ESQUEMA_ACTUAL, tipo: "bloque", titulo, bloque_id: id, origen: "propio" },
				`# ${titulo}\n\n${this.texto.trim()}\n`,
			);
			new Notice(t("notice.noteCreated", { path: file.path }));
			this.onDone?.(id);
			this.close();
		} catch (error) {
			console.error("[prompt-craft-library] no se pudo crear el bloque", error);
			new Notice(t("notice.noteError"));
		}
	}
}

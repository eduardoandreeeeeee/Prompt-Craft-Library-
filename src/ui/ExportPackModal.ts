import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { baseName } from "../core/library";
import { labelFor, t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { dependenciesOf, exportPack, exportableFiles } from "../services/packs";

const today = (): string => new Date().toISOString().slice(0, 10);

/** Reúne notas elegidas (más los bloques y ejemplos que usan) en un paquete que se puede compartir. */
export class ExportPackModal extends Modal {
	private files: TFile[] = [];
	private readonly selected = new Set<string>();
	private nombre = "";
	private descripcion = "";
	private countEl!: HTMLElement;

	constructor(
		app: App,
		private readonly plugin: PromptCraftPlugin,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText(t("export.title"));
		this.files = exportableFiles(this.app, this.plugin.getPaths());
		contentEl.addClass("prompt-craft-export");

		if (this.files.length === 0) {
			contentEl.createEl("p", { text: t("export.empty"), cls: "prompt-craft-muted" });
			return;
		}
		contentEl.createEl("p", { text: t("export.intro"), cls: "prompt-craft-muted" });

		new Setting(contentEl).setName(t("export.name")).addText((text) =>
			text.setPlaceholder(t("export.name.placeholder")).onChange((v) => (this.nombre = v)),
		);
		new Setting(contentEl).setName(t("export.description")).addText((text) => text.onChange((v) => (this.descripcion = v)));

		const tools = new Setting(contentEl).setName(t("export.notes"));
		tools.addButton((b) => b.setButtonText(t("export.all")).onClick(() => this.setAll(true)));
		tools.addButton((b) => b.setButtonText(t("export.none")).onClick(() => this.setAll(false)));

		const list = contentEl.createDiv({ cls: "prompt-craft-export-list" });
		for (const file of this.files) {
			const tipo = String(this.app.metadataCache.getFileCache(file)?.frontmatter?.tipo ?? "");
			const label = list.createEl("label", { cls: "prompt-craft-check" });
			const input = label.createEl("input", { type: "checkbox" });
			input.dataset.path = file.path;
			input.addEventListener("change", () => {
				if (input.checked) this.selected.add(file.path);
				else this.selected.delete(file.path);
				this.updateCount();
			});
			label.createSpan({ text: baseName(file.path) });
			label.createSpan({ text: labelFor("tipo", tipo), cls: "prompt-craft-muted" });
		}

		this.countEl = contentEl.createEl("p", { cls: "prompt-craft-muted" });
		this.updateCount();

		new Setting(contentEl)
			.addButton((b) => b.setButtonText(t("form.cancel")).onClick(() => this.close()))
			.addButton((b) => b.setButtonText(t("export.button")).setCta().onClick(() => void this.export()));
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private setAll(on: boolean): void {
		this.selected.clear();
		if (on) for (const f of this.files) this.selected.add(f.path);
		this.contentEl.querySelectorAll<HTMLInputElement>("input[type=checkbox][data-path]").forEach((i) => (i.checked = on));
		this.updateCount();
	}

	private updateCount(): void {
		this.countEl.setText(t("export.selected", { count: this.selected.size }));
	}

	private async export(): Promise<void> {
		const nombre = this.nombre.trim();
		if (!nombre) {
			new Notice(t("export.needsName"));
			return;
		}
		const chosen = this.files.filter((f) => this.selected.has(f.path));
		if (chosen.length === 0) {
			new Notice(t("export.needsNotes"));
			return;
		}
		try {
			const paths = this.plugin.getPaths();
			const extra = await dependenciesOf(this.app, paths, chosen);
			const file = await exportPack(this.app, paths, [...chosen, ...extra], {
				nombre,
				descripcion: this.descripcion,
				creado: today(),
			});
			new Notice(t("export.done", { count: chosen.length + extra.length, path: file.path }), 8000);
			this.close();
		} catch (error) {
			console.error("[prompt-craft-library] no se pudo exportar el paquete", error);
			new Notice(t("export.error"));
		}
	}
}

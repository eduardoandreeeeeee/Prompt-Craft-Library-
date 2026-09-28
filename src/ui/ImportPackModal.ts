import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { InstallStrategy, PlanItem, folderForNote, planInstall, summarize } from "../core/install";
import { baseName } from "../core/library";
import type { PackResult } from "../core/pack";
import { labelFor, t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { packFiles, readPack } from "../services/packs";

/** Elige un paquete de la bóveda, muestra qué se instalaría y lo instala. */
export class ImportPackModal extends Modal {
	private files: TFile[] = [];
	private current: TFile | null = null;
	private pack: PackResult | null = null;
	private strategy: InstallStrategy = "skip";
	private detailEl!: HTMLElement;

	constructor(
		app: App,
		private readonly plugin: PromptCraftPlugin,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText(t("import.title"));
		contentEl.addClass("prompt-craft-import");
		const paths = this.plugin.getPaths();
		this.files = packFiles(this.app, paths);

		if (this.files.length === 0) {
			contentEl.createEl("p", { text: t("import.none", { folder: paths.packs }), cls: "prompt-craft-muted" });
			return;
		}
		contentEl.createEl("p", { text: t("import.intro", { folder: paths.packs }), cls: "prompt-craft-muted" });

		new Setting(contentEl).setName(t("import.file")).addDropdown((dd) => {
			for (const file of this.files) dd.addOption(file.path, baseName(file.path));
			dd.onChange((path) => void this.choose(path));
			this.current = this.files[0];
		});
		new Setting(contentEl)
			.setName(t("import.strategy"))
			.setDesc(t("import.strategy.desc"))
			.addDropdown((dd) => {
				dd.addOption("skip", t("import.strategy.skip"));
				dd.addOption("duplicate", t("import.strategy.duplicate"));
				dd.setValue(this.strategy).onChange((v) => {
					this.strategy = v as InstallStrategy;
					this.renderDetail();
				});
			});
		this.detailEl = contentEl.createDiv({ cls: "prompt-craft-import-detail" });
		void this.choose(this.files[0].path);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async choose(path: string): Promise<void> {
		const file = this.files.find((f) => f.path === path) ?? null;
		this.current = file;
		this.pack = file ? await readPack(this.app, file) : null;
		this.renderDetail();
	}

	private plan(): PlanItem[] {
		if (!this.pack?.ok) return [];
		const paths = this.plugin.getPaths();
		return planInstall(
			this.pack.notes,
			(note) => folderForNote(note, paths),
			(p) => this.app.vault.getAbstractFileByPath(p) !== null,
			this.strategy,
		);
	}

	private renderDetail(): void {
		const el = this.detailEl;
		el.empty();
		const pack = this.pack;
		if (!pack) return;
		if (!pack.ok) {
			el.createEl("p", { text: t(`import.error.${pack.error}`), cls: "prompt-craft-warning is-sensitive" });
			return;
		}

		el.createEl("h3", { text: pack.info.nombre || (this.current ? baseName(this.current.path) : ""), cls: "prompt-craft-wizard-heading" });
		if (pack.info.descripcion) el.createEl("p", { text: pack.info.descripcion });

		const plan = this.plan();
		const summary = summarize(plan);
		el.createEl("p", {
			text: t("import.summary", { create: summary.create, skipped: summary.skipped, unsupported: summary.unsupported }),
			cls: "prompt-craft-muted",
		});

		const list = el.createEl("ul", { cls: "prompt-craft-import-list" });
		for (const item of plan) {
			const li = list.createEl("li");
			li.createSpan({ text: item.note.titulo || "?" });
			li.createSpan({ text: ` (${labelFor("tipo", item.note.tipo) || "?"})`, cls: "prompt-craft-muted" });
			const status = li.createSpan({ text: ` ${t(`import.status.${item.skip ? (item.status === "unsupported" ? "unsupported" : "skipped") : item.status === "exists" ? "duplicate" : "new"}`)}`, cls: "prompt-craft-import-status" });
			status.dataset.status = item.skip ? "skipped" : item.status;
		}

		new Setting(el)
			.addButton((b) => b.setButtonText(t("form.cancel")).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(t("import.button"))
					.setCta()
					.setDisabled(summary.create === 0)
					.onClick(() => void this.install(plan)),
			);
	}

	private async install(plan: PlanItem[]): Promise<void> {
		try {
			const created = await this.plugin.installPlan(plan);
			new Notice(t("import.done", { count: created }));
			this.close();
		} catch (error) {
			console.error("[prompt-craft-library] no se pudo instalar el paquete", error);
			new Notice(t("import.error"));
		}
	}
}


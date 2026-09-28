import { App, Modal, Notice, Setting } from "obsidian";
import { EXAMPLES_MAX, EXAMPLES_MIN, Example, buildExamplesBody, validateExamples } from "../core/examples";
import { noteFileName } from "../core/note";
import { ESQUEMA_ACTUAL } from "../core/schema";
import { t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { createNoteWith } from "../services/library";

/** Crea un banco de ejemplos para prompts few-shot: entre 2 y 5 pares de entrada y salida. */
export class ExamplesFormModal extends Modal {
	private titulo = "";
	private tarea = "";
	private examples: Example[] = Array.from({ length: EXAMPLES_MIN }, () => ({ input: "", output: "" }));
	private issuesEl!: HTMLElement;

	constructor(
		app: App,
		private readonly plugin: PromptCraftPlugin,
		private readonly onDone?: (linkName: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(t("examples.form.title"));
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("prompt-craft-form");
		contentEl.createEl("p", { text: t("examples.form.intro"), cls: "prompt-craft-muted" });

		new Setting(contentEl).setName(t("field.titulo")).addText((text) =>
			text
				.setPlaceholder(t("examples.form.placeholder"))
				.setValue(this.titulo)
				.onChange((v) => (this.titulo = v)),
		);
		new Setting(contentEl)
			.setName(t("field.tarea_que_resuelve"))
			.addText((text) => text.setValue(this.tarea).onChange((v) => (this.tarea = v)));

		this.examples.forEach((example, index) => {
			const head = new Setting(contentEl).setName(`${t("example.heading")} ${index + 1}`).setHeading();
			if (this.examples.length > EXAMPLES_MIN) {
				head.addExtraButton((b) =>
					b
						.setIcon("trash")
						.setTooltip(t("examples.form.remove"))
						.onClick(() => {
							this.examples.splice(index, 1);
							this.render();
						}),
				);
			}
			this.area(t("example.input"), example.input, 3, (v) => (example.input = v));
			this.area(t("example.output"), example.output, 3, (v) => (example.output = v));
		});

		if (this.examples.length < EXAMPLES_MAX) {
			new Setting(contentEl).addButton((b) =>
				b.setButtonText(t("examples.form.add")).onClick(() => {
					this.examples.push({ input: "", output: "" });
					this.render();
				}),
			);
		}

		this.issuesEl = contentEl.createDiv({ cls: "prompt-craft-issues-box" });
		new Setting(contentEl)
			.addButton((b) => b.setButtonText(t("form.cancel")).onClick(() => this.close()))
			.addButton((b) => b.setButtonText(t("form.save")).setCta().onClick(() => void this.save()));
	}

	private area(name: string, value: string, rows: number, onChange: (v: string) => void): void {
		const setting = new Setting(this.contentEl).setName(name);
		setting.settingEl.addClass("prompt-craft-stacked");
		setting.addTextArea((area) => {
			area.inputEl.rows = rows;
			area.setValue(value).onChange(onChange);
		});
	}

	private async save(): Promise<void> {
		const messages: string[] = [];
		if (!this.titulo.trim()) messages.push(t("issue.missing-required", { field: t("field.titulo") }));
		const issues = validateExamples(this.examples);
		if (issues.includes("count")) messages.push(t("examples.issue.count", { min: EXAMPLES_MIN, max: EXAMPLES_MAX }));
		if (issues.includes("empty")) messages.push(t("examples.issue.empty"));

		this.issuesEl.empty();
		if (messages.length) {
			this.issuesEl.createEl("p", { text: t("form.issues.heading"), cls: "prompt-craft-issues-heading" });
			const list = this.issuesEl.createEl("ul", { cls: "prompt-craft-issues" });
			for (const m of messages) list.createEl("li", { text: m });
			return;
		}
		try {
			const titulo = this.titulo.trim();
			const file = await createNoteWith(
				this.app,
				this.plugin.getPaths().examples,
				noteFileName(titulo),
				{
					esquema: ESQUEMA_ACTUAL,
					tipo: "ejemplos",
					titulo,
					...(this.tarea.trim() ? { tarea_que_resuelve: this.tarea.trim() } : {}),
					origen: "propio",
				},
				buildExamplesBody(this.examples),
			);
			new Notice(t("notice.noteCreated", { path: file.path }));
			this.onDone?.(file.basename);
			this.close();
		} catch (error) {
			console.error("[prompt-craft-library] no se pudo crear el banco de ejemplos", error);
			new Notice(t("notice.noteError"));
		}
	}
}

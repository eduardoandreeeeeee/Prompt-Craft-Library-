import { App, Modal, Setting } from "obsidian";
import { formatIssue } from "../core/issues";
import type { NoteResult } from "../core/library";
import { t } from "../i18n";

export interface ValidationModalOptions {
	/** Se define para el informe de toda la biblioteca; en una sola nota se omite. */
	libraryPath?: string;
	onOpenNote?: (path: string) => void;
}

/** Muestra el resultado de validar una nota o la biblioteca completa. */
export class ValidationModal extends Modal {
	constructor(
		app: App,
		private readonly results: NoteResult[],
		private readonly options: ValidationModalOptions = {},
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText(t("validate.title"));
		contentEl.empty();

		const failing = this.results.filter((r) => r.issues.length > 0);

		if (this.options.libraryPath !== undefined) {
			if (this.results.length === 0) {
				contentEl.createEl("p", { text: t("validate.libraryEmpty", { path: this.options.libraryPath }) });
			} else {
				contentEl.createEl("p", {
					text: t("validate.librarySummary", {
						valid: this.results.length - failing.length,
						total: this.results.length,
					}),
				});
			}
		} else if (failing.length === 0 && this.results.length === 1) {
			contentEl.createEl("p", { text: t("validate.noteOk", { name: this.results[0].name }), cls: "prompt-craft-ok" });
		}

		for (const result of failing) {
			const heading = contentEl.createEl("p", { cls: "prompt-craft-note-heading" });
			if (this.options.onOpenNote) {
				const link = heading.createEl("a", { text: result.name, href: "#" });
				link.addEventListener("click", (event) => {
					event.preventDefault();
					this.options.onOpenNote?.(result.path);
					this.close();
				});
				heading.appendText(":");
			} else {
				heading.setText(t("validate.noteIssues", { name: result.name }));
			}
			const list = contentEl.createEl("ul", { cls: "prompt-craft-issues" });
			for (const issue of result.issues) list.createEl("li", { text: formatIssue(issue) });
		}

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText(t("validate.close"))
				.setCta()
				.onClick(() => this.close()),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

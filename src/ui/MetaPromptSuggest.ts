import { App, FuzzySuggestModal } from "obsidian";
import type { LibraryEntry } from "../core/library";
import { t } from "../i18n";

/** Lista de meta-prompts para elegir uno. */
export class MetaPromptSuggest extends FuzzySuggestModal<LibraryEntry> {
	constructor(
		app: App,
		private readonly entries: LibraryEntry[],
		private readonly onChoose: (entry: LibraryEntry) => void,
	) {
		super(app);
		this.setPlaceholder(t("meta.pick"));
	}

	getItems(): LibraryEntry[] {
		return this.entries;
	}

	getItemText(entry: LibraryEntry): string {
		return entry.title;
	}

	onChooseItem(entry: LibraryEntry): void {
		this.onChoose(entry);
	}
}

import { App, Modal } from "obsidian";

/** Obsidian-native confirmation; Esc/close is always cancellation. */
export function confirmAction(app: App, title: string, description: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    class Confirmation extends Modal {
      private decided = false;
      onOpen(): void {
        this.contentEl.createEl("h2", { text: title });
        this.contentEl.createEl("p", { text: description });
        const actions = this.contentEl.createDiv({ cls: "yh-modal-footer" });
        const cancel = actions.createEl("button", { text: cancelLabel });
        cancel.addEventListener("click", () => this.close());
        const confirm = actions.createEl("button", { text: confirmLabel, cls: "mod-warning" });
        confirm.addEventListener("click", () => { this.decided = true; resolve(true); this.close(); });
        cancel.focus();
      }
      onClose(): void { if (!this.decided) resolve(false); this.contentEl.empty(); }
    }
    new Confirmation(app).open();
  });
}

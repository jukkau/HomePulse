// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";

const { Setting } = require("obsidian");

export const focusWidget = {
  type: "focus",
  displayName: "Focus",
  shell: "text",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H1", w: 1, h: 1 },
  defaultConfig: { title: "today's goal", placeholder: "define your focus..." },
  defaultState: { text: "" },
  async render(container, api) {
    const text = container.createEl("div", {
      cls: "yh-focus-text",
      attr: { contenteditable: "true", spellcheck: "false", "data-placeholder": api.widgetData.config.placeholder || "" }
    });
    text.setText(api.widgetData.state.text || "");
    text.addEventListener("blur", async () => {
      await api.saveState({ text: text.textContent.trim() }, false);
    });
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Placeholder").addText((text) => {
      text.setValue(draft.placeholder || "");
      text.onChange((value) => {
        draft.placeholder = value;
      });
    });
  }
};

// Build + run offline Step 9 smoke checks against real data.json.
import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outFile = path.join(__dirname, ".smoke-bundle.cjs");

await esbuild.build({
  entryPoints: [path.join(__dirname, "smoke-entry.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: outFile,
  external: ["obsidian"],
  logLevel: "silent",
  target: "es2022"
});

// Mock Obsidian before loading the bundle (widgets import Setting/Notice/etc).
const require = createRequire(import.meta.url);
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") {
    return {
      Modal: class Modal {
        constructor(app) { this.app = app; }
        open() {}
        close() {}
      },
      Setting: class Setting {
        setName() { return this; }
        setDesc() { return this; }
        addText(cb) { cb({ setValue() { return this; }, onChange() { return this; } }); return this; }
        addTextArea(cb) { cb({ setValue() { return this; }, onChange() { return this; } }); return this; }
      },
      Notice: class Notice {},
      MarkdownRenderer: { renderMarkdown: async () => {} },
      normalizePath: (p) => String(p || "").replace(/\\/g, "/")
    };
  }
  return originalLoad.apply(this, arguments);
};

try {
  require(outFile);
} finally {
  Module._load = originalLoad;
  try { fs.unlinkSync(outFile); } catch (_) {}
}

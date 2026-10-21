// Compile regression checks in memory; no access to or writes to the user's vault.
import esbuild from "esbuild";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await esbuild.build({ entryPoints: [path.join(root, "scripts/quality-entry.ts")], bundle: true,
  platform: "node", format: "cjs", write: false, external: ["obsidian"], logLevel: "silent" });
const originalLoad = Module._load;
const notices = [];
class Element {
  constructor(options = {}) { this.children = []; this.listeners = {}; this.attributes = { ...options.attr }; this.textContent = options.text || ""; this.value = options.value || ""; this.style = { setProperty() {} }; this.disabled = false; this.scrollTop = 0; this.scrollLeft = 0; this.dataset = {}; this.clientWidth = 1200; this.isConnected = true; }
  createEl(tag, options = {}) { const child = new Element(options); child.tag = tag; child.parent = this; child.cls = options.cls; this.children.push(child); return child; }
  createDiv(options = {}) { return this.createEl("div", options); }
  createSpan(options = {}) { return this.createEl("span", options); }
  setText(text) { this.textContent = text; }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key]; }
  setAttr(key, value) { this.setAttribute(key, value); }
  addEventListener(key, listener) { (this.listeners[key] ||= []).push(listener); }
  async click() { for (const listener of this.listeners.click || []) await listener({ stopPropagation() {} }); }
  empty() { this.children = []; }
  addClass(...names) { this.cls = [...new Set([...(this.cls || "").split(" "), ...names])].join(" "); }
  removeClass() {} toggleClass() {} focus() { globalThis.document.activeElement = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); this.isConnected = false; }
  get childNodes() { return this.children; }
  hasAttribute(key) { return key in this.attributes; }
  removeAttribute(key) { delete this.attributes[key]; }
  contains(el) { return this === el || this.children.some((child) => child.contains(el)); }
  replaceChildren(...children) { this.children = children; for (const child of children) child.parent = this; }
  querySelectorAll(selector) {
    const all = this.children.flatMap((child) => [child, ...child.querySelectorAll("*")]);
    if (selector === "*") return all;
    if (selector.startsWith(".")) return all.filter((child) => (child.cls || "").split(" ").includes(selector.slice(1)));
    return all.filter((child) => child.tag === selector);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
class Modal {
  constructor(app) { this.app = app; this.contentEl = new Element(); this.modalEl = new Element(); }
  open() { globalThis.__quality.modals.push(this); this.onOpen?.(); }
  close() { this.onClose?.(); }
}
globalThis.document = { activeElement: null, createElement: (tag) => { const el = new Element(); el.tag = tag; return el; } };
globalThis.window = { innerWidth: 1200, addEventListener() {}, removeEventListener() {}, setInterval: () => 1, clearInterval() {}, setTimeout, clearTimeout };
globalThis.__quality = { Element, notices, modals: [] };
Module._load = function(request, ...args) {
  if (request === "obsidian") return { Platform: { isDesktop: true }, Modal, Component: class { unload() {} }, Plugin: class {}, ItemView: class { constructor(leaf) { this.app = leaf.app; this.contentEl = new Element(); } addChild(child) { return child; } removeChild(child) { child.unload(); } }, PluginSettingTab: class {},
    FuzzySuggestModal: class extends Modal {}, Setting: class {}, Notice: class { constructor(text) { notices.push(text); } },
    setIcon: (element, icon) => { element.icon = icon; }, normalizePath: (value) => String(value).replace(/\\/g, "/") };
  return originalLoad.call(this, request, ...args);
};
try {
  const compiled = new Module(path.join(root, "scripts/.quality-memory.cjs"));
  compiled.filename = path.join(root, "scripts/.quality-memory.cjs");
  compiled.paths = require.resolve.paths("obsidian");
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  await compiled.exports.done;
} finally { Module._load = originalLoad; delete globalThis.document; delete globalThis.window; delete globalThis.__quality; }

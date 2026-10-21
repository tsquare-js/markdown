// remark-tsquare's zoom and link: the markup (plain and MDX), the script MDX pages import, and that
// script in a browser (jsdom: no ResizeObserver, setPointerCapture or <dialog> methods, so stubbed).
// The script on the server is in ssr.test.ts, a process without these browser globals.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { compile } from "@mdx-js/mdx";
import type { Element, Root as HastRoot, RootContent } from "hast";
import { JSDOM } from "jsdom";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkTsquare, { type Options } from "remark-tsquare";
import { boardLayout, compileWireframe, decodeWireframe } from "tsquare";
import { unified } from "unified";

const examples = new URL("../examples/", pathToFileURL(createRequire(import.meta.url).resolve("tsquare")));
const example = (name: string) => readFileSync(new URL(`${name}.tsq`, examples), "utf8");
const signIn = example("sign-in"); // one phone: 766px wide
const signUpFlow = example("sign-up-flow"); // three screens: 1899px
const fence = (text: string) => "```tsquare\n" + text.trimEnd() + "\n```\n";

async function toHast(markdown: string, options?: Options) {
  const processor = unified().use(remarkParse).use(remarkTsquare, options).use(remarkRehype);
  return (await processor.run(processor.parse(markdown))) as HastRoot;
}
const toHtml = async (markdown: string, options?: Options) =>
  String(await unified().use(remarkParse).use(remarkTsquare, options).use(remarkRehype).use(rehypeStringify).process(markdown));

function all(node: HastRoot | RootContent, test: (el: Element) => boolean, out: Element[] = []): Element[] {
  if (node.type === "element" && test(node)) out.push(node);
  if ("children" in node) for (const child of node.children) all(child, test, out);
  return out;
}
const byClass = (tree: HastRoot, name: string) => all(tree, (el) => (el.properties.className as string[] | undefined)?.includes(name) ?? false);
const byTag = (tree: HastRoot, tagName: string) => all(tree, (el) => el.tagName === tagName);

test('zoom "auto" (the default): boards wider than a docs column can open at full size, the others stay images', async () => {
  const tree = await toHast(fence(signUpFlow) + "\n" + fence(signIn));
  const [wide, narrow] = byClass(tree, "tsquare-board");
  const [popover] = byClass(tree, "tsquare-zoom");
  assert.equal(popover.properties.popover, "auto");
  const id = String(popover.properties.id);
  assert.match(id, /^tsquare-[0-9a-z]+-0$/);
  const [open] = byClass(tree, "tsquare-open");
  assert.equal(open.tagName, "button");
  assert.equal(open.properties.popoverTarget, id);
  assert.equal(open.properties.ariaLabel, "Show wireframe: sign-up flow at full size");
  assert.equal(byTag(open as unknown as HastRoot, "img").length, 1, "the one image is the button");
  const [close] = byClass(tree, "tsquare-close");
  assert.deepEqual([close.properties.popoverTarget, close.properties.popoverTargetAction], [id, "hide"]);
  // the screens, for the viewer's buttons
  const { spec } = compileWireframe(signUpFlow);
  const screens = boardLayout(spec!).items.filter((i) => i.type === "Screen").map(({ name, x, y, width, height }) => ({ name, x, y, width, height }));
  assert.deepEqual(JSON.parse(String(wide.properties.dataTsquareScreens)), screens);
  assert.deepEqual(narrow.children.map((c) => (c as Element).tagName), ["img"]);
  assert.equal(byTag(tree, "style").length, 1, "the full-size view's styles, once");
});

test("zoom: true for every board, false for none; the styles come only with a board that zooms", async () => {
  assert.equal(byClass(await toHast(fence(signIn), { zoom: true }), "tsquare-zoom").length, 1);
  const off = await toHast(fence(signUpFlow) + "\n" + fence(signIn), { zoom: false });
  assert.equal(byClass(off, "tsquare-zoom").length, 0);
  assert.equal(byTag(off, "style").length, 0);
  assert.equal(byTag(await toHast(fence(signIn)), "style").length, 0);
  const two = await toHast(fence(signUpFlow) + "\n" + fence(signUpFlow));
  const ids = byClass(two, "tsquare-zoom").map((p) => p.properties.id);
  assert.equal(new Set(ids).size, 2, "the same board twice on a page gets two ids");
  assert.equal(byTag(two, "style").length, 1);
});

test("link: an Open in playground link with the wireframe after the #; off by default", async () => {
  assert.equal(byClass(await toHast(fence(signIn)), "tsquare-link").length, 0);
  for (const [link, base] of [[true, "https://tsquare.dev/playground"], ["https://docs.example.com/play#old", "https://docs.example.com/play"]] as const) {
    const tree = await toHast(fence(signUpFlow) + "\n" + fence(signIn), { link });
    const anchors = byClass(tree, "tsquare-link");
    assert.equal(anchors.length, 2, "zoomable or not");
    const href = String(anchors[0].properties.href);
    assert.equal(href.slice(0, href.indexOf("#")), base);
    assert.equal(decodeWireframe(href.slice(href.indexOf("#") + 1)), signUpFlow.trimEnd()); // the block's text
    assert.equal(anchors[0].properties.target, "_blank");
    assert.equal(byClass(tree, "tsquare-caption")[0].tagName, "figcaption");
  }
});

test("plain Markdown doesn't get the script's import (it can't import), and its HTML is complete", async () => {
  const html = await toHtml(fence(signUpFlow));
  assert.doesNotMatch(html, /remark-tsquare\/client|<div><\/div>/);
  assert.match(html, /^<figure class="tsquare-board" data-tsquare-screens="\[\{&#x22;name&#x22;:&#x22;Create account&#x22;/);
  assert.match(html, /<div popover="auto" id="tsquare-[0-9a-z]+-0" class="tsquare-zoom"><button type="button" class="tsquare-open" popovertarget="tsquare-/);
  assert.match(html, /<style>\.tsquare-zoom:not\(:popover-open\)/);
});

test("MDX imports the script once, on pages with a board that zooms", async () => {
  const code = async (source: string, options?: Options) => String(await compile(source, { remarkPlugins: [[remarkTsquare, options]] }));
  const imports = (js: string) => js.match(/import "remark-tsquare\/client";/g)?.length ?? 0;
  assert.equal(imports(await code(fence(signUpFlow) + "\n" + fence(signUpFlow))), 1);
  assert.equal(imports(await code(fence(signIn))), 0, "nothing to zoom");
  assert.equal(imports(await code(fence(signUpFlow), { zoom: false })), 0);
  assert.equal(imports(await code("import x from './x.js'\n\n" + fence(signUpFlow))), 1, "next to the page's own imports");
});

// The script, in a browser page made from the plugin's HTML
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
before(() => {
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window), // the viewer checks the stage's position
    AbortController: dom.window.AbortController, // the viewer's listeners: jsdom only takes its own AbortSignal
  });
  dom.window.HTMLElement.prototype.setPointerCapture = () => {};
  const D = dom.window.HTMLDialogElement.prototype as any;
  D.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  D.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});
after(() => dom.window.close());

test("the script opens a board in the viewer instead of the plain full-size view, on boards added later too", async () => {
  const doc = dom.window.document;
  doc.body.innerHTML = "<p>Intro</p>" + (await toHtml(fence(signUpFlow)));
  const { install } = await import("remark-tsquare/client");
  install(); // a second time: still one listener
  assert.equal(doc.documentElement.dataset.tsquareZoom, "script");

  const click = (el: globalThis.Element) => {
    const event = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(click(doc.querySelector("p")!), false, "other clicks are left alone");
  assert.equal(click(doc.querySelector(".tsquare-open img")!), true, "the popover doesn't open");
  const dialogs = doc.querySelectorAll("dialog.tsquare-viewer");
  assert.equal(dialogs.length, 1);
  assert.ok(dialogs[0].hasAttribute("open"));
  assert.equal(dialogs[0].getAttribute("aria-label"), "Wireframe: Sign-up flow");
  const buttons = () => [...doc.querySelectorAll(".tsquare-viewer-screens button")].map((b) => b.textContent);
  assert.deepEqual(buttons(), ["All", "Create account", "Verify email", "Welcome"]);
  assert.equal(doc.querySelectorAll(".tsquare-viewer-stage img").length, 1);

  // a docs site swapping in another page while keeping the body (Docusaurus): the same dialog serves it
  (dialogs[0] as HTMLDialogElement).close();
  doc.querySelector("figure")!.outerHTML = await toHtml(fence(example("dashboard")));
  assert.equal(click(doc.querySelector(".tsquare-open")!), true);
  assert.equal(doc.querySelectorAll("dialog.tsquare-viewer").length, 1);
  assert.equal(doc.querySelector("dialog.tsquare-viewer"), dialogs[0]);
  assert.equal(dialogs[0].getAttribute("aria-label"), "Wireframe: Analytics");
  assert.deepEqual(buttons(), [], "one screen: no screen buttons");

  // one replacing the whole body and head (Astro's client router): the viewer and its styles are made again
  (dialogs[0] as HTMLDialogElement).close();
  doc.head.innerHTML = "";
  doc.body.innerHTML = await toHtml(fence(signUpFlow));
  assert.equal(click(doc.querySelector(".tsquare-open")!), true);
  const dialog = doc.querySelector("dialog.tsquare-viewer")!;
  assert.ok(dialog.isConnected && dialog.hasAttribute("open"));
  assert.notEqual(dialog, dialogs[0]);
  assert.equal(doc.querySelectorAll("#tsquare-viewer-styles").length, 1);
  assert.deepEqual(buttons(), ["All", "Create account", "Verify email", "Welcome"]);
  (dialog as HTMLDialogElement).close();
  assert.equal(click(doc.querySelector(".tsquare-open")!), true);
  assert.equal(doc.querySelectorAll("#tsquare-viewer-styles").length, 1, "styles added once");
  (dialog as HTMLDialogElement).close();
});

test("the script works in browsers with <dialog> but no popovers (2022-2023), where :popover-open doesn't parse", async () => {
  const doc = dom.window.document;
  const E = dom.window.Element.prototype;
  const H = dom.window.HTMLElement.prototype as any;
  const { matches } = E;
  const hidePopover = H.hidePopover;
  E.matches = function (this: globalThis.Element, selector: string) {
    if (selector.includes(":popover-open")) throw new dom.window.DOMException(`'${selector}' is not a valid selector`, "SyntaxError");
    return matches.call(this, selector);
  };
  delete H.hidePopover;
  try {
    doc.body.innerHTML = await toHtml(fence(signUpFlow));
    const event = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
    doc.querySelector(".tsquare-open")!.dispatchEvent(event);
    assert.ok(event.defaultPrevented);
    assert.ok(doc.querySelector("dialog.tsquare-viewer")?.hasAttribute("open"), "the viewer opens");
  } finally {
    E.matches = matches;
    if (hidePopover) H.hidePopover = hidePopover;
  }
});

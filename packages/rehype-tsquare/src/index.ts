/**
 * rehype-tsquare: turns tsquare code blocks into wireframe images while the site is built. It works
 * on HTML: the <pre><code class="language-tsquare"> that Markdown code blocks become (remark-rehype,
 * MDX, Docusaurus, Astro, Starlight) or that an HTML page has. Nothing runs in the reader's browser
 * unless zoom's script is loaded.
 *
 * Each block becomes <figure class="tsquare-board"><img src="data:image/svg+xml,…"></figure>, or,
 * when its text has problems, <div class="tsquare-problems"> listing them by line, plus a warning on
 * the file and in the build log (or a failed build, with `strict`). The same HTML as remark-tsquare
 * and markdown-it-tsquare make (shared/markup.ts).
 *
 * A syntax highlighter that runs first (Astro's, by default) turns the blocks into plain code, and
 * nothing in the HTML says they were tsquare. The plugin then compares with the page's source: tsquare
 * fences in it but no blocks found means a warning that says how to fix it.
 */
import type { Element, ElementContent, Root, RootContent } from "hast";
import type { VFile } from "vfile";
import { LANG } from "../../../shared/board.js";
import { zoomStyleElement } from "../../../shared/markup.js";
import { drawBlocks, isMdx, mdxImport, warn, type Block } from "../../../shared/unified.js";

export interface Options {
  /** Draw flow arrows between screens. Default true. */
  flows?: boolean;
  /** Fail the build when a wireframe has problems, instead of listing them on the page. Default false. */
  strict?: boolean;
  /**
   * Let readers open a board at full size: "auto" (default) for boards wider than a docs column,
   * true for every board, false for none. With the zoom script, it opens in a viewer with zoom and pan.
   */
  zoom?: "auto" | boolean;
  /**
   * An "Open in playground" link under each board: true for tsquare.dev, or the address of your own
   * playground. Default false.
   */
  link?: boolean | string;
}

const CLIENT = "rehype-tsquare/client";
const SOURCE = "rehype-tsquare";

interface Parent {
  children: (RootContent | ElementContent)[];
}
interface Found {
  pre: Element;
  code: Element;
  parent: Parent;
  index: number;
}

export default function rehypeTsquare(this: { data(key: string): unknown } | void, options: Options = {}) {
  const flows = options.flows ?? true;
  const strict = options.strict ?? false;
  const zoom = options.zoom ?? "auto";
  const link = options.link ?? false;
  const mdx = isMdx(this);

  return async function transform(tree: Root, file: VFile) {
    const found: Found[] = [];
    collect(tree, found);
    if (found.length === 0) {
      missedBlocks(file, strict);
      return;
    }
    const blocks = found.map(blockOf);
    const { elements, zooms } = await drawBlocks(blocks, file, { flows, strict, zoom, link, source: SOURCE });
    found.forEach(({ parent, index }, n) => (parent.children[index] = elements[n]));
    if (zooms) {
      const parent = stylesParent(tree);
      // on its own line, as remark-rehype puts blocks (so the page matches remark-tsquare's)
      if (parent === tree) parent.children.push({ type: "text", value: "\n" });
      parent.children.push(zoomStyleElement());
      if (mdx) tree.children.unshift(mdxImport(CLIENT) as unknown as RootContent);
    }
  };
}

/** Every <pre> whose only element is a <code class="language-tsquare">, inside anything (MDX's JSX elements too). */
function collect(node: Parent, out: Found[]) {
  node.children.forEach((child, index) => {
    if (child.type === "element") {
      const code = tsquareCode(child);
      if (code) {
        out.push({ pre: child, code, parent: node, index });
        return;
      }
    }
    if ("children" in child) collect(child as Parent, out);
  });
}

function tsquareCode(pre: Element): Element | undefined {
  if (pre.tagName !== "pre") return undefined;
  const inside = pre.children.filter((c) => !(c.type === "text" && !c.value.trim()));
  const code = inside[0];
  if (inside.length !== 1 || code.type !== "element" || code.tagName !== "code") return undefined;
  const className = code.properties.className;
  const classes = Array.isArray(className) ? className.map(String) : String(className ?? "").split(/\s+/);
  return classes.includes(`language-${LANG}`) ? code : undefined;
}

function blockOf({ pre, code }: Found): Block {
  // Markdown ends a code block's text with a newline; without it, ids and links match remark-tsquare's
  const text = textOf(code).replace(/\n$/, "");
  const start = pre.position?.start;
  const codeStart = code.position?.start;
  // From Markdown, <pre> and <code> both have the fence's place and the text starts on the next line.
  // In an HTML page the text starts where it is, often on <code>'s own line.
  const fromMarkdown = start && codeStart && start.line === codeStart.line && start.column === codeStart.column;
  const first = code.children[0];
  const textLine = first?.type === "text" ? first.position?.start.line : undefined;
  const before = fromMarkdown ? start : codeStart ? { line: (textLine ?? codeStart.line) - 1, column: 1 } : undefined;
  return { text, position: pre.position, before };
}

function textOf(node: Element | ElementContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(textOf).join("") : "";
}

/** The full-size view's styles go in the page's <head> or <body> when it has them (a whole HTML document), or at the end. */
function stylesParent(tree: Root): Parent {
  const html = tree.children.find((c): c is Element => c.type === "element" && c.tagName === "html");
  const inHtml = (name: string) => html?.children.find((c): c is Element => c.type === "element" && c.tagName === name);
  return inHtml("head") ?? inHtml("body") ?? html ?? tree;
}

/**
 * No blocks, but tsquare fences in the page's source: a highlighter got to them first (Astro's
 * Shiki or Prism, by default) and left plain code with no sign it was tsquare. Says how to fix it.
 */
function missedBlocks(file: VFile, strict: boolean) {
  if (typeof file.value !== "string") return;
  const fences = tsquareFences(file.value);
  if (fences.length === 0) return;
  const blocks = fences.length === 1 ? "a ```tsquare block" : `${fences.length} \`\`\`tsquare blocks`;
  const reason =
    `tsquare: this page has ${blocks}, but a syntax highlighter turned ${fences.length === 1 ? "it" : "them"} into plain code before rehype-tsquare ran. ` +
    `In Astro, add syntaxHighlight: { type: "shiki", excludeLangs: ["tsquare"] } to the markdown config; elsewhere, put rehype-tsquare before the highlighter.`;
  if (strict) file.fail(reason, { place: fences[0], ruleId: "highlighted-first", source: SOURCE });
  warn(file, reason, fences[0], "highlighted-first", SOURCE);
}

/**
 * Where the source's ```tsquare (or ~~~tsquare) fences open, skipping fences shown inside another
 * fence (a page that shows how to write one). Blockquote markers before a fence are allowed.
 */
function tsquareFences(source: string) {
  const found: { line: number; column: number }[] = [];
  let open: { char: string; length: number } | null = null;
  source.split(/\r?\n/).forEach((raw, i) => {
    const m = /^((?:[ \t]*>)*[ \t]*)(`{3,}|~{3,})(.*)$/.exec(raw);
    if (!m) return;
    const [, lead, marks, info] = m;
    if (open) {
      if (marks[0] === open.char && marks.length >= open.length && !info.trim()) open = null;
      return;
    }
    open = { char: marks[0], length: marks.length };
    if (info.trim().split(/\s+/)[0] === LANG) found.push({ line: i + 1, column: lead.length + 1 });
  });
  return found;
}

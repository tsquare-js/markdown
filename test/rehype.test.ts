// rehype-tsquare, as published (dist/, through the workspace link): after remark-rehype (the same
// HTML as remark-tsquare), on HTML pages, through MDX, and after a highlighter that got there first.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { compile, evaluate } from "@mdx-js/mdx";
import type { Element, Root as HastRoot, RootContent } from "hast";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import rehypeTsquare, { type Options } from "rehype-tsquare";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkTsquare from "remark-tsquare";
import { compileWireframe, renderWireframeSvg } from "tsquare";
import { unified } from "unified";
import { VFile } from "vfile";

const examples = new URL("../examples/", pathToFileURL(createRequire(import.meta.url).resolve("tsquare")));
const example = (name: string) => readFileSync(new URL(`${name}.tsq`, examples), "utf8");
const signIn = example("sign-in"); // one phone: stays an image
const signUpFlow = example("sign-up-flow"); // three screens: zooms
const fence = (text: string, lang = "tsquare") => "```" + lang + "\n" + text.trimEnd() + "\n```\n";
const broken = 'board "Broken"\n  screen "A" mobile\n    button "Go" huge\n';

const fromMarkdown = (options?: Options) => unified().use(remarkParse).use(remarkRehype).use(rehypeTsquare, options).use(rehypeStringify);
const fromHtml = (options?: Options, fragment = true) => unified().use(rehypeParse, { fragment }).use(rehypeTsquare, options).use(rehypeStringify);

function elements(node: HastRoot | RootContent, tagName: string, out: Element[] = []): Element[] {
  if (node.type === "element" && node.tagName === tagName) out.push(node);
  if ("children" in node) for (const child of node.children) elements(child, tagName, out);
  return out;
}

const svgOf = (html: string) => decodeURIComponent(html.match(/src="data:image\/svg\+xml,([^"]*)"/)![1].replace(/&#x26;/g, "&"));

test("after remark-rehype: the same HTML as remark-tsquare, page for page", async (t) => {
  t.mock.method(console, "warn", () => {});
  const page = "# Page\n\n" + fence(signIn) + "\nText.\n\n" + fence(signUpFlow) + "\n" + fence(broken) + "\n" + fence("const x = 1", "js");
  for (const options of [{}, { link: true }, { zoom: true }, { zoom: false, flows: false }] as Options[]) {
    const remark = String(await unified().use(remarkParse).use(remarkTsquare, options).use(remarkRehype).use(rehypeStringify).process(page));
    const rehype = String(await fromMarkdown(options).process(page));
    assert.equal(rehype, remark, JSON.stringify(options));
  }
});

test("the board is tsquare's own drawing, and other code blocks are left alone", async () => {
  const html = String(await fromMarkdown().process(fence(signIn) + "\n" + fence("plain", "")));
  assert.equal(svgOf(html), await renderWireframeSvg(compileWireframe(signIn).spec!));
  assert.match(html, /<pre><code>plain\n<\/code><\/pre>/);
});

test("problems are listed in place, and warned about at their line in the file and the build log", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const file = await fromMarkdown().process(new VFile({ path: "page.md", value: "Intro\n\n" + fence(broken) }));
  assert.match(String(file), /^<p>Intro<\/p>\n<div class="tsquare-problems" role="note"><strong>2 problems in this wireframe<\/strong><ul><li>line 2: /);
  // the fence is line 3, so the block's line 2 is the file's line 5
  assert.deepEqual(file.messages.map((m) => [m.line, m.column, m.ruleId, m.source]), [
    [5, 1, "invalid-wireframe", "rehype-tsquare"],
    [6, 1, "invalid-wireframe", "rehype-tsquare"],
  ]);
  assert.match(String(warn.mock.calls[0].arguments[0]), /^page\.md:5:1: tsquare: Screen: don't know what "mobile" is/);
});

test("strict: a wireframe with problems fails the build at its line", async (t) => {
  t.mock.method(console, "warn", () => {});
  await assert.rejects(fromMarkdown({ strict: true }).process("Intro\n\n" + fence(broken)), (err: any) => {
    assert.deepEqual([err.line, err.source, err.ruleId], [5, "rehype-tsquare", "invalid-wireframe"]);
    assert.match(err.reason, /\(and 1 more\)$/);
    return true;
  });
});

test("an HTML page: <pre><code class=\"language-tsquare\">, with problems at their line in the page", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const page = `<p>Before</p>\n<pre><code class="language-tsquare">${signIn.trimEnd()}</code></pre>\n<pre>\n  <code class="language-tsquare">\n${broken}</code>\n</pre>\n<pre><code class="language-js">x</code></pre>`;
  const file = await fromHtml().process(new VFile({ path: "page.html", value: page }));
  const html = String(file);
  assert.equal(svgOf(html), await renderWireframeSvg(compileWireframe(signIn).spec!));
  assert.match(html, /<figure class="tsquare-board">/);
  assert.match(html, /<div class="tsquare-problems"/);
  assert.match(html, /<pre><code class="language-js">x<\/code><\/pre>/);
  // the problems are at the page's lines of the broken block's screen and button
  const lineOf = (text: string) => page.slice(0, page.indexOf(text)).split("\n").length;
  assert.deepEqual(file.messages.map((m) => m.line), [lineOf('screen "A" mobile'), lineOf('button "Go" huge')]);
  assert.equal(warn.mock.callCount(), 2);
});

test("a whole HTML document: the full-size view's styles go in its <head>", async () => {
  const page = `<!doctype html><html><head><title>T</title></head><body><pre><code class="language-tsquare">${signUpFlow}</code></pre></body></html>`;
  const html = String(await fromHtml({}, false).process(page));
  assert.match(html, /<head><title>T<\/title><style>\.tsquare-zoom:popover-open\{/);
  assert.match(html, /<\/figure><\/body><\/html>$/);
});

test("MDX: boards come through as React elements, and pages with a board that zooms import the script once", async (t) => {
  t.mock.method(console, "warn", () => {});
  const source = "# Page\n\n" + fence(signIn) + "\n" + fence(signUpFlow) + "\n" + fence(signUpFlow) + "\n<div>\n\n" + fence(broken) + "\n</div>\n";
  const compiled = String(await compile(source, { rehypePlugins: [rehypeTsquare] }));
  assert.equal(compiled.match(/import "rehype-tsquare\/client";/g)?.length, 1);
  const plain = String(await compile(fence(signIn), { rehypePlugins: [rehypeTsquare] }));
  assert.doesNotMatch(plain, /rehype-tsquare\/client/, "no board zooms, no script");
  // evaluated, without the import (it needs a bundler): the boards, and the block inside JSX
  const { default: Content } = await evaluate(source, { ...runtime, rehypePlugins: [[rehypeTsquare, { zoom: false }]] } as any);
  const html = renderToStaticMarkup(createElement(Content));
  assert.equal(html.match(/<figure class="tsquare-board">/g)?.length, 3);
  assert.match(html, /<div><div class="tsquare-problems" role="note">/);
});

/** What Astro's Shiki does before user rehype plugins run: every block becomes plain, highlighted code. */
const highlighter = () => (tree: HastRoot) => {
  for (const code of elements(tree, "code")) code.properties.className = ["language-plaintext"];
};

test("a highlighter that ran first: a warning at the first fence that says how to fix it", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const processor = unified().use(remarkParse).use(remarkRehype).use(highlighter).use(rehypeTsquare).use(rehypeStringify);
  const file = await processor.process(new VFile({ path: "page.md", value: "# Page\n\n> " + fence(signIn).replace(/\n(?=.)/g, "\n> ") + "\n" + fence(broken) }));
  assert.equal(file.messages.length, 1);
  const [message] = file.messages;
  assert.deepEqual([message.line, message.column, message.ruleId, message.source], [3, 3, "highlighted-first", "rehype-tsquare"]);
  assert.match(message.reason, /^tsquare: this page has 2 ```tsquare blocks, but a syntax highlighter turned them into plain code before rehype-tsquare ran\. In Astro, add syntaxHighlight: \{ type: "shiki", excludeLangs: \["tsquare"\] \}/);
  assert.match(String(warn.mock.calls[0].arguments[0]), /^page\.md:3:3: tsquare: this page has 2 /);
  // the page as bytes (readFileSync without an encoding) is read the same way
  const bytes = await processor.process(new VFile({ path: "page.md", value: new TextEncoder().encode(fence(signIn)) }));
  assert.deepEqual(bytes.messages.map((m) => [m.line, m.ruleId]), [[1, "highlighted-first"]]);
  await assert.rejects(unified().use(remarkParse).use(remarkRehype).use(highlighter).use(rehypeTsquare, { strict: true }).use(rehypeStringify).process(fence(signIn)), /a syntax highlighter turned it into plain code/);
});

test("no warning for a page that only shows a tsquare fence inside a longer one, or has none", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const processor = unified().use(remarkParse).use(remarkRehype).use(highlighter).use(rehypeTsquare).use(rehypeStringify);
  const shown = "How to write one:\n\n````markdown\n" + fence(signIn) + "````\n\n~~~\n```tsquare\n~~~\n";
  // an indented code block, and a longer fence in a list item, each showing a tsquare fence
  const indented = "Example:\n\n" + fence(signIn).replace(/^(?=.)/gm, "    ");
  const inList = "- Steps:\n\n  ````markdown\n" + fence(signIn).replace(/^(?=.)/gm, "  ") + "  ````\n";
  for (const value of [shown, indented, inList, "# Nothing here\n", fence("x", "js")]) {
    const file = await processor.process(value);
    assert.deepEqual(file.messages, [], value);
  }
  assert.equal(warn.mock.callCount(), 0);
});

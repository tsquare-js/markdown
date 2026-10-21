// remark-tsquare, as published (dist/, through the workspace link): through remark-rehype into HTML,
// and through MDX into React.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { evaluate } from "@mdx-js/mdx";
import type { Element, Root as HastRoot, RootContent } from "hast";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkTsquare, { type Options } from "remark-tsquare";
import { boardLayout, compileWireframe, renderWireframeSvg } from "tsquare";
import { unified } from "unified";
import { VFile } from "vfile";

// tsquare ships its examples next to dist/ (not exported, so found from the main entry)
const examples = new URL("../examples/", pathToFileURL(createRequire(import.meta.url).resolve("tsquare")));
const example = (name: string) => readFileSync(new URL(`${name}.tsq`, examples), "utf8");
const signIn = example("sign-in");
const signUpFlow = example("sign-up-flow"); // has flow lines
const fence = (text: string, lang = "tsquare") => "```" + lang + "\n" + text.trimEnd() + "\n```\n";
const broken = 'board "Broken"\n  screen "A" mobile\n    button "Go" huge\n';

async function toHast(markdown: string, options?: Options) {
  const processor = unified().use(remarkParse).use(remarkTsquare, options).use(remarkRehype);
  const file = new VFile({ path: "page.md", value: markdown });
  const tree = (await processor.run(processor.parse(file), file)) as HastRoot;
  return { tree, file };
}

function elements(node: HastRoot | RootContent, tagName: string, out: Element[] = []): Element[] {
  if (node.type === "element" && node.tagName === tagName) out.push(node);
  if ("children" in node) for (const child of node.children) elements(child, tagName, out);
  return out;
}

const svgOf = (img: Element) => {
  const src = String(img.properties.src);
  assert.ok(src.startsWith("data:image/svg+xml,"), src.slice(0, 40));
  return decodeURIComponent(src.slice("data:image/svg+xml,".length));
};

async function expectedSvg(text: string, flows = true) {
  const { spec } = compileWireframe(text);
  return { svg: await renderWireframeSvg(spec!, { flows }), ...boardLayout(spec!, { flows }) };
}

test("a tsquare block becomes a figure with the board as an image", async () => {
  const { tree, file } = await toHast("# Sign in\n\n" + fence(signIn));
  const [figure] = elements(tree, "figure");
  assert.deepEqual(figure.properties.className, ["tsquare-board"]);
  const [img] = elements(figure, "img");
  const expected = await expectedSvg(signIn);
  assert.equal(svgOf(img), expected.svg);
  assert.equal(img.properties.width, expected.width);
  assert.equal(img.properties.height, expected.height);
  assert.equal(img.properties.alt, "Wireframe: Sign in");
  assert.equal(img.properties.style, "max-width:100%;height:auto");
  assert.equal(elements(tree, "pre").length, 0);
  assert.deepEqual(file.messages, []);
});

test("other code blocks are left alone", async () => {
  const { tree } = await toHast(fence("const x = 1", "js") + "\n" + fence("plain", "") + "\n" + fence(signIn));
  const codes = elements(tree, "code");
  assert.equal(codes.length, 2);
  assert.deepEqual(codes[0].properties.className, ["language-js"]);
  assert.equal(elements(tree, "figure").length, 1);
});

test("blocks inside lists and quotes, and several on a page, each in its place", async () => {
  const markdown = "- item\n\n  " + fence(signIn).replace(/\n(?=.)/g, "\n  ") + "\n> " + fence(signUpFlow).replace(/\n(?=.)/g, "\n> ") + "\nEnd.\n";
  const { tree } = await toHast(markdown);
  const imgs = elements(tree, "img");
  assert.deepEqual(imgs.map((i) => i.properties.alt), ["Wireframe: Sign in", "Wireframe: Sign-up flow"]);
  assert.equal(elements(elements(tree, "li")[0], "figure").length, 1);
  assert.equal(elements(elements(tree, "blockquote")[0], "figure").length, 1);
});

test("flows: false draws the board without its flow arrows", async () => {
  const on = elements((await toHast(fence(signUpFlow))).tree, "img")[0];
  const off = elements((await toHast(fence(signUpFlow), { flows: false })).tree, "img")[0];
  const expected = await expectedSvg(signUpFlow, false);
  assert.equal(svgOf(off), expected.svg);
  assert.equal(off.properties.height, expected.height);
  assert.notEqual(svgOf(on), svgOf(off));
});

test("problems are listed in place of the board, and warned about at their line in the file and the build log", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const { tree, file } = await toHast("Intro\n\n" + fence(broken));
  assert.equal(elements(tree, "figure").length, 0);
  const [box] = elements(tree, "div");
  assert.deepEqual(box.properties.className, ["tsquare-problems"]);
  assert.equal(box.properties.role, "note");
  const text = (el: Element) => el.children.map((c) => (c.type === "text" ? c.value : "")).join("");
  assert.equal(text(elements(box, "strong")[0]), "2 problems in this wireframe");
  const items = elements(box, "li").map(text);
  assert.match(items[0], /^line 2: Screen: don't know what "mobile" is/);
  assert.match(items[1], /^line 3: /);
  // the fence is line 3 of the file, so the block's line 2 is the file's line 5
  assert.deepEqual(file.messages.map((m) => [m.line, m.ruleId, m.source, m.fatal]), [
    [5, "invalid-wireframe", "remark-tsquare", false],
    [6, "invalid-wireframe", "remark-tsquare", false],
  ]);
  assert.match(file.messages[0].reason, /^tsquare: Screen: don't know what "mobile" is/);
  // frameworks (Docusaurus, Astro) don't print a file's messages
  const logged = warn.mock.calls.map((c) => String(c.arguments[0]));
  assert.equal(logged.length, 2);
  assert.match(logged[0], /^page\.md:5:1: tsquare: Screen: don't know what "mobile" is/);
  assert.match(logged[1], /^page\.md:6:1: tsquare: /);
});

test("strict: a wireframe with problems fails the build at its line", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  await assert.rejects(toHast("Intro\n\n" + fence(broken), { strict: true }), (err: any) => {
    assert.equal(err.line, 5);
    assert.equal(err.source, "remark-tsquare");
    assert.match(err.reason, /^tsquare: Screen: don't know what "mobile" is.* \(and 1 more\)$/);
    return true;
  });
  assert.equal(warn.mock.callCount(), 0, "the failure says it all");
  await toHast(fence(signIn), { strict: true }); // valid boards still pass
});

test("the HTML: the image's URL survives serializing", async () => {
  const file = await unified().use(remarkParse).use(remarkTsquare).use(remarkRehype).use(rehypeStringify).process(fence(signIn));
  const html = String(file);
  assert.match(html, /^<figure class="tsquare-board"><img src="data:image\/svg\+xml,%3Csvg /);
  const src = html.match(/src="([^"]*)"/)![1].replace(/&#x26;/g, "&").replace(/&amp;/g, "&");
  assert.equal(decodeURIComponent(src.slice("data:image/svg+xml,".length)), (await expectedSvg(signIn)).svg);
  assert.ok(!/[<>"']/.test(src), "nothing in the URL that could close the attribute or a tag");
});

test("MDX: boards and problems come through as React elements", async (t) => {
  t.mock.method(console, "warn", () => {});
  const source = "# Page\n\n" + fence(signIn) + "\n" + fence(broken) + "\n<p>JSX next to it</p>\n";
  const { default: Content } = await evaluate(source, { ...runtime, remarkPlugins: [remarkTsquare] } as any);
  const html = renderToStaticMarkup(createElement(Content));
  assert.match(html, /<figure class="tsquare-board"><img src="data:image\/svg\+xml,%3Csvg [^"]*" alt="Wireframe: Sign in" width="\d+" height="\d+" style="max-width:100%;height:auto"\/><\/figure>/);
  assert.match(html, /<div class="tsquare-problems" role="note"><strong>2 problems in this wireframe<\/strong><ul><li>line 2: /);
  assert.match(html, /<p>JSX next to it<\/p>/);
});

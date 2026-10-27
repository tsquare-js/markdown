// markdown-it-tsquare, as published (dist/, through the workspace link): boards drawn in its worker,
// the same HTML as remark-tsquare, problems and their lines, the options.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import MarkdownIt from "markdown-it";
import markdownItTsquare, { type Options } from "markdown-it-tsquare";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkTsquare from "remark-tsquare";
import { boardLayout, compileWireframe, decodeWireframe, renderWireframeSvg } from "tsquare";
import { unified } from "unified";

const examples = new URL("../examples/", pathToFileURL(createRequire(import.meta.url).resolve("tsquare")));
const example = (name: string) => readFileSync(new URL(`${name}.tsq`, examples), "utf8");
const signIn = example("sign-in"); // 766px wide
const signUpFlow = example("sign-up-flow"); // 1899px, flow lines
const fence = (text: string, lang = "tsquare") => "```" + lang + "\n" + text.trimEnd() + "\n```\n";
const broken = 'board "Broken"\n  screen "A" mobile\n    button "Go" huge\n';

const render = (markdown: string, options?: Options, env: object = {}) => new MarkdownIt().use(markdownItTsquare, options).render(markdown, env);
const figures = (html: string) => html.match(/<figure[\s\S]*?<\/figure>/g) ?? [];
const svgOf = (html: string) => decodeURIComponent(html.match(/src="data:image\/svg\+xml,([^"]*)"/)![1].replace(/&#x26;/g, "&").replace(/&amp;/g, "&"));

test("a block becomes the board, drawn in the worker exactly as tsquare draws it", async () => {
  const html = render("# Sign in\n\n" + fence(signIn));
  const figure = figures(html)[0]!;
  assert.match(figure, /^<figure class="tsquare-board"><img src="data:image\/svg\+xml,%3Csvg /);
  const { spec } = compileWireframe(signIn);
  assert.equal(svgOf(figure), await renderWireframeSvg(spec!));
  const { width, height } = boardLayout(spec!);
  assert.match(figure, new RegExp(`alt="Wireframe: Sign in" width="${width}" height="${height}" style="max-width:100%;height:auto">`));
  assert.doesNotMatch(html, /<pre|<style|<link/);
});

test("the same HTML as remark-tsquare, board for board", async () => {
  const markdown = fence(signUpFlow) + "\n" + fence(signIn) + "\n" + fence(broken);
  const options = { link: true, zoom: "auto" } as const;
  const viaRemark = String(await unified().use(remarkParse).use(remarkTsquare, options).use(remarkRehype).use(rehypeStringify).process(markdown));
  const viaMarkdownIt = render(markdown, options);
  const parts = (html: string) => [...figures(html), ...(html.match(/<div class="tsquare-problems"[\s\S]*?<\/div>/g) ?? [])];
  const remarkParts = parts(viaRemark);
  assert.equal(remarkParts.length, 3); // two boards, the problems
  assert.deepEqual(parts(viaMarkdownIt), remarkParts);
  // the same styles, as <style> there and as a <link> here (VitePress drops <style>)
  const css = viaRemark.match(/<style>([\s\S]*?)<\/style>/)![1];
  const href = viaMarkdownIt.match(/<link rel="stylesheet" href="data:text\/css,([^"]*)">/)![1];
  assert.equal(decodeURIComponent(href), css);
});

test("a board with notes gets the size it's drawn at, from both plugins (tsquare-js/tsquare#44)", async () => {
  // a notes-only row in a grid: tsquare's boardLayout estimates note heights; drawing measures them
  const wide = "WARNING: MANDATORY REVIEW WINDOW MUST MATCH WORKFLOW WWW MMM QA APPROVAL ".repeat(3).trim();
  const notes = ['board "Notes" layout=grid columns=2', '  screen phone "Top"', `  note "${wide}"`, `  note "${wide}"`, '  note "Short"', '  screen phone "Below"'].join("\n");
  const html = render(fence(notes), { zoom: true });
  const figure = figures(html)[0]!;
  const [, w, h] = svgOf(figure).match(/^<svg width="(\d+)" height="(\d+)"/)!;
  assert.match(figure, new RegExp(`width="${w}" height="${h}"`));
  assert.notEqual(Number(h), boardLayout(compileWireframe(notes).spec!).height, "the estimate is off for this board");
  const viaRemark = String(await unified().use(remarkParse).use(remarkTsquare, { zoom: true }).use(remarkRehype).use(rehypeStringify).process(fence(notes)));
  assert.deepEqual(figures(viaRemark), figures(html));
});

test("other code blocks keep the site's own rendering (a highlighter, here)", () => {
  const md = new MarkdownIt({ highlight: (code, lang) => `<pre class="hl-${lang}"><code>${code}</code></pre>` }).use(markdownItTsquare);
  const html = md.render(fence("const x = 1", "js") + fence(signIn) + "```\nplain\n```\n");
  assert.match(html, /<pre class="hl-js"><code>const x = 1\n<\/code><\/pre>/);
  assert.match(html, /<pre class="hl-"><code>plain\n<\/code><\/pre>/);
  assert.equal(figures(html).length, 1);
});

test("zoom: \"auto\" for boards wider than a column, true, false; the styles once per page", () => {
  const page = fence(signUpFlow) + "\n" + fence(signIn) + "\n" + fence(signUpFlow);
  const auto = render(page);
  assert.equal((auto.match(/class="tsquare-zoom"/g) ?? []).length, 2);
  assert.equal((auto.match(/<link rel="stylesheet"/g) ?? []).length, 1);
  assert.ok(auto.indexOf("<link") < auto.indexOf("<figure"), "before the first board that zooms");
  const ids = [...auto.matchAll(/id="(tsquare-[^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, 2, "the same board twice gets two ids");
  assert.equal((render(page, { zoom: true }).match(/class="tsquare-zoom"/g) ?? []).length, 3);
  const off = render(page, { zoom: false });
  assert.doesNotMatch(off, /tsquare-zoom|<link/);
  // a new page (env) gets its own styles; one md renders many pages in a site build
  const md = new MarkdownIt().use(markdownItTsquare);
  assert.equal((md.render(fence(signUpFlow), {}).match(/<link rel="stylesheet"/g) ?? []).length, 1);
  assert.equal((md.render(fence(signUpFlow), {}).match(/<link rel="stylesheet"/g) ?? []).length, 1);
  // the same page rendered again with the same env (a rebuild): the same output, styles and ids included
  const env = { path: "docs/a.md" };
  const first = md.render(fence(signUpFlow) + "\n" + fence(signUpFlow), env);
  assert.equal(md.render(fence(signUpFlow) + "\n" + fence(signUpFlow), env), first);
  assert.equal((first.match(/<link rel="stylesheet"/g) ?? []).length, 1);
});

test("flows: false, and link", () => {
  const off = svgOf(render(fence(signUpFlow), { flows: false, zoom: false }));
  assert.notEqual(off, svgOf(render(fence(signUpFlow), { zoom: false })));
  assert.match(off, /^<svg /);
  const html = render(fence(signIn), { link: "https://docs.example.com/play" });
  const href = html.match(/<a class="tsquare-link" href="([^"]+)" target="_blank" rel="noopener">Open in playground<\/a>/)![1];
  assert.ok(href.startsWith("https://docs.example.com/play#"));
  assert.equal(decodeWireframe(href.slice(href.indexOf("#") + 1)), signIn.trimEnd());
  assert.doesNotMatch(render(fence(signIn)), /tsquare-link/);
});

test("problems in place, and in the build log at their line in the page's file (VitePress's env.path, Eleventy's env.page.inputPath)", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const html = render("Intro\n\n" + fence(broken), {}, { path: "/site/docs/intro.md" });
  assert.match(html, /<div class="tsquare-problems" role="note"><strong>2 problems in this wireframe<\/strong><ul><li>line 2: Screen: don't know what "mobile" is/);
  // the fence is line 3 of the file, so the block's line 2 is the file's line 5
  const logged = warn.mock.calls.map((c) => String(c.arguments[0]));
  assert.equal(logged.length, 2);
  assert.match(logged[0], /^\/site\/docs\/intro\.md:5:1: tsquare: Screen: don't know what "mobile" is/);
  assert.match(logged[1], /^\/site\/docs\/intro\.md:6:1: tsquare: /);
  render(fence(broken), {}, { page: { inputPath: "./src/posts/one.md" } });
  assert.match(String(warn.mock.calls[2].arguments[0]), /^\.\/src\/posts\/one\.md:3:1: /);
});

test("strict: a problem fails the render with the file and line", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  assert.throws(() => render("Intro\n\n" + fence(broken), { strict: true }, { path: "docs/a.md" }), /^Error: docs\/a\.md:5:1: tsquare: Screen: don't know what "mobile" is.* \(and 1 more\)$/);
  assert.equal(warn.mock.callCount(), 0);
  assert.equal(figures(render(fence(signIn), { strict: true })).length, 1);
});

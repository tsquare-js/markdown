// The zoom script on the server: an MDX page imports it, and Docusaurus renders pages in Node, where
// there's no window or document. Its own process (node:test runs each file in one), so none of
// zoom.test.ts's browser globals are here.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { evaluate } from "@mdx-js/mdx";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import remarkTsquare from "remark-tsquare";

const examples = new URL("../examples/", pathToFileURL(createRequire(import.meta.url).resolve("tsquare")));
const signUpFlow = readFileSync(new URL("sign-up-flow.tsq", examples), "utf8");

test("MDX renders on the server with the script imported (it waits for a browser), popover attributes intact", async () => {
  assert.equal(typeof document, "undefined");
  assert.equal(typeof window, "undefined");
  // what Docusaurus does: the page module, imports and all, runs in Node to render HTML
  const { default: Content } = await evaluate("```tsquare\n" + signUpFlow + "```\n", { ...runtime, baseUrl: import.meta.url, remarkPlugins: [remarkTsquare] } as any);
  const html = renderToStaticMarkup(createElement(Content));
  assert.match(html, /<div popover="auto" id="(tsquare-[0-9a-z]+-0)" class="tsquare-zoom"><button type="button" class="tsquare-open" popoverTarget="\1"/i);
  assert.match(html, /popoverTargetAction="hide"/i);
  assert.match(html, /<style>\.tsquare-zoom:not\(:popover-open\)/);
});

test("the script does nothing on the server, imported or installed", async () => {
  const { install } = await import("remark-tsquare/client");
  install();
  assert.equal(typeof document, "undefined");
});

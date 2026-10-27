// The shared code, from source (it isn't published on its own).
import assert from "node:assert/strict";
import { test } from "node:test";
import { check, render } from "../shared/board.js";

const text = 'board "Cache"\n  screen phone\n    heading "Hello"\n';

test("renders of the same text share one promise, even while the first is still drawing", async () => {
  const checked = check(text);
  assert.ok(checked.ok);
  const first = render(text, checked.spec, true);
  const second = render(text, checked.spec, true); // same moment: Docusaurus's client and server bundles
  assert.equal(second, first);
  assert.notEqual(render(text, checked.spec, false), first, "flows off is a different board");
  assert.match((await first).svg, /^<svg /);
  assert.equal(render(text, checked.spec, true), first, "and after it's done");
});

test("a failed render isn't kept: the next one tries again", async () => {
  const broken = { root: "missing", elements: {} } as never;
  const failed = render("broken\n", broken, true);
  await assert.rejects(failed);
  await new Promise((resolve) => setImmediate(resolve)); // let the cache drop it
  const again = render("broken\n", broken, true);
  assert.notEqual(again, failed);
  await assert.rejects(again);
});

test("a drawn board's size and screens are the SVG's, even when notes wrap differently than their length suggests", async () => {
  // a notes-only row in a grid: tsquare's boardLayout estimates note heights; drawing measures them
  const wide = "WARNING: MANDATORY REVIEW WINDOW MUST MATCH WORKFLOW WWW MMM QA APPROVAL ".repeat(3).trim();
  const board = ["board layout=grid columns=2", '  screen phone "Top"', `  note "${wide}"`, `  note "${wide}"`, '  note "Short"', '  screen phone "Below"'].join("\n");
  const checked = check(board);
  assert.ok(checked.ok);
  const drawn = await render(board, checked.spec, true);
  const [, w, h] = drawn.svg.match(/^<svg width="(\d+)" height="(\d+)"/)!;
  assert.deepEqual([drawn.width, drawn.height], [Number(w), Number(h)]);
  assert.deepEqual(drawn.screens.map((s) => s.name), ["Top", "Below"]);
});

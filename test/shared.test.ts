// The shared code, from source (it isn't published on its own).
import assert from "node:assert/strict";
import { test } from "node:test";
import { check, render } from "../shared/board.js";

const text = 'board "Cache"\n  screen phone\n    heading "Hello"\n';

test("renders of the same text share one promise, even while the first is still drawing", async () => {
  const checked = check(text, true);
  assert.ok(checked.ok);
  const first = render(text, checked.spec, true);
  const second = render(text, checked.spec, true); // same moment: Docusaurus's client and server bundles
  assert.equal(second, first);
  assert.notEqual(render(text, checked.spec, false), first, "flows off is a different board");
  assert.match(await first, /^<svg /);
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

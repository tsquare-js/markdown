// The READMEs against the code: every wireframe in them is valid, every option is documented.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { compileWireframe } from "tsquare";

const packages = readdirSync("packages");
const readme = (name: string) => readFileSync(`packages/${name}/README.md`, "utf8");

/** ```tsquare blocks, also inside a ````markdown example. */
const wireframes = (markdown: string) => [...markdown.matchAll(/^```tsquare\n([\s\S]*?)^```$/gm)].map((m) => m[1]);

test("every wireframe in a README is valid", () => {
  for (const name of packages) {
    const blocks = wireframes(readme(name));
    assert.ok(blocks.length > 0, `${name} shows a wireframe`);
    for (const text of blocks) assert.deepEqual(compileWireframe(text).issues, [], `${name}:\n${text}`);
  }
});

test("every option is in its README's options table", () => {
  for (const name of packages) {
    const types = readFileSync(`packages/${name}/dist/index.d.ts`, "utf8");
    const options = types.match(/export interface Options \{([\s\S]*?)\n\}/)![1];
    const keys = [...options.matchAll(/^\s+(\w+)\?:/gm)].map((m) => m[1]);
    assert.ok(keys.length > 0, name);
    for (const key of keys) assert.match(readme(name), new RegExp(`^\\| \`${key}\` \\|`, "m"), `${name}: ${key}`);
  }
});

test("the problems shown in a README are what the plugin says", () => {
  for (const name of packages) {
    for (const [, line, message] of readme(name).matchAll(/<li>line (\d+): (.*?)<\/li>/g)) {
      const text = 'board "Broken"\n  screen "A" mobile\n';
      const issue = compileWireframe(text).issues.find((i) => i.line === Number(line));
      assert.equal(issue?.message, message.replace(/&quot;/g, '"'), name);
    }
  }
});

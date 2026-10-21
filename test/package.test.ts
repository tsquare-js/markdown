// What npm gets: each package's tarball holds only what it should, and imports only its dependencies.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const packages = readdirSync("packages");
const root = JSON.parse(readFileSync("package.json", "utf8"));

for (const name of packages) {
  const dir = `packages/${name}`;
  const pkg = JSON.parse(readFileSync(`${dir}/package.json`, "utf8"));

  test(`${name}: the tarball has the build, README and LICENSE, nothing else`, () => {
    const [packed] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "-w", name], { encoding: "utf8" }));
    const build = readdirSync(`${dir}/dist`).map((f) => `dist/${f}`);
    assert.deepEqual(packed.files.map((f: { path: string }) => f.path).sort(), ["LICENSE", "README.md", ...build, "package.json"].sort());
    for (const [entry, target] of Object.entries<string | { import: string; types: string }>(pkg.exports)) {
      const files = typeof target === "string" ? [target] : [target.import, target.types];
      for (const file of files) assert.ok(build.includes(file.slice(2)), `${entry}: ${file}`);
    }
    assert.equal(readFileSync(`${dir}/LICENSE`, "utf8"), readFileSync("LICENSE", "utf8"));
  });

  test(`${name}: the build imports only its dependencies and Node, with the shared code bundled in`, () => {
    const packageName = (spec: string) => spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");
    for (const file of readdirSync(`${dir}/dist`).filter((f) => f.endsWith(".js") && f !== "client.standalone.js")) {
      const js = readFileSync(`${dir}/dist/${file}`, "utf8");
      const imports = [...js.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
      for (const spec of imports) assert.ok(spec.startsWith("node:") || packageName(spec) in pkg.dependencies, `${name}/${file} imports ${spec}`);
    }
    // the zoom script runs in the reader's browser: nothing from Node, and only the viewer from tsquare
    const client = readFileSync(`${dir}/dist/client.js`, "utf8");
    assert.deepEqual([...client.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]), ["tsquare/viewer"]);
    // and the copy for a plain <script> imports nothing at all
    const standalone = readFileSync(`${dir}/dist/client.standalone.js`, "utf8");
    assert.doesNotMatch(standalone, /\bimport\s*[\s{*"'(]|\brequire\(/);
    assert.match(standalone, /__tsquareZoom/);
    const types = readFileSync(`${dir}/dist/index.d.ts`, "utf8");
    // a types-only package (mdast) comes from its @types/ package
    for (const [, spec] of types.matchAll(/from "([^"]+)"/g)) assert.ok(spec in pkg.dependencies || `@types/${spec}` in pkg.dependencies, `${name}'s types import ${spec}`);
  });

  test(`${name}: same version as the others, and the repo's Node range`, () => {
    for (const other of packages) assert.equal(JSON.parse(readFileSync(`packages/${other}/package.json`, "utf8")).version, pkg.version, other);
    assert.equal(pkg.engines.node, root.engines.node);
  });
}

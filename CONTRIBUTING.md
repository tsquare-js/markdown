# Contributing

## How it's laid out

- `packages/remark-tsquare/`: the remark plugin. `packages/markdown-it-tsquare/`: the markdown-it plugin, with `worker.ts` drawing boards in a worker thread (synckit), since markdown-it renders synchronously. Each package has its own `package.json`, `README.md` (its documentation on npm) and a copy of `LICENSE`.
- `shared/`: what every plugin does the same way. `markup.ts`: the HTML, as hast elements (remark hands them on, markdown-it turns them into a string; a test checks both plugins' output is identical). `board.ts`: compile a block, render it, the data: URL, the problems' wording, the zoom markup's styles and the playground link. `client.ts`: the zoom script that runs in the reader's browser (each package publishes it as `<package>/client`; it imports only `tsquare/viewer`, which the site's bundler resolves). It's bundled into each package's `dist/`, never published on its own, and must not appear in a package's public types (the build checks).
- `test/`: each package as published (`dist/`, through the workspace link), and the READMEs against the code.

The plugins depend on [`tsquare`](https://www.npmjs.com/package/tsquare), a released version, for everything about the language and the renderer; those live in [tsquare-js/tsquare](https://github.com/tsquare-js/tsquare). To try an unreleased tsquare change, build that checkout and install it without saving: `npm install ../tsquare --no-save`. `npm ci` puts the released version back.

## Develop

```bash
npm install       # every package, and builds them through "prepare"
npm test          # the plugins through remark-rehype and MDX, the READMEs, the tarballs
npm run typecheck
```

Before a release, try real sites too: remark-tsquare has been checked in Docusaurus 3.10 and Astro 7.3 (`.md` and `.mdx` pages), markdown-it-tsquare in VitePress 1.6 and Eleventy 3.1 (ESM and CommonJS configs), each by installing the packed tarball (`npm pack -w <package>`). For zoom, check a wide board is visible and opens on first load and after moving to another page inside the site (the viewer, with the script; the full-size popover, without it). Look at it, don't only click it from a script: a script can click a hidden element, which is how invisible boards on VitePress went unnoticed once. Restart a static preview server after rebuilding (VitePress's indexes its files at startup). Touch can't be tested from a desktop browser's phone mode: try a phone.

## Release

Every package has the same version and they're released together, from one tag.

1. In a PR, set the new version in every `packages/*/package.json` (`npm version <x.y.z> --workspaces --no-git-tag-version`) and turn `## Unreleased` in `CHANGELOG.md` into `## <x.y.z>`; that section becomes the release notes. Merge it.
2. Tag `main` and push the tag: `git tag v<x.y.z> origin/main && git push origin v<x.y.z>`.

The release workflow checks the tag against every package's version and the changelog, builds and tests, publishes each package to npm with trusted publishing (no token), and creates the GitHub release.

**One-time setup per package** (after its first version, published by hand from its folder with `npm publish --access public`): on npmjs.com, the package → **Settings** → **Trusted Publisher** → GitHub Actions, organization `tsquare-js`, repository `markdown`, workflow `release.yml`, no environment, and allow `npm publish`.

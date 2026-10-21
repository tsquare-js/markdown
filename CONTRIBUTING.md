# Contributing

## How it's laid out

- `packages/remark-tsquare/`: the remark plugin. Each package has its own `package.json`, `README.md` (its documentation on npm) and a copy of `LICENSE`.
- `shared/`: what every plugin does the same way. `board.ts`: compile a block, render it, the data: URL, the problems' wording, the zoom markup's styles and the playground link. `client.ts`: the zoom script that runs in the reader's browser (each package publishes it as `<package>/client`; it imports only `tsquare/viewer`, which the site's bundler resolves). It's bundled into each package's `dist/`, never published on its own, and must not appear in a package's public types (the build checks).
- `test/`: each package as published (`dist/`, through the workspace link), and the READMEs against the code.

The plugins depend on [`tsquare`](https://www.npmjs.com/package/tsquare), a released version, for everything about the language and the renderer; those live in [tsquare-js/tsquare](https://github.com/tsquare-js/tsquare). To try an unreleased tsquare change, build that checkout and install it without saving: `npm install ../tsquare --no-save`. `npm ci` puts the released version back.

## Develop

```bash
npm install       # every package, and builds them through "prepare"
npm test          # the plugins through remark-rehype and MDX, the READMEs, the tarballs
npm run typecheck
```

Before a release, try a real site too: the plugins have been checked in Docusaurus 3.10 and Astro 7.3 (`.md` and `.mdx` pages) by installing the packed tarball (`npm pack -w remark-tsquare`). For zoom, click a wide board on first load and after moving to another page inside the site (the viewer should open), and with the page's scripts removed (the full-size popover should open). Touch can't be tested from a desktop browser's phone mode: try a phone.

## Release

Every package has the same version and they're released together, from one tag.

1. In a PR, set the new version in every `packages/*/package.json` (`npm version <x.y.z> --workspaces --no-git-tag-version`) and turn `## Unreleased` in `CHANGELOG.md` into `## <x.y.z>`; that section becomes the release notes. Merge it.
2. Tag `main` and push the tag: `git tag v<x.y.z> origin/main && git push origin v<x.y.z>`.

The release workflow checks the tag against every package's version and the changelog, builds and tests, publishes each package to npm with trusted publishing (no token), and creates the GitHub release.

**One-time setup per package** (after its first version, published by hand from its folder with `npm publish --access public`): on npmjs.com, the package → **Settings** → **Trusted Publisher** → GitHub Actions, organization `tsquare-js`, repository `markdown`, workflow `release.yml`, no environment, and allow `npm publish`.

# remark-tsquare

A [remark](https://github.com/remarkjs/remark) plugin that turns ```` ```tsquare ```` code blocks into wireframe images when your site is built. [tsquare](https://tsquare.dev) is a plain-text language for UI wireframes: screens, components and notes, laid out on a board.

````markdown
```tsquare
board "Sign in"
  screen phone "Sign in"
    heading "Welcome back"
    input "Email"
    button "Sign in" primary fullWidth
```
````

Each block becomes the board as an image, drawn on the machine that builds the site. Nothing runs in the reader's browser and nothing is sent anywhere: the image is inside the page.

Works with Docusaurus, Astro, MDX and anything else built on [unified](https://unifiedjs.com). For VitePress and other markdown-it sites, use `markdown-it-tsquare` (coming soon).

## Install

```bash
npm install remark-tsquare
```

Node 20 or newer. The package is ESM only, like the rest of the unified ecosystem.

## Use it

### Docusaurus

In `docusaurus.config.js`, add it to the docs (and the blog or pages, if they have wireframes too):

```js
import remarkTsquare from "remark-tsquare";

export default {
  presets: [
    ["classic", {
      docs: { remarkPlugins: [remarkTsquare] },
      blog: { remarkPlugins: [remarkTsquare] },
    }],
  ],
};
```

Works in `.md` and `.mdx` files.

### Astro

Astro 7 renders Markdown with Sätteri by default, which doesn't run remark plugins; install Astro's remark processor alongside the plugin:

```bash
npm install remark-tsquare @astrojs/markdown-remark
```

Then in `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import remarkTsquare from "remark-tsquare";

export default defineConfig({
  markdown: { remarkPlugins: [remarkTsquare] },
});
```

`@astrojs/mdx` uses the same plugins for `.mdx` files (unless you've turned off `extendMarkdownConfig`).

### unified

```js
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkTsquare from "remark-tsquare";

const html = String(
  await unified()
    .use(remarkParse)
    .use(remarkTsquare)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown),
);
```

With MDX (`@mdx-js/mdx`), pass it in `remarkPlugins`. The plugin is async, so use `process` or `run`, not their `Sync` versions.

## Options

```js
remarkPlugins: [[remarkTsquare, { flows: false, strict: true }]]
```

| Option | Default | |
|---|---|---|
| `flows` | `true` | Draw the flow arrows between screens. Off, a board looks exactly as if it had no `flow` lines. |
| `strict` | `false` | Fail the build when a wireframe has problems, instead of listing them on the page. Good for CI. |

## What it makes

A board:

```html
<figure class="tsquare-board">
  <img src="data:image/svg+xml,…" alt="Wireframe: Sign in" width="766" height="1060" style="max-width:100%;height:auto">
</figure>
```

The image is the board's SVG, inside the page itself. Its `width` and `height` keep the page from jumping while it loads, and the inline style shrinks a wide board to fit your column. The alt text comes from the board's title.

A block with problems shows them in its place, by line, so you can fix them from the page:

```html
<div class="tsquare-problems" role="note">
  <strong>1 problem in this wireframe</strong>
  <ul><li>line 2: Screen: don't know what "mobile" is (bare words it accepts: phone, tablet, desktop, custom, chrome)</li></ul>
</div>
```

They're also printed in the build log with the file and line (`docs/intro.md:26:1: tsquare: …`), and added to the file's messages for tools that report those (`remark-cli`). With `strict`, the first problem fails the build instead.

Both are plain HTML with stable class names, so your site's CSS can style them. The board image itself is always light, like a printed wireframe.

## Size

A board is about 120–250 KB of SVG, 30–70 KB once the server compresses the page. Docusaurus also puts each page's content in a JavaScript file that the browser loads with the page, so there a board is downloaded twice. Keep that in mind on pages with many boards.

## Links

- [The tsquare language](https://tsquare.dev/docs)
- [Playground](https://tsquare.dev/playground): write a wireframe and see it as you type
- [Changelog](https://github.com/tsquare-js/markdown/blob/main/CHANGELOG.md)

## License

MIT

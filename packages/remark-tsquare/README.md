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

Each block becomes the board as an image, drawn on the machine that builds the site and placed inside the page: nothing is sent anywhere. Readers can open a wide board at full size, or in a viewer with zoom and pan (see [Zoom](#zoom)).

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

Works in `.md` and `.mdx` files, and the zoom viewer comes with it: nothing else to set up. (If you've set `markdown: { format: "detect" }`, `.md` files aren't MDX and can't load the viewer themselves; add it for the whole site with `clientModules: [require.resolve("remark-tsquare/client")]`, where `require` is `createRequire(import.meta.url)` from `node:module` in an ESM config.)

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

Boards open at full size without a script. For the zoom viewer, load its script from the layout your Markdown pages use (Astro only sends a page's scripts to the browser from `<script>` tags, so the import the plugin adds to `.mdx` pages runs only while building):

```astro
<script>
  import "remark-tsquare/client";
</script>
```

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

With MDX (`@mdx-js/mdx`), pass it in `remarkPlugins`; pages with a board that zooms import `remark-tsquare/client` for the viewer, so your bundler needs to resolve it. The plugin is async, so use `process` or `run`, not their `Sync` versions. For HTML you serve yourself, add `import "remark-tsquare/client"` to the page's JavaScript for the viewer.

## Options

```js
remarkPlugins: [[remarkTsquare, { zoom: true, link: true, strict: true }]]
```

| Option | Default | |
|---|---|---|
| `zoom` | `"auto"` | Let readers open a board at full size (see [Zoom](#zoom)). `"auto"`: boards wider than 800px, the ones a docs column shrinks. `true`: every board. `false`: none. |
| `link` | `false` | An "Open in playground" link under each board, which opens it in [the playground](https://tsquare.dev/playground) in a new tab. `true` for tsquare.dev, or the address of a playground you host. The wireframe goes in the link after the `#`, which browsers don't send to the server. |
| `flows` | `true` | Draw the flow arrows between screens. Off, a board looks exactly as if it had no `flow` lines. |
| `strict` | `false` | Fail the build when a wireframe has problems, instead of listing them on the page. Good for CI. |

## Zoom

A docs column shrinks a wide board: a three-screen flow shows at about a third of its size, too small to read. With `zoom` (on by default for those boards), a reader clicks the board to see it properly, in one of two ways:

- **The viewer**, when the page loads `remark-tsquare/client` (a 3 KB script, compressed; MDX pages in Docusaurus and other bundled MDX sites load it on their own; Astro needs one line, see above): zoom with pinch, ⌘/Ctrl + scroll or the buttons, drag to pan, a button per screen to jump to it, Esc to close. It works on boards a docs site swaps in without reloading, too.
- **Full size, with no script:** the board covers the window at its real size, to scroll around in; Esc, Close or a click on the board puts it back. It's plain HTML and CSS (a [popover](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)), so it costs nothing until it's used. Browsers from before 2024 show the board without it.

The script reads the board from the image already on the page, so the viewer adds no download beyond itself.

## What it makes

A board:

```html
<figure class="tsquare-board">
  <img src="data:image/svg+xml,…" alt="Wireframe: Sign in" width="766" height="1060" style="max-width:100%;height:auto">
</figure>
```

The image is the board's SVG, inside the page itself. Its `width` and `height` keep the page from jumping while it loads, and the inline style shrinks a wide board to fit your column. The alt text comes from the board's title.

A board that zooms wraps the same image in a button inside a popover, lists its screens for the viewer, and the page gets one `<style>` for the full-size view:

```html
<figure class="tsquare-board" data-tsquare-screens="[…]">
  <div popover="auto" id="tsquare-1x2y3z-0" class="tsquare-zoom">
    <button type="button" class="tsquare-open" popovertarget="tsquare-1x2y3z-0" aria-label="Show wireframe: sign-up flow at full size">
      <img …><span class="tsquare-badge">…</span>
    </button>
    <button type="button" class="tsquare-close" popovertarget="tsquare-1x2y3z-0" popovertargetaction="hide">Close</button>
  </div>
  <figcaption class="tsquare-caption"><a class="tsquare-link" href="https://tsquare.dev/playground#y…">Open in playground</a></figcaption>
</figure>
```

The caption is there with `link`.

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

A board is about 120–250 KB of SVG, 30–70 KB once the server compresses the page. Docusaurus also puts each page's content in a JavaScript file that the browser loads with the page, so there a board is downloaded twice. Keep that in mind on pages with many boards. Zoom adds about 1 KB per board and a 1.5 KB style block per page (before compression) and, with the viewer, a 3 KB script (compressed).

## Links

- [The tsquare language](https://tsquare.dev/docs)
- [Playground](https://tsquare.dev/playground): write a wireframe and see it as you type
- [Changelog](https://github.com/tsquare-js/markdown/blob/main/CHANGELOG.md)

## License

MIT

# markdown-it-tsquare

A [markdown-it](https://github.com/markdown-it/markdown-it) plugin that turns ```` ```tsquare ```` code blocks into wireframe images when your site is built. [tsquare](https://tsquare.dev) is a plain-text language for UI wireframes: screens, components and notes, laid out on a board.

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

Works with VitePress, Eleventy and anything else that renders with markdown-it. For Docusaurus, Astro and MDX, use [`remark-tsquare`](https://github.com/tsquare-js/markdown/tree/main/packages/remark-tsquare#readme); both make the same HTML.

## Install

```bash
npm install markdown-it-tsquare
```

Node 20 or newer. The package is ESM; CommonJS can `require()` it on Node 20.19+ and 22.12+.

## Use it

### VitePress

In `.vitepress/config.mjs`:

```js
import tsquare from "markdown-it-tsquare";

export default {
  markdown: {
    config: (md) => md.use(tsquare),
  },
};
```

For the zoom viewer, import its script in your theme, `.vitepress/theme/index.js` (create it if you use the default theme):

```js
import DefaultTheme from "vitepress/theme";
import "markdown-it-tsquare/client";

export default DefaultTheme;
```

Without it, readers can still open a board at full size.

### Eleventy

In `eleventy.config.js`:

```js
import tsquare from "markdown-it-tsquare";

export default function (eleventyConfig) {
  eleventyConfig.amendLibrary("md", (md) => md.use(tsquare));
}
```

In a CommonJS config, `const tsquare = require("markdown-it-tsquare").default;`.

For the zoom viewer, copy its script into the site and load it from your layout. `client.standalone.js` is the script with the viewer built in, for sites without a bundler:

```js
eleventyConfig.addPassthroughCopy({ "node_modules/markdown-it-tsquare/dist/client.standalone.js": "tsquare-zoom.js" });
```

```html
<script type="module" src="/tsquare-zoom.js"></script>
```

### markdown-it

```js
import MarkdownIt from "markdown-it";
import tsquare from "markdown-it-tsquare";

const md = new MarkdownIt().use(tsquare);
const html = md.render(markdown, { path: "docs/intro.md" });
```

The second argument to `render` is markdown-it's `env`: give each page its own (a new object per call is the default), and put the file's path in `env.path` for the build log. markdown-it renders synchronously and tsquare's renderer is async, so boards are drawn in a worker thread that the render waits for: it starts with the first board (about 0.3 s), then each board takes 15–90 ms. Boards whose text hasn't changed come from a cache, so a dev server redraws only what you edit.

## Options

```js
md.use(tsquare, { zoom: true, link: true, strict: true });
```

| Option | Default | |
|---|---|---|
| `zoom` | `"auto"` | Let readers open a board at full size (see [Zoom](#zoom)). `"auto"`: boards wider than 800px, the ones a docs column shrinks. `true`: every board. `false`: none. |
| `link` | `false` | An "Open in playground" link under each board, which opens it in [the playground](https://tsquare.dev/playground) in a new tab. `true` for tsquare.dev, or the address of a playground you host. The wireframe goes in the link after the `#`, which browsers don't send to the server. |
| `flows` | `true` | Draw the flow arrows between screens. Off, a board looks exactly as if it had no `flow` lines. |
| `strict` | `false` | Fail the build when a wireframe has problems, instead of listing them on the page. Good for CI. |

## Zoom

A docs column shrinks a wide board: a three-screen flow shows at about a third of its size, too small to read. With `zoom` (on by default for those boards), a reader clicks the board to see it properly, in one of two ways:

- **The viewer**, when the page loads `markdown-it-tsquare/client` (a 3 KB script, compressed; see your site above): zoom with pinch, ⌘/Ctrl + scroll or the buttons, drag to pan, a button per screen to jump to it, Esc to close. It works on boards a docs site swaps in without reloading, too.
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

A board that zooms wraps the same image in a button inside a popover and lists its screens for the viewer; the page's first such board brings one stylesheet for the full-size view, as a `<link>` with the CSS inside it (VitePress drops a page's `<style>`). How it looks in the page is in inline styles (left out below), so it shows whatever happens to that stylesheet:

```html
<link rel="stylesheet" href="data:text/css,…">
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

They're also printed in the build log with the file and line (`docs/intro.md:26:1: tsquare: …`; VitePress and Eleventy pass the file to markdown-it). With `strict`, the first problem fails the build instead.

Both are plain HTML with stable class names, so your site's CSS can style them. The board image itself is always light, like a printed wireframe.

## Size

A board is about 120–250 KB of SVG, 30–70 KB once the server compresses the page. VitePress also puts each page's content in a JavaScript file, loaded only when a reader moves to that page inside the site, so a board is downloaded once either way. Zoom adds about 1 KB per board and a 1.5 KB stylesheet per page (before compression) and, with the viewer, a 3 KB script (compressed).

## Links

- [The tsquare language](https://tsquare.dev/docs)
- [Playground](https://tsquare.dev/playground): write a wireframe and see it as you type
- [Changelog](https://github.com/tsquare-js/markdown/blob/main/CHANGELOG.md)

## License

MIT

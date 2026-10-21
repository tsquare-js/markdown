# Changelog

The packages in this repo share one version number and are released together.

## Unreleased

- **`remark-tsquare`:** turns ```` ```tsquare ```` code blocks into wireframe images at build time, for Docusaurus, Astro, MDX and anything on unified. Each board becomes a `<figure class="tsquare-board">` with the SVG inside an `<img>` (a data: URL, with width, height and alt text); a block with problems lists them in its place by line, and prints them in the build log with the file and line. Options: `flows` (draw flow arrows, default on) and `strict` (fail the build on a problem).
- **Zoom (`zoom`, default `"auto"`):** readers can open a board that a docs column shrinks. With no script, it covers the window at full size (a popover styled to sit in the page; Esc, Close or a click puts it back). With `remark-tsquare/client` (3 KB compressed), it opens in tsquare's viewer: zoom, pan, pinch, a button per screen. MDX pages import the script on their own, so Docusaurus needs no setup; Astro loads it from a layout `<script>`. `"auto"` means boards wider than 800px; `true` every board, `false` none.
- **`markdown-it-tsquare`:** the same for VitePress, Eleventy and anything on markdown-it, with the same HTML, options and zoom script. markdown-it renders synchronously, so boards are drawn in a worker thread the render waits for (synckit; about 0.3 s to start, then 15–90 ms a board, with a cache for dev servers). The zoom styles come as a `<link>` with the CSS inside it, since VitePress drops a page's `<style>`.
- **`client.standalone.js`** in both packages: the zoom script with the viewer built in, for sites without a bundler (Eleventy).
- **Boards that zoom show without the page's stylesheet:** how they look in the page is in inline styles, and the stylesheet only does the full-size view. (VitePress drops a page's `<style>`, and the browser hides a closed popover, so these boards were invisible after navigating inside a VitePress site.)
- **`link`** (default off): an "Open in playground" link under each board, to tsquare.dev or your own playground, with the wireframe after the `#`.

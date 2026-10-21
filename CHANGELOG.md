# Changelog

The packages in this repo share one version number and are released together.

## Unreleased

- **`remark-tsquare`:** turns ```` ```tsquare ```` code blocks into wireframe images at build time, for Docusaurus, Astro, MDX and anything on unified. Each board becomes a `<figure class="tsquare-board">` with the SVG inside an `<img>` (a data: URL, with width, height and alt text); a block with problems lists them in its place by line, and prints them in the build log with the file and line. Options: `flows` (draw flow arrows, default on) and `strict` (fail the build on a problem).
- **Zoom (`zoom`, default `"auto"`):** readers can open a board that a docs column shrinks. With no script, it covers the window at full size (a popover styled to sit in the page; Esc, Close or a click puts it back). With `remark-tsquare/client` (3 KB compressed), it opens in tsquare's viewer: zoom, pan, pinch, a button per screen. MDX pages import the script on their own, so Docusaurus needs no setup; Astro loads it from a layout `<script>`. `"auto"` means boards wider than 800px; `true` every board, `false` none.
- **`link`** (default off): an "Open in playground" link under each board, to tsquare.dev or your own playground, with the wireframe after the `#`.

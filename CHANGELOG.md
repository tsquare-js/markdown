# Changelog

The packages in this repo share one version number and are released together.

## 0.2.0

- **Needs tsquare 0.13.2 or later** (it was 0.12.2). Boards get tsquare's renderer fixes from 0.12.3 to 0.13.2.
- **A board's image size and its zoom view's screen buttons are exact** on boards with notes: they come from tsquare's `measureBoardLayout`, which measures notes as drawn, next to the SVG (in markdown-it-tsquare's worker). `boardLayout`'s estimate could be a line or more off for a note that wraps differently than its length suggests, so the image was scaled into a slightly wrong box.

## 0.1.1

- **Works with tsquare 0.13** as well as 0.12 (from 0.12.2). A site that installs tsquare 0.13 now shares one copy with the plugins instead of getting a second one. Nothing else changed; the tests pass on both 0.12.2 and 0.13.0.

## 0.1.0

The first release: two plugins that turn ```` ```tsquare ```` code blocks into wireframe images when a site is built. They make the same HTML and take the same options. Node 20 or newer; they use `tsquare` 0.12.2 or later in 0.12.

- **`remark-tsquare`:** for Docusaurus, Astro, MDX and anything on unified.
- **`markdown-it-tsquare`:** for VitePress, Eleventy and anything on markdown-it. markdown-it renders synchronously, so boards are drawn in a worker thread the render waits for (about 0.3 s to start, then 15–90 ms a board).
- **Boards:** each becomes a `<figure class="tsquare-board">` with the board's SVG inside an `<img>` (a data: URL, with width, height and alt text from the board's title). Nothing is sent anywhere. Boards are cached by their text, so dev servers redraw only what changed.
- **Problems:** a block with problems lists them in its place by line, and the build log shows them with the file and line. `strict: true` fails the build instead.
- **Zoom (`zoom`, default `"auto"`):** readers can open a board that a docs column shrinks (`"auto"`: boards wider than 800px; `true`: every board; `false`: none).
  - **Without a script:** it covers the window at full size, using a popover that sits in the page until it's opened (Esc, Close or a click puts it back).
  - **With the zoom script** (`<package>/client`, 3 KB compressed): it opens in tsquare's viewer, with zoom, pan, pinch and a button per screen.
  - **Loading the script:** MDX pages import it on their own, so Docusaurus needs no setup. VitePress imports it in the theme, Astro in a layout `<script>`, and Eleventy loads `client.standalone.js` (the viewer built in) with a `<script>` tag.
- **`link`** (default off): an "Open in playground" link under each board, to tsquare.dev or your own playground, with the wireframe after the `#`.
- **`flows`** (default on): draw the flow arrows between screens.

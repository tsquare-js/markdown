# Changelog

The packages in this repo share one version number and are released together.

## Unreleased

- **`remark-tsquare`:** turns ```` ```tsquare ```` code blocks into wireframe images at build time, for Docusaurus, Astro, MDX and anything on unified. Each board becomes a `<figure class="tsquare-board">` with the SVG inside an `<img>` (a data: URL, with width, height and alt text); a block with problems lists them in its place by line, and prints them in the build log with the file and line. Options: `flows` (draw flow arrows, default on) and `strict` (fail the build on a problem).

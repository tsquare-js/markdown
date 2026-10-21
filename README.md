# tsquare for Markdown

Plugins that turn ```` ```tsquare ```` code blocks into wireframe images when a Markdown site is built. [tsquare](https://tsquare.dev) is a plain-text language for UI wireframes.

| Package | For |
|---|---|
| [`remark-tsquare`](packages/remark-tsquare) | Docusaurus, Astro, MDX, anything on unified |
| [`markdown-it-tsquare`](packages/markdown-it-tsquare) | VitePress, Eleventy, anything on markdown-it |

Both make the same HTML. The boards are drawn on the machine that builds the site and land in the page as images, and nothing is sent anywhere. Readers can open a wide board at full size, or in a viewer with zoom and pan when the site loads the packages' small script. For sites without a build step, tsquare also has [a script for any web page](https://tsquare.dev/docs/embedding#pages-written-in-markdown).

Contributing and releases: [CONTRIBUTING.md](CONTRIBUTING.md).

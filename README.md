# tsquare for Markdown

Plugins that turn ```` ```tsquare ```` code blocks into wireframe images when a Markdown site is built. [tsquare](https://tsquare.dev) is a plain-text language for UI wireframes.

| Package | For |
|---|---|
| [`remark-tsquare`](packages/remark-tsquare) | Docusaurus, Astro, MDX, anything on unified |
| `markdown-it-tsquare` (coming soon) | VitePress, Eleventy, anything on markdown-it |

The boards are drawn on the machine that builds the site and land in the page as images: nothing runs in the reader's browser, and nothing is sent anywhere. For sites without a build step, tsquare also has [a script for any web page](https://tsquare.dev/docs/embedding#pages-written-in-markdown).

Contributing and releases: [CONTRIBUTING.md](CONTRIBUTING.md).

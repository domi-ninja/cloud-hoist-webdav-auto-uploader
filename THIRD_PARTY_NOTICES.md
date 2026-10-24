# Third-party notices

The app bundles an offline inventory at `assets/third-party-notices.json`, available from Settings → About → Open source licenses. It includes JavaScript packages, resolved Android runtime dependencies, and the two bundled font families. Build-only packages can also appear because Expo's production dependency graph includes its tooling.

`scripts/fdroid/licenses.mjs` generates the inventory from installed packages and the evidence under `licenses/`. Run `pnpm licenses:generate` after a dependency change and `pnpm licenses:check` to verify it. The collector records published Maven POMs and embedded notices; npm supplements use pinned upstream commits when available. `licenses/declarations.json` retains package declarations and README notices for packages that omit standalone license files. Those fallbacks remain visible review items, rather than a claim that a scanner has audited every file.

Material Symbols and Material Design Icons fonts use Apache-2.0. Their notices and license text are under `licenses/`. The app icon's editable source is `assets/icon.svg`, distributed under this repository's GPL-3.0-or-later license. Listing screenshots use app-owned or test-owned content and the same license.

## Expo blank template

The initial project structure and placeholder image assets derive from the Expo blank template.

Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

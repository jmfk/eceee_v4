# Designer Theme Workspace

The Designer workspace is a restricted visual editor at `/designer/themes`. It is separate from the advanced Theme editor and permits only asset, palette, typography, margin, and padding changes.

Tenant administrators assign an existing user from the **Designer access** section of an advanced Theme edit screen. A designer-only user must not also be added to `Tenant.members`; the assignment grants access only to the selected theme and the Designer APIs.

Edits remain local while the server generates debounced preview CSS. **Save live changes** applies the allowlisted patch immediately and uses the loaded theme version to detect conflicting edits. Each successful mutation records a recoverable revision; the newest 20 revisions are retained and **Undo** restores the prior visual settings and asset references.

## Image sizing and placeholders

Upload the original full-resolution image. The stored pixel dimensions and the configured DPR determine which 1× and 2× renditions can be delivered. Imgproxy downsizes originals; it does not make an undersized source suitable for a larger rendition.

Asset requests can specify a descriptive name, exact full-size width and height, and DPR. The generated PNG burns the name, usage, and dimensions into the image. Explicitly undersized replacements are rejected. Older slots without an explicit specification show a breakpoint-based width recommendation and “height not specified”; undersizing those recommendations produces a warning.

## Designer Export

**Export** starts a background job and produces a one-way ZIP. It contains original image bytes plus `designer-asset-book.pdf`; it contains no settings files, import metadata, or font binaries and cannot be imported as a theme.

The asset book is rendered from escaped server HTML and the real theme CSS by the Playwright service. If that service is unavailable, the backend produces a simpler PDF containing the same required inventory sections. Export downloads expire after 24 hours.

The Playwright service must expose its internal `POST /render-pdf` endpoint at `PLAYWRIGHT_SERVICE_URL`. The endpoint disables JavaScript and permits network requests only to Google Fonts domains.

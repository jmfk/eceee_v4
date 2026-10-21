# Designer Theme Workspace

The Designer workspace is a restricted visual editor at `/designer/themes`. It is separate from the advanced Theme editor and permits only asset, palette, typography, margin, and padding changes.

Tenant administrators assign an existing user from the **Designer access** section of an advanced Theme edit screen. A designer-only user must not also be added to `Tenant.members`; the assignment grants access only to the selected theme and the Designer APIs.

Edits remain local while the server generates debounced preview CSS. **Save draft** persists approved value changes without updating the live theme. Asset uploads use immutable draft-specific object keys and are also invisible to the live theme. **Publish changes** verifies the draft and live-theme versions, records one recoverable revision, and swaps every staged field and asset reference into the live theme in one database transaction. **Undo publish** restores and consumes the latest revision when the shared draft is clean. **Discard draft** resets the shared theme draft to current live state.

Preview copy is generated locally from the configured font families, variants, and typography values. Longer passages use deterministic filler text for the current document or browser language; the Designer preview does not call an AI service.

The draft is shared by all assigned designers for the theme. If another designer changes the draft, or an administrator changes the live theme after the draft starts, stale requests are rejected instead of overwriting newer work. Unused library assets are read-only in the draft workflow because replacing their fixed object keys cannot share the database transaction boundary.

## Image sizing and placeholders

Upload the original full-resolution image. The stored pixel dimensions and the configured DPR determine which 1× and 2× renditions can be delivered. Imgproxy downsizes originals; it does not make an undersized source suitable for a larger rendition.

Asset requests can specify a descriptive name, exact full-size width and height, and DPR. The generated PNG burns the name, usage, and dimensions into the image. Explicitly undersized replacements are rejected. Older slots without an explicit specification show a breakpoint-based width recommendation and “height not specified”; undersizing those recommendations produces a warning.

## Designer Export

**Export** snapshots the current Designer draft, starts a background job, and produces a one-way ZIP. It contains original image bytes plus `designer-asset-book.pdf`; it contains no settings files, import metadata, or font binaries and cannot be imported as a theme.

The asset book is rendered from escaped server HTML and the real theme CSS by the Playwright service. If that service is unavailable, the backend produces a simpler PDF containing the same required inventory sections. Export creation is limited to 10 requests per user per hour. Downloads expire after 24 hours, and an hourly maintenance task deletes expired ZIP objects and database snapshots. Immutable draft assets are deleted after they are no longer referenced by the live theme, current draft, a revision, or an export snapshot.

The Playwright service must expose its internal `POST /render-pdf` endpoint at `PLAYWRIGHT_SERVICE_URL`. The endpoint disables JavaScript and permits network requests only to Google Fonts domains.


## Text outline styles

Open **Designer → theme → Text outline styles** to create named, theme-wide text effects. Styles support Outline, Gradient blur (a soft halo), and Drop shadow. Choose the text's own color, white, black, its RGB complement, or a custom RGB color. Thickness and opacity are shared; blur radius applies to soft effects, and drop shadows also expose clockwise angle (0° points right) and pixel offset. Light and dark samples update immediately.

Changes use the normal Designer draft, publish and undo flow. Select the named effect with the banner's Text outline icon or its configuration field. Display names can change without breaking references. Removing a style offers Undo; widgets referencing a missing style render without an effect. No outline is always available without a theme definition. New themes and existing empty themes receive editable Dark outline and Light outline presets; non-empty preset dictionaries are preserved. Banners use the theme definitions even for dark/light selections. Styles travel with theme versions, clones and exports.

The additive `0087` theme migration must run before starting a publisher version that reads `text_outline_styles`.

Migration `0088` initializes these defaults for empty themes and their empty Designer drafts without changing custom presets.

If the live theme changed after a saved Designer draft was started, **Save draft** still preserves new theme setting edits, including outlines. Publishing remains blocked while that draft is stale. Saving retains the previous draft edits and does not change live data. Export the draft before discarding it if that work must be kept.

To use a saved outline in page editing, choose **Publish outlines** in the Text outline styles section. Save draft alone keeps it in Designer. The scoped action publishes only outline differences, preserves independent live styles and other draft edits, and rejects conflicting edits to the same style. The page editor refreshes published outlines when you return from Designer. Whole-draft publication remains blocked for stale drafts.

# Theme-owned widget types

Designers can create content widget types without deploying application code. Open **Designer → a theme → Widget types**. The editor supports visual field definitions, HTML/Mustache, CSS and saved example data. Preview runs in a sandboxed iframe with a selectable viewport; media queries use the actual frame width.

## Author and publish

1. Create a type and name its fields using camelCase keys.
2. Configure text, multiline text, rich text, image, URL, number, boolean or choice fields.
3. Write a Mustache template using those keys and ordinary CSS selectors. For example:

```html
<article class="person-card">
  <h2>{{personName}}</h2>
  {{#portrait}}<img src="{{url}}" alt="{{alt}}">{{/portrait}}
  <div>{{{biography}}}</div>
</article>
```

```css
.person-card { padding: 24px; }
@media (min-width: 768px) { .person-card { max-width: 640px; } }
```

4. Save the shared Designer draft. Saved drafts survive reloads and remain unavailable to live content.
5. Review the changed theme areas, then choose **Publish theme**. This publishes the complete shared draft, including other Designer edits.

Use a rich-text field for `biography`. HTML is sanitized after substitution, including triple-brace substitutions. Image fields expose normalized `url` and `alt` properties. Templates cannot execute JavaScript or load external Mustache partials. CSS is parsed and scoped to one type revision; external CSS resources and global at-rules are rejected.

## Use and upgrade

Published active types appear in widget selection on pages and objects, subject to the existing slot restrictions. Pages use their effective theme; objects use the tenant's default theme. Embedded object widgets carry definitions from the tenant default theme even when the containing page uses a different theme. Shared page colors and fonts still apply.

New instances select the active published revision. Each instance stores its own content and an explicit type revision. Publishing a later revision does not alter existing instances. Open an instance and choose **Upgrade to version …** to review the new fields, retained values, removed values and validation errors. The upgrade applies only when **Save widget** succeeds. There is no bulk upgrade in v1.

Archiving hides a type from new selection while keeping existing instances readable and editable. Themes containing published widget types cannot be deleted; archive types instead. Theme changes are rejected when the target lacks matching referenced revisions. Working copies inherit draft ancestors; published and scheduled versions use the published chain at the relevant time. Validation covers known ancestor activation and expiry boundaries throughout a scheduled version’s active interval, including rescheduling. Theme-wide fonts, colors and design rules remain shared rather than version-pinned.

## Storage and API

- Definitions live in `PageTheme.widget_types`: `{ "version": 1, "items": [...] }`.
- Type keys are `theme_widgets.<uuid>`. Released schema, template, source CSS, compiled CSS and defaults are immutable numbered revisions.
- A draft-only `working` definition becomes a new release at publication; unchanged definitions do not create duplicate releases.
- Instances use `type_version` in persistence/backend and `typeVersion` in JavaScript. User field keys stay camelCase, with explicit parser-boundary normalization.
- Existing widget-type list/detail/schema/default/validation endpoints accept `theme_id`; pinned lookups accept `type_version`. Omitting a version does not make an unpinned persisted instance render as latest.
- `POST /api/v1/webpages/designer/themes/{id}/widget-preview/` accepts `typeId` and an unsaved `definition`, checks Designer access and returns compiled presentation without saving it.
- Types and schema lookups are scoped to tenant/theme/revision. They never mutate the global code widget registry.
- Theme snapshots, packages and file synchronization include the widget document. Restoring a theme selects the restored active revision while retaining newer immutable releases needed by existing content. Types absent from the restored snapshot are archived.

The additive migration is `webpages.0087_pagetheme_widget_types`. Existing themes receive an empty document; existing code widgets and their instance data are unchanged. Migration `webpages.0089_merge_theme_widgets_and_outlines` joins the widget and text-outline migration branches without additional data changes.

## Verification

Focused coverage lives in `webpages.tests.test_theme_widgets`, `webpages.tests.test_theme_widget_integration`, frontend theme widget render/author/upgrade tests and `publisher/tests/theme-widgets.test.ts`. The implementation batch also checks existing theme-version tests, code widget registry parity, nested editor operations, page rendering and publisher model normalization.

Live browser verification on 2026-10-21 used real authentication, an isolated PostgreSQL database, the Django API and the Next publisher, without mocked API responses. It covered:

- Visual field authoring with a camelCase key, draft save/reload and theme publication.
- Page and object instance save/reopen and published Next rendering.
- Revision 2 publication retaining revision 1 on existing instances; new instances selecting revision 2.
- Explicit upgrade showing removed values and rejecting a missing required field before saving.
- Archiving hiding new selection while preserving existing rendering and editing.
- An incompatible page-theme change being rejected without losing saved content.
- Person-card and fact-box rendering at 375px and 1280px without horizontal overflow, plus reachable instance-editor save controls at both widths.

The live check found slot toolbars overlapping the new instance editor. Its layer now matches the existing widget editor panel; ordinary browser clicks successfully save page and object instances. Focused instance-editor and widget-panel tests also pass. Production migration/deployment remains subject to the repository's separate owner gates.

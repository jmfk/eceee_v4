"""Generate one-way designer theme packages with an indexed PDF asset book."""

import base64
import copy
import html
import io
import logging
import os
import re
import zipfile
from collections import Counter
from datetime import timedelta
from urllib.parse import quote_plus

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image

from file_manager.storage import S3MediaStorage, system_storage
from webpages.services.designer_theme import (
    apply_designer_snapshot,
    build_workspace,
    collect_designer_assets,
    delete_unreferenced_designer_assets,
    designer_snapshot_asset_paths,
    generate_placeholder_png,
)

logger = logging.getLogger(__name__)


def designer_export_filename(theme):
    return f"{slugify(theme.name) or 'theme'}-designer-export.zip"


def designer_export_object_key(job):
    return f"theme-designer-exports/{job.theme_id}/{job.id}/{designer_export_filename(job.theme)}"


def cleanup_expired_designer_exports(now=None, batch_size=200, storage=None):
    """Delete expired export objects and their database snapshots in bounded batches."""
    from webpages.models import ThemeDesignerExportJob

    now = now or timezone.now()
    storage = storage or S3MediaStorage()
    jobs = list(ThemeDesignerExportJob.objects.filter(expires_at__lte=now).order_by("expires_at")[:batch_size])
    removed = 0
    cleanup_paths = {}
    for job in jobs:
        try:
            if job.object_key and storage.exists(job.object_key):
                storage.delete(job.object_key)
        except Exception:
            logger.exception("Could not remove expired Designer export %s", job.id)
            continue
        cleanup_paths.setdefault(job.theme_id, set()).update(designer_snapshot_asset_paths(job.snapshot, job.theme_id))
        job.delete()
        removed += 1

    for theme_id, paths in cleanup_paths.items():
        delete_unreferenced_designer_assets(theme_id, paths)
    return removed


def _safe_part(value, fallback="asset"):
    return slugify(str(value or "")) or fallback


def _storage_path(asset):
    url = asset.get("url")
    if not url:
        return None
    if str(url).startswith("s3://"):
        parts = str(url).replace("s3://", "", 1).split("/", 1)
        return parts[1] if len(parts) == 2 else None
    marker = "theme_images/"
    if marker in str(url):
        return str(url)[str(url).find(marker) :].split("?", 1)[0]
    return None


def _read_asset(theme, asset):
    key = asset["assetKey"]
    if key == "preview" and theme.image:
        with theme.image.open("rb") as source:
            return source.read()
    if key == "site-icon" and theme.site_icon:
        with theme.site_icon.open("rb") as source:
            return source.read()
    path = _storage_path(asset)
    if path and system_storage.exists(path):
        with system_storage.open(path, "rb") as source:
            return source.read()
    if asset.get("isPlaceholder") or (asset.get("requiredWidth") and asset.get("requiredHeight")):
        return generate_placeholder_png(
            asset.get("displayName") or "Missing asset",
            ", ".join(asset.get("usage") or []),
            asset.get("requiredWidth"),
            asset.get("requiredHeight"),
        )
    return None


def _zip_path(asset):
    extension = os.path.splitext(asset.get("filename") or "")[1].lower() or ".png"
    name = _safe_part(asset.get("displayName") or os.path.splitext(asset.get("filename") or "")[0])
    if asset["kind"] == "preview":
        return f"images/preview/{name}{extension}"
    if asset["kind"] == "site-icon":
        return f"images/site-icon/{name}{extension}"
    if asset["kind"] == "design-group":
        usage = f"{asset.get('part')}-{asset.get('breakpoint')}-{asset.get('property')}"
        group = _safe_part((asset.get("usage") or ["design-group"])[0].split(" / ")[0])
        return f"images/design-groups/{group}/{_safe_part(usage)}{extension}"
    folder = "unused" if "Unused theme library asset" in (asset.get("usage") or []) else "library"
    return f"images/{folder}/{name}{extension}"


def _deduplicate_paths(rows):
    counts = Counter()
    for row in rows:
        original = row["zipPath"]
        counts[original.lower()] += 1
        if counts[original.lower()] > 1:
            stem, extension = os.path.splitext(original)
            row["zipPath"] = f"{stem}-{counts[original.lower()]}{extension}"


def _thumbnail_data_uri(content):
    try:
        image = Image.open(io.BytesIO(content))
        image.thumbnail((280, 180))
        output = io.BytesIO()
        image.convert("RGB").save(output, format="JPEG", quality=78)
        return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")
    except Exception:
        return ""


def _contrast_label(value):
    match = re.fullmatch(r"#([0-9a-fA-F]{6})", str(value or ""))
    if not match:
        return "Review contrast manually"
    raw = match.group(1)
    channels = [int(raw[index : index + 2], 16) / 255 for index in (0, 2, 4)]
    luminance = sum(
        weight * (channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4)
        for weight, channel in zip((0.2126, 0.7152, 0.0722), channels)
    )
    white = 1.05 / (luminance + 0.05)
    black = (luminance + 0.05) / 0.05
    return f"Black {black:.1f}:1 / White {white:.1f}:1"


def build_asset_book_html(theme, rows):
    workspace = build_workspace(theme)
    font_url = theme.get_google_fonts_url()
    font_import = f"@import url('{html.escape(font_url)}');" if font_url else ""
    asset_cards = []
    for row in rows:
        asset = row["asset"]
        size = f"{asset.get('width') or '?'} x {asset.get('height') or '?'} px"
        required = (
            f"{asset.get('requiredWidth') or '?'} x {asset.get('requiredHeight') or '?'} px @ {asset.get('dpr', 2)}x"
        )
        thumbnail = (
            f'<img src="{row["thumbnail"]}" alt="">'
            if row.get("thumbnail")
            else '<div class="missing">No preview</div>'
        )
        warning_html = (
            "<p class='warning'>Placeholder or missing artwork</p>"
            if asset.get("isPlaceholder") or not asset.get("url")
            else ""
        )
        asset_cards.append(
            f"""
          <article class="asset-card">{thumbnail}<div><h3>{html.escape(asset.get('displayName') or 'Asset')}</h3>
          <p><b>File:</b> {html.escape(row['zipPath'])}</p>
          <p><b>Usage:</b> {html.escape(', '.join(asset.get('usage') or []))}</p>
          <p><b>Actual:</b> {size} &nbsp; <b>Required:</b> {required}</p>
          {warning_html}
          </div></article>"""
        )
    color_rows = []
    for color in workspace["colors"]:
        escaped_value = html.escape(str(color["value"]))
        color_rows.append(
            f'<tr><td><span class="swatch" style="background:{escaped_value}"></span>'
            f'{html.escape(color["name"])}</td><td>{escaped_value}</td>'
            f'<td>{html.escape(_contrast_label(color["value"]))}</td>'
            f'<td>{html.escape(", ".join(color["usage"]) or "Unused")}</td></tr>'
        )
    color_rows = "".join(color_rows)
    font_cards = (
        "".join(
            f'<article class="font-card" style="font-family:{html.escape(font.get("family", "sans-serif"))},'
            f'sans-serif"><h3>{html.escape(font.get("family", "Font"))}</h3>'
            f'<p>Variants: {html.escape(", ".join(map(str, font.get("variants") or [])))}</p>'
            f'<p>Usage: {html.escape(", ".join(font.get("usage") or []) or "Not assigned")}</p>'
            f'<p><a href="https://fonts.google.com/specimen/{quote_plus(font.get("family", ""))}">'
            'Google Fonts reference</a></p><div class="font-sample">'
            "The quick brown fox jumps over the lazy dog.</div></article>"
            for font in workspace["fonts"]
        )
        or "<p>No external fonts configured.</p>"
    )
    type_rows = []
    for row in workspace["typography"]:
        settings_text = ", ".join(f"{key}: {value}" for key, value in row["values"].items() if value) or "Defaults"
        type_rows.append(
            f'<tr><td>{html.escape(row["groupName"])}</td><td>{html.escape(row["element"])}</td>'
            f"<td>{html.escape(settings_text)}</td></tr>"
        )
    type_rows = "".join(type_rows)
    type_samples = []
    css_names = {
        "fontFamily": "font-family",
        "fontSize": "font-size",
        "fontWeight": "font-weight",
        "fontStyle": "font-style",
        "lineHeight": "line-height",
        "letterSpacing": "letter-spacing",
    }
    for row in workspace["typography"]:
        declarations = []
        for key, value in row["values"].items():
            value = str(value or "").strip()
            if key in css_names and value and not re.search(r"[;{}<>]|url\s*\(|@import", value, re.IGNORECASE):
                declarations.append(f"{css_names[key]}:{html.escape(value, quote=True)}")
        type_samples.append(
            f'<article class="font-card"><b>{html.escape(row["groupName"])} / {html.escape(row["element"])}</b>'
            f'<div style="{";".join(declarations)}">The quick brown fox jumps over the lazy dog.</div></article>'
        )
    spacing_rows = []
    for row in workspace["spacing"]:
        settings_text = ", ".join(f"{key}: {value}" for key, value in row["values"].items() if value) or "Defaults"
        spacing_rows.append(
            f'<tr><td>{html.escape(row["groupName"])}</td>'
            f'<td>{html.escape(row.get("element") or row.get("part") or "")}</td>'
            f'<td>{html.escape(row.get("breakpoint", ""))}</td><td>{html.escape(settings_text)}</td></tr>'
        )
    spacing_rows = "".join(spacing_rows)
    preview_css = theme.generate_css(".designer-preview")
    generated_at = timezone.localtime().strftime("%Y-%m-%d %H:%M %Z")
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
      {font_import}
      @page {{ size: A4; margin: 16mm 14mm; }}
      * {{ box-sizing: border-box; }}
      body {{ color:#111827; font: 10pt Arial,sans-serif; line-height:1.4; }}
      h1 {{ font-size:24pt; margin:0 0 4mm; }}
      h2 {{ border-bottom:1px solid #9ca3af; padding-bottom:2mm; margin-top:9mm; page-break-after:avoid; }}
      h3 {{ margin:0 0 2mm; }} .meta {{ color:#4b5563; }}
      .asset-card {{ display:grid; grid-template-columns:48mm 1fr; gap:5mm; border-bottom:1px solid #d1d5db;
        padding:4mm 0; break-inside:avoid; }}
      .asset-card img,.missing {{ width:48mm; height:31mm; object-fit:contain; background:#f3f4f6;
        border:1px solid #d1d5db; }}
      .missing {{ display:flex; align-items:center; justify-content:center; }}
      p {{ margin:1mm 0; }} .warning {{ color:#92400e; font-weight:bold; }}
      table {{ width:100%; border-collapse:collapse; font-size:8.5pt; }}
      th,td {{ border:1px solid #d1d5db; padding:2mm; text-align:left; vertical-align:top; }}
      th {{ background:#f3f4f6; }}
      .swatch {{ display:inline-block; width:7mm; height:7mm; border:1px solid #6b7280;
        vertical-align:middle; margin-right:2mm; }}
      .font-card {{ border:1px solid #d1d5db; padding:4mm; margin:3mm 0; break-inside:avoid; }}
      .font-sample {{ font-size:18pt; margin-top:2mm; }}
      .preview-grid {{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:3mm; }}
      .preview {{ border:1px solid #9ca3af; padding:3mm; overflow:hidden; }}
      .preview h3 {{ font-size:10pt; }} .preview.desktop {{ grid-column:span 2; }}
      {preview_css}
    </style></head><body><h1>{html.escape(theme.name)} - Designer Asset Book</h1>
    <p class="meta">Generated {generated_at} - Theme version {theme.sync_version}</p>
    <h2>Asset index</h2>{''.join(asset_cards) or '<p>No theme assets.</p>'}
    <h2>Color map</h2><table><thead><tr>
      <th>Color</th><th>Value</th><th>Contrast</th><th>Usage</th>
    </tr></thead><tbody>{color_rows}</tbody></table>
    <h2>Fonts and usage</h2>{font_cards}
    <h2>Typography</h2><table><thead><tr><th>Group</th><th>Element</th><th>Settings</th></tr></thead>
      <tbody>{type_rows}</tbody></table>{''.join(type_samples)}
    <h2>Margins and padding</h2><table><thead><tr>
      <th>Group</th><th>Element/part</th><th>Breakpoint</th><th>Settings</th>
    </tr></thead><tbody>{spacing_rows}</tbody></table>
    <h2>Representative previews</h2><div class="preview-grid designer-preview">
      <section class="preview desktop"><h3>Desktop</h3><h1>Heading one</h1>
        <p>Representative paragraph with a <a href="#">link</a>.</p><button>Action</button></section>
      <section class="preview"><h3>Tablet</h3><h2>Card heading</h2><p>Card and list preview.</p>
        <ul><li>First item</li><li>Second item</li></ul></section>
      <section class="preview"><h3>Mobile</h3><h3>Compact heading</h3>
        <p>Compact content preview.</p></section>
    </div></body></html>"""


def _render_pdf_fallback(theme, rows):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Image as PDFImage
    from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    output = io.BytesIO()
    styles = getSampleStyleSheet()
    story = [
        Paragraph(f"{html.escape(theme.name)} - Designer Asset Book", styles["Title"]),
        Paragraph(f"Theme version {theme.sync_version}", styles["Normal"]),
        Spacer(1, 5 * mm),
        Paragraph("Asset index", styles["Heading2"]),
    ]
    for row in rows:
        asset = row["asset"]
        thumbnail = row.get("content")
        image_flowable = Paragraph("No preview", styles["Normal"])
        if thumbnail:
            try:
                image_flowable = PDFImage(io.BytesIO(thumbnail), width=45 * mm, height=30 * mm, kind="proportional")
            except Exception:
                pass
        actual = f"{asset.get('width') or '?'} x {asset.get('height') or '?'} px"
        required_width = asset.get("requiredWidth") or asset.get("recommendedWidth") or "?"
        required_height = asset.get("requiredHeight") or "height not specified"
        required = f"{required_width} x {required_height} px @ {asset.get('dpr', 2)}x"
        warning = (
            "<br/><font color='#92400e'><b>Placeholder or missing artwork</b></font>"
            if asset.get("isPlaceholder") or not asset.get("url")
            else ""
        )
        details = Paragraph(
            f"<b>{html.escape(asset.get('displayName') or 'Asset')}</b><br/>{html.escape(row['zipPath'])}"
            f"<br/>{html.escape(', '.join(asset.get('usage') or []))}<br/>Actual: {actual}"
            f"<br/>Required: {required}{warning}",
            styles["BodyText"],
        )
        table = Table([[image_flowable, details]], colWidths=[50 * mm, 120 * mm])
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(table)
    workspace = build_workspace(theme)
    story.extend([PageBreak(), Paragraph("Color map", styles["Heading2"])])
    color_data = [["Name", "Value", "Contrast", "Usage"]] + [
        [item["name"], str(item["value"]), _contrast_label(item["value"]), ", ".join(item["usage"]) or "Unused"]
        for item in workspace["colors"]
    ]
    color_table = Table(color_data, repeatRows=1, colWidths=[32 * mm, 28 * mm, 42 * mm, 68 * mm])
    color_table.setStyle(
        TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.grey), ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey)])
    )
    story.append(color_table)
    story.extend([Spacer(1, 5 * mm), Paragraph("Fonts and usage", styles["Heading2"])])
    for font in workspace["fonts"]:
        family = font.get("family", "Font")
        reference = "https://fonts.google.com/specimen/" + str(family).replace(" ", "+")
        story.append(
            Paragraph(
                f"<b>{html.escape(family)}</b> - "
                f"{html.escape(', '.join(map(str, font.get('variants') or [])))}<br/>"
                f"<link href='{html.escape(reference)}'>Google Fonts reference</link><br/>"
                f"Usage: {html.escape(', '.join(font.get('usage') or []) or 'Not assigned')}<br/>"
                "<font size='16'>The quick brown fox jumps over the lazy dog.</font>",
                styles["BodyText"],
            )
        )
        story.append(Spacer(1, 3 * mm))
    story.extend([Spacer(1, 4 * mm), Paragraph("Typography", styles["Heading2"])])
    typography_data = [["Group", "Element", "Settings"]] + [
        [
            row["groupName"],
            row["element"],
            ", ".join(f"{key}: {value}" for key, value in row["values"].items() if value) or "Defaults",
        ]
        for row in workspace["typography"]
    ]
    typography_table = Table(typography_data, repeatRows=1, colWidths=[42 * mm, 35 * mm, 93 * mm])
    typography_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(typography_table)
    story.extend([Spacer(1, 4 * mm), Paragraph("Margins and padding", styles["Heading2"])])
    spacing_data = [["Group", "Element/part", "Breakpoint", "Settings"]] + [
        [
            row["groupName"],
            row.get("element") or row.get("part") or "",
            row.get("breakpoint", ""),
            ", ".join(f"{key}: {value}" for key, value in row["values"].items() if value) or "Defaults",
        ]
        for row in workspace["spacing"]
    ]
    spacing_table = Table(spacing_data, repeatRows=1, colWidths=[38 * mm, 35 * mm, 27 * mm, 70 * mm])
    spacing_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(spacing_table)
    story.extend(
        [
            PageBreak(),
            Paragraph("Representative previews", styles["Heading2"]),
            Paragraph("Desktop", styles["Heading3"]),
            Paragraph("Heading one", styles["Heading1"]),
            Paragraph(
                "Representative paragraph, link, list, button, card, image, table, header, and footer content.",
                styles["BodyText"],
            ),
            Spacer(1, 4 * mm),
            Paragraph("Tablet", styles["Heading3"]),
            Paragraph("Card heading - representative card and list preview.", styles["BodyText"]),
            Spacer(1, 4 * mm),
            Paragraph("Mobile", styles["Heading3"]),
            Paragraph("Compact heading and content preview.", styles["BodyText"]),
        ]
    )
    SimpleDocTemplate(
        output, pagesize=A4, rightMargin=14 * mm, leftMargin=14 * mm, topMargin=16 * mm, bottomMargin=16 * mm
    ).build(story)
    return output.getvalue()


def render_asset_book_pdf(theme, rows):
    endpoint = getattr(settings, "PLAYWRIGHT_SERVICE_URL", "http://localhost:10107").rstrip("/") + "/render-pdf"
    try:
        response = requests.post(endpoint, json={"html": build_asset_book_html(theme, rows)}, timeout=90)
        response.raise_for_status()
        if response.headers.get("Content-Type", "").startswith("application/pdf"):
            return response.content
    except requests.RequestException:
        pass
    return _render_pdf_fallback(theme, rows)


class ThemeDesignerExporter:
    def __init__(self, job, storage=None):
        self.job = job
        self.storage = storage or S3MediaStorage()

    def run(self):
        self.job.mark_running()
        try:
            export_theme = copy.deepcopy(self.job.theme)
            if self.job.snapshot:
                apply_designer_snapshot(export_theme, self.job.snapshot)
            self.job.progress = {"percent": 10, "message": "Collecting original theme assets"}
            self.job.save(update_fields=["progress", "updated_at"])
            rows = []
            rows_by_source = {}
            for asset in collect_designer_assets(export_theme):
                content = _read_asset(export_theme, asset)
                if content is None:
                    continue
                source_key = _storage_path(asset) or asset.get("url") or asset["assetKey"]
                if source_key in rows_by_source:
                    existing = rows_by_source[source_key]["asset"]
                    existing["usage"] = list(
                        dict.fromkeys([*(existing.get("usage") or []), *(asset.get("usage") or [])])
                    )
                    continue
                row = {
                    "asset": asset,
                    "content": content,
                    "zipPath": _zip_path(asset),
                    "thumbnail": _thumbnail_data_uri(content),
                }
                rows.append(row)
                rows_by_source[source_key] = row
            _deduplicate_paths(rows)
            self.job.progress = {"percent": 55, "message": "Rendering the Designer Asset Book"}
            self.job.save(update_fields=["progress", "updated_at"])
            pdf = render_asset_book_pdf(export_theme, rows)
            package = io.BytesIO()
            with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("designer-asset-book.pdf", pdf)
                for row in rows:
                    archive.writestr(row["zipPath"], row["content"])
            self.job.progress = {"percent": 85, "message": "Uploading the Designer Export"}
            self.job.save(update_fields=["progress", "updated_at"])
            object_key = self.job.object_key or designer_export_object_key(self.job)
            self.storage._save(object_key, ContentFile(package.getvalue()))
            self.job.expires_at = timezone.now() + timedelta(hours=24)
            self.job.save(update_fields=["expires_at", "updated_at"])
            self.job.mark_completed(object_key)
            return object_key
        except Exception:
            stage = (self.job.progress or {}).get("message", "Designer export")
            self.job.mark_failed(f"{stage} failed. Ask an administrator to check the server logs.")
            raise

from __future__ import annotations
from typing import Any, Dict, List


def _esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def render_svg(state: Dict[str, Any], *, width: int = 900, height: int = 520) -> str:
    theme = state.get("theme", "dark")
    comps: List[Dict[str, Any]] = state.get("components", [])

    # Minimal theme palette (inline, deterministic)
    if theme == "light":
        bg = "#f6f7fb"
        panel = "#ffffff"
        stroke = "#111827"
        accent = "#2563eb"
        text = "#111827"
    else:
        bg = "#020409"
        panel = "#050a14"
        stroke = "#16f2aa"
        accent = "#00ffd0"
        text = "#cfeee6"

    # Layout
    x0, y0 = 24, 24
    pad = 16
    row_h = 56

    parts: List[str] = []
    parts.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'  # noqa: E501
    )
    parts.append(f'<rect x="0" y="0" width="{width}" height="{height}" fill="{bg}"/>')
    parts.append(
        f'<rect x="{x0}" y="{y0}" width="{width-2*x0}" height="{height-2*y0}" rx="18" fill="{panel}" stroke="{stroke}" opacity="0.98"/>'  # noqa: E501
    )

    # Header
    parts.append(
        f'<text x="{x0+pad}" y="{y0+pad+18}" font-family="ui-sans-serif,system-ui" font-size="18" fill="{accent}">{_esc("KUHUL PoC — CLI ⇄ SVG")}</text>'  # noqa: E501
    )
    parts.append(
        f'<text x="{x0+pad}" y="{y0+pad+40}" font-family="ui-sans-serif,system-ui" font-size="12" fill="{text}">{_esc("Theme: " + theme)}</text>'  # noqa: E501
    )

    # Components list
    list_x = x0 + pad
    list_y = y0 + 86
    w = width - 2 * x0 - 2 * pad

    if not comps:
        parts.append(
            f'<text x="{list_x}" y="{list_y}" font-family="ui-sans-serif,system-ui" font-size="13" fill="{text}">{_esc("No components yet. Use CLI: create button --text=OK")}</text>'  # noqa: E501
        )
    else:
        for i, c in enumerate(comps):
            cy = list_y + i * row_h
            cid = str(c.get("id", ""))
            ctype = str(c.get("type", "component"))
            props = c.get("props", {}) or {}
            label = props.get("text") or props.get("label") or ""

            parts.append(
                f'<rect x="{list_x}" y="{cy-18}" width="{w}" height="44" rx="12" fill="none" stroke="{stroke}" opacity="0.55"/>'  # noqa: E501
            )
            parts.append(
                f'<text x="{list_x+14}" y="{cy+8}" font-family="ui-sans-serif,system-ui" font-size="13" fill="{text}">{_esc(f"{ctype}  ({cid})")}</text>'  # noqa: E501
            )
            if label:
                parts.append(
                    f'<text x="{list_x+w-14}" y="{cy+8}" text-anchor="end" font-family="ui-sans-serif,system-ui" font-size="13" fill="{accent}">{_esc(str(label))}</text>'  # noqa: E501
                )

    parts.append("</svg>")
    return "\n".join(parts)

from __future__ import annotations
import argparse
import os
import sys
import time
from typing import Any, Dict, List

from ids import IdGen
from session_log import SessionLog
from bus import EventBus
from engine import Engine
from svg_renderer import render_svg
from state import KuhulState
from providers import ProviderError, request_chat

V = "1.0.0"


def now_ms() -> int:
    return int(time.time() * 1000)


def make_cmd(
    idgen: IdGen,
    *,
    session: str,
    op: str,
    args: Dict[str, Any],
    source_kind: str = "cli",
    who: str = "local",
) -> Dict[str, Any]:
    ts = now_ms()
    return {
        "@type": "kuhul.command",
        "@v": V,
        "id": idgen.next_id("cmd", ts),
        "ts_ms": ts,
        "source": {"kind": source_kind, "who": who, "session": session},
        "op": op,
        "args": args,
    }


def ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)


def write_text(path: str, text: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def load_events(log: SessionLog) -> List[Dict[str, Any]]:
    return list(log.read_all())


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(
        prog="kuhul", description="KUHUL PoC — CLI ⇄ SVG (append-only events + replay)"
    )
    ap.add_argument("--session", default="sess_local", help="Session id (used for logs)")
    ap.add_argument("--out", default="output", help="Output directory")
    ap.add_argument(
        "--events",
        default=None,
        help="Event log path (JSONL). Default: <out>/<session>.events.jsonl",
    )
    ap.add_argument("--quiet", action="store_true", help="Suppress event printing")

    sub = ap.add_subparsers(dest="cmd", required=True)

    p_create = sub.add_parser("create", help="Create a UI component")
    p_create.add_argument("component", choices=["button", "card", "chat-bubble"])
    p_create.add_argument("--text", default=None, help="Optional label/text")

    p_theme = sub.add_parser("theme", help="Apply theme")
    p_theme.add_argument("name", choices=["dark", "light"])

    p_export = sub.add_parser("export-svg", help="Export current state to SVG")
    p_export.add_argument(
        "--file", default=None, help="Output svg filename. Default: <out>/<session>.svg"
    )

    p_replay = sub.add_parser("replay", help="Replay an existing event log and export SVG")
    p_replay.add_argument(
        "--file",
        default=None,
        help="Event log path (JSONL). Default: <out>/<session>.events.jsonl",
    )
    p_replay.add_argument(
        "--svg", default=None, help="Output svg filename. Default: <out>/<session>.replay.svg"
    )

    p_chat = sub.add_parser("chat", help="Send a chat request to a model provider")
    p_chat.add_argument(
        "--provider",
        required=True,
        choices=["openai", "claude", "mistral", "deepseek", "codestral", "inference"],
        help="Target provider",
    )
    p_chat.add_argument("--model", required=True, help="Model name")
    p_chat.add_argument("--message", required=True, help="User message")
    p_chat.add_argument("--system", default=None, help="Optional system prompt")
    p_chat.add_argument("--temperature", type=float, default=0.2, help="Sampling temperature")
    p_chat.add_argument("--max-tokens", type=int, default=512, help="Max response tokens")
    p_chat.add_argument("--base-url", default=None, help="Override provider API base URL")
    p_chat.add_argument(
        "--api-key",
        default=None,
        help="Override provider API key (otherwise use provider-specific env var)",
    )

    args = ap.parse_args(argv)

    ensure_dir(args.out)
    event_log_path = args.events or os.path.join(args.out, f"{args.session}.events.jsonl")
    log = SessionLog(event_log_path)
    bus = EventBus(log=log)
    idgen = IdGen()

    # Optional: print events as they happen (CLI projection)
    if not args.quiet:

        def printer(e: Dict[str, Any]) -> None:
            print(f"[{e.get('topic')}] {e.get('id')} caused_by={e.get('caused_by')}")

        bus.subscribe(printer)

    engine = Engine(bus=bus, state=KuhulState(), idgen=idgen)

    # Subcommands
    if args.cmd == "create":
        props: Dict[str, Any] = {}
        if args.text is not None:
            # map to common prop keys
            key = "text" if args.component != "card" else "label"
            props[key] = args.text
        cmd = make_cmd(
            idgen,
            session=args.session,
            op="ui.create",
            args={"component": args.component, "props": props},
        )
        # Persist commands too (separate log file)
        cmd_log_path = os.path.join(args.out, f"{args.session}.commands.jsonl")
        SessionLog(cmd_log_path).append(cmd)
        engine.apply_command(cmd)

        # snapshot after mutate (handy for debugging)
        engine.state_snapshot(caused_by=cmd["id"])

        # also export svg to keep it visual by default
        svg_path = os.path.join(args.out, f"{args.session}.svg")
        svg = render_svg(engine.state.to_dict())
        write_text(svg_path, svg)
        if not args.quiet:
            print(f"SVG written: {svg_path}")
        return 0

    if args.cmd == "theme":
        cmd = make_cmd(idgen, session=args.session, op="ui.theme.apply", args={"name": args.name})
        SessionLog(os.path.join(args.out, f"{args.session}.commands.jsonl")).append(cmd)
        engine.apply_command(cmd)
        engine.state_snapshot(caused_by=cmd["id"])

        svg_path = os.path.join(args.out, f"{args.session}.svg")
        svg = render_svg(engine.state.to_dict())
        write_text(svg_path, svg)
        if not args.quiet:
            print(f"SVG written: {svg_path}")
        return 0

    if args.cmd == "export-svg":
        out_svg = args.file or os.path.join(args.out, f"{args.session}.svg")
        # emit an intention event (optional but useful)
        cmd = make_cmd(
            idgen, session=args.session, op="svg.export", args={"hint": os.path.basename(out_svg)}
        )
        SessionLog(os.path.join(args.out, f"{args.session}.commands.jsonl")).append(cmd)
        engine.apply_command(cmd)
        engine.state_snapshot(caused_by=cmd["id"])

        svg = render_svg(engine.state.to_dict())
        write_text(out_svg, svg)
        if not args.quiet:
            print(f"SVG written: {out_svg}")
        return 0

    if args.cmd == "replay":
        replay_log_path = args.file or os.path.join(args.out, f"{args.session}.events.jsonl")
        replay_svg = args.svg or os.path.join(args.out, f"{args.session}.replay.svg")

        rlog = SessionLog(replay_log_path)
        events = load_events(rlog)

        # Reconstruct state by interpreting state.changed + theme.changed events.
        # Minimal: we rebuild from the events' payloads (no engine needed).
        # (This is why event payloads include created component and theme changes.)
        st = KuhulState()
        for e in events:
            if e.get("topic") != "state.changed":
                continue
            data = e.get("data", {}) or {}
            kind = data.get("kind")
            if kind == "component.created":
                comp = data.get("component")
                if isinstance(comp, dict):
                    st.components.append(comp)
            elif kind == "theme.changed":
                to = data.get("to")
                if to in ("dark", "light"):
                    st.theme = to

        svg = render_svg(st.to_dict())
        write_text(replay_svg, svg)
        if not args.quiet:
            print(f"Replayed SVG written: {replay_svg}")
        return 0

    if args.cmd == "chat":
        cmd = make_cmd(
            idgen,
            session=args.session,
            op="ai.chat",
            args={
                "provider": args.provider,
                "model": args.model,
                "message": args.message,
                "system": args.system,
                "temperature": args.temperature,
                "max_tokens": args.max_tokens,
            },
        )
        SessionLog(os.path.join(args.out, f"{args.session}.commands.jsonl")).append(cmd)

        try:
            content, meta = request_chat(
                provider=args.provider,
                model=args.model,
                message=args.message,
                system=args.system,
                temperature=args.temperature,
                max_tokens=args.max_tokens,
                base_url=args.base_url,
                api_key=args.api_key,
            )
        except ProviderError as exc:
            engine.emit_event(
                ts_ms=now_ms(),
                caused_by=cmd["id"],
                topic="ai.chat.failed",
                data={"provider": args.provider, "error": str(exc)},
            )
            print(f"Error: {exc}", file=sys.stderr)
            return 1

        engine.emit_event(
            ts_ms=now_ms(),
            caused_by=cmd["id"],
            topic="ai.chat.completed",
            data={
                "provider": args.provider,
                "model": args.model,
                "response": content,
                "meta": meta,
            },
        )
        print(content)
        return 0

    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

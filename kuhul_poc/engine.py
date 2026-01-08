from __future__ import annotations
import time
from typing import Any, Dict, Optional

from ids import IdGen
from state import KuhulState
from bus import EventBus


class Engine:
    """
    Deterministic core:
    - Accepts canonical commands only
    - Mutates state
    - Emits canonical events
    """

    CMD_TYPE = "kuhul.command"
    EVT_TYPE = "kuhul.event"
    V = "1.0.0"

    def __init__(
        self,
        *,
        bus: EventBus,
        state: Optional[KuhulState] = None,
        idgen: Optional[IdGen] = None,
    ) -> None:
        self.bus = bus
        self.state = state or KuhulState()
        self.idgen = idgen or IdGen()

    def now_ms(self) -> int:
        return int(time.time() * 1000)

    def emit_event(
        self, *, ts_ms: int, caused_by: str, topic: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        evt = {
            "@type": self.EVT_TYPE,
            "@v": self.V,
            "id": self.idgen.next_id("evt", ts_ms),
            "ts_ms": ts_ms,
            "caused_by": caused_by,
            "topic": topic,
            "data": data,
        }
        self.bus.append(evt, persist=True)
        return evt

    def apply_command(self, cmd: Dict[str, Any]) -> None:
        # Minimal validation (schema validators can be added later)
        if cmd.get("@type") != self.CMD_TYPE:
            raise ValueError("Invalid command @type")
        if not isinstance(cmd.get("op"), str):
            raise ValueError("Invalid command op")
        if not isinstance(cmd.get("args"), dict):
            raise ValueError("Invalid command args")

        op = cmd["op"]
        args = cmd["args"]
        ts_ms = int(cmd["ts_ms"])
        cid = str(cmd["id"])

        if op == "ui.create":
            self._op_ui_create(cid=cid, ts_ms=ts_ms, args=args)
        elif op == "ui.theme.apply":
            self._op_theme_apply(cid=cid, ts_ms=ts_ms, args=args)
        elif op == "svg.export":
            # engine only emits intention; CLI chooses path and writes file
            self.emit_event(
                ts_ms=ts_ms,
                caused_by=cid,
                topic="svg.export.requested",
                data={"format": "svg", "hint": args.get("hint", "state.svg")},
            )
        else:
            self.emit_event(
                ts_ms=ts_ms,
                caused_by=cid,
                topic="command.rejected",
                data={"reason": "unknown_op", "op": op},
            )

    def _op_ui_create(self, *, cid: str, ts_ms: int, args: Dict[str, Any]) -> None:
        ctype = args.get("component")
        props = args.get("props", {}) or {}
        if not isinstance(ctype, str) or not ctype:
            self.emit_event(
                ts_ms=ts_ms,
                caused_by=cid,
                topic="command.rejected",
                data={"reason": "missing_component"},
            )
            return
        if not isinstance(props, dict):
            self.emit_event(
                ts_ms=ts_ms,
                caused_by=cid,
                topic="command.rejected",
                data={"reason": "props_not_object"},
            )
            return

        comp_id = self.idgen.next_id("cmp", ts_ms)
        comp = {"id": comp_id, "type": ctype, "props": props}
        self.state.components.append(comp)

        self.emit_event(
            ts_ms=ts_ms,
            caused_by=cid,
            topic="state.changed",
            data={"kind": "component.created", "component": comp},
        )

    def _op_theme_apply(self, *, cid: str, ts_ms: int, args: Dict[str, Any]) -> None:
        name = args.get("name")
        if name not in ("dark", "light"):
            self.emit_event(
                ts_ms=ts_ms,
                caused_by=cid,
                topic="command.rejected",
                data={"reason": "invalid_theme"},
            )
            return

        old = self.state.theme
        self.state.theme = name

        self.emit_event(
            ts_ms=ts_ms,
            caused_by=cid,
            topic="state.changed",
            data={"kind": "theme.changed", "from": old, "to": name},
        )

    def state_snapshot(self, *, caused_by: str, ts_ms: Optional[int] = None) -> Dict[str, Any]:
        ts = self.now_ms() if ts_ms is None else ts_ms
        snap = self.state.to_dict()
        self.emit_event(
            ts_ms=ts,
            caused_by=caused_by,
            topic="state.snapshot",
            data={"state": snap},
        )
        return snap

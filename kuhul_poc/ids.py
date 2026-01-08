from __future__ import annotations
import threading


class IdGen:
    """
    Deterministic within-process ID generator:
    - ID = <prefix>_<ts_ms>_<counter>
    - Counter is monotonic per generator instance.
    Replay never regenerates IDs; it reads them from logs.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counter = 0

    def next_id(self, prefix: str, ts_ms: int) -> str:
        with self._lock:
            self._counter += 1
            c = self._counter
        return f"{prefix}_{ts_ms}_{c:06d}"

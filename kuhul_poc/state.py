from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class KuhulState:
    """
    Minimal state:
    - theme: string
    - components: list of components with id/type/props
    """

    theme: str = "dark"
    components: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "theme": self.theme,
            "components": list(self.components),
        }

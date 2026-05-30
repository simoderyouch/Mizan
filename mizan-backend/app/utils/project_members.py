import re
from collections.abc import Iterable
from typing import Any

_MEMBER_SPLIT_RE = re.compile(r"[\n,;]+")


def normalize_project_members(raw: Any) -> list[str]:
    if raw is None:
        return []

    if isinstance(raw, str):
        seen: set[str] = set()
        ordered: list[str] = []
        for item in _MEMBER_SPLIT_RE.split(raw):
            cleaned = item.strip()
            if not cleaned:
                continue
            key = cleaned.casefold()
            if key in seen:
                continue
            seen.add(key)
            ordered.append(cleaned)
        return ordered

    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()]

    if isinstance(raw, dict):
        if isinstance(raw.get("team"), list):
            return [str(item).strip() for item in raw["team"] if str(item).strip()]
        collected: list[str] = []
        for value in raw.values():
            if isinstance(value, list):
                collected.extend([str(item).strip() for item in value if str(item).strip()])
            elif isinstance(value, str) and value.strip():
                collected.append(value.strip())
        return collected

    if isinstance(raw, Iterable):
        return [str(item).strip() for item in raw if str(item).strip()]

    return []

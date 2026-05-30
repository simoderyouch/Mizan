"""Canonical English weekday names for schedule storage and queries."""
from __future__ import annotations

from datetime import date

CANONICAL_WEEKDAYS: tuple[str, ...] = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)

_ALIASES: dict[str, str] = {
    "mon": "Monday",
    "monday": "Monday",
    "lundi": "Monday",
    "tue": "Tuesday",
    "tues": "Tuesday",
    "tuesday": "Tuesday",
    "mardi": "Tuesday",
    "wed": "Wednesday",
    "wednesday": "Wednesday",
    "mercredi": "Wednesday",
    "thu": "Thursday",
    "thur": "Thursday",
    "thurs": "Thursday",
    "thursday": "Thursday",
    "jeudi": "Thursday",
    "fri": "Friday",
    "friday": "Friday",
    "vendredi": "Friday",
    "sat": "Saturday",
    "saturday": "Saturday",
    "samedi": "Saturday",
    "sun": "Sunday",
    "sunday": "Sunday",
    "dimanche": "Sunday",
}


def normalize_weekday(value: str | None) -> str:
    """Map admin / CSV / locale variants to English weekday title case."""
    if not value or not str(value).strip():
        return CANONICAL_WEEKDAYS[0]
    key = str(value).strip().lower()
    if key in _ALIASES:
        return _ALIASES[key]
    titled = key.capitalize()
    if titled in CANONICAL_WEEKDAYS:
        return titled
    return str(value).strip()


def today_weekday_name(anchor: date | None = None) -> str:
    """Always English weekday (locale-independent)."""
    d = anchor or date.today()
    return CANONICAL_WEEKDAYS[d.weekday()]


def matches_today_weekday(day_of_week: str, anchor: date | None = None) -> bool:
    return normalize_weekday(day_of_week) == today_weekday_name(anchor)

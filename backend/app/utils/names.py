from __future__ import annotations

import re


def capitalize_name_part(name: str | None) -> str | None:
    if name is None:
        return None

    trimmed = re.sub(r"\s+", " ", str(name).strip())
    if not trimmed:
        return trimmed

    def capitalize_segment(segment: str) -> str:
        if not segment:
            return segment
        if len(segment) == 1:
            return segment.upper()
        return segment[0].upper() + segment[1:].lower()

    formatted_words = []
    for word in trimmed.split(" "):
        parts = re.split(r"([-'])", word)
        formatted_words.append(
            "".join(
                capitalize_segment(part) if part not in "-'" else part
                for part in parts
            )
        )

    return " ".join(formatted_words)

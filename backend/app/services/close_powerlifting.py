from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import quote

import httpx

CLOSE_POWERLIFTING_BASE_URL = os.environ.get(
    "OPL_API_BASE_URL",
    "https://closepowerlifting.com",
)
REQUEST_TIMEOUT = 30.0
OPL_USERNAME_PATTERN = re.compile(r"^[a-z0-9-]+$", re.IGNORECASE)


class OplProfileNotFoundError(ValueError):
    pass


class OplProfileAmbiguousError(ValueError):
    def __init__(self, candidates: list[dict[str, str]]):
        self.candidates = candidates
        super().__init__("Multiple OPL profiles match that input")


def base_url() -> str:
    return CLOSE_POWERLIFTING_BASE_URL.rstrip("/")


def adapt_competition_result(row: dict[str, Any]) -> dict[str, Any]:
    """Map a Close Powerlifting meet row into our internal meet shape."""
    return {
        "meet_date": row.get("date"),
        "date": row.get("date"),
        "meet_name": row.get("meet_name"),
        "meet_path": row.get("meet_path"),
        "federation": row.get("federation"),
        "equipment": row.get("equipment"),
        "WeightClassKg": row.get("weight_class_kg"),
        "weight_class_kg": row.get("weight_class_kg"),
        "bodyweight_kg": row.get("bodyweight"),
        "bodyweight": row.get("bodyweight"),
        "squat": row.get("squat"),
        "bench": row.get("bench"),
        "deadlift": row.get("deadlift"),
        "total": row.get("total"),
    }


def _normalize_close_pl_sex(value: Any) -> str | None:
    normalized = str(value or "").strip().upper()
    if normalized == "M":
        return "male"
    if normalized == "F":
        return "female"
    return None


async def _fetch_sex_from_meet_path(
    client: httpx.AsyncClient,
    meet_path: str,
    username: str,
) -> str | None:
    parts = str(meet_path).strip("/").split("/")
    if len(parts) != 3:
        return None

    federation, meet_date, slug = parts
    response = await client.get(
        f"{base_url()}/api/meets/{federation}/{meet_date}/{slug}",
        params={"units": "kg"},
    )
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, dict):
        return None

    results = data.get("results")
    if not isinstance(results, list):
        return None

    username_lower = username.strip().lower()
    for entry in results:
        if not isinstance(entry, dict):
            continue
        if str(entry.get("username", "")).strip().lower() != username_lower:
            continue
        sex = _normalize_close_pl_sex(entry.get("sex"))
        if sex:
            return sex
    return None


async def _attach_sex_to_meets(
    client: httpx.AsyncClient,
    username: str,
    meets: list[dict[str, Any]],
    competition_results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not meets:
        return meets

    sorted_results = sorted(
        [row for row in competition_results if isinstance(row, dict)],
        key=lambda row: str(row.get("date") or ""),
        reverse=True,
    )
    sex: str | None = None
    for row in sorted_results:
        meet_path = row.get("meet_path")
        if not meet_path:
            continue
        sex = await _fetch_sex_from_meet_path(client, str(meet_path), username)
        if sex:
            break

    if not sex:
        return meets

    return [{**meet, "Sex": sex, "sex": sex} for meet in meets]


def extract_search_candidates(payload: Any) -> list[dict[str, str]]:
    if not isinstance(payload, dict):
        return []

    raw_candidates = payload.get("data")
    if not isinstance(raw_candidates, list):
        return []

    candidates: list[dict[str, str]] = []
    seen_usernames: set[str] = set()

    for item in raw_candidates:
        if not isinstance(item, dict):
            continue
        username = item.get("username")
        if not username:
            continue
        username = str(username).strip()
        if not username or username in seen_usernames:
            continue
        name = str(item.get("name") or username).strip()
        candidates.append({"username": username, "name": name})
        seen_usernames.add(username)

    return candidates


async def search_athletes(
    client: httpx.AsyncClient,
    first_name: str,
    last_name: str,
) -> list[dict[str, str]]:
    return await search_users(client, f"{first_name} {last_name}")


async def search_users(client: httpx.AsyncClient, query: str) -> list[dict[str, str]]:
    response = await client.get(
        f"{base_url()}/api/users",
        params={"search": query.strip()},
    )
    response.raise_for_status()
    return extract_search_candidates(response.json())


def _profile_summary(profile: dict[str, Any], username: str) -> dict[str, Any]:
    return {
        "username": username,
        "name": profile.get("name") or username,
        "total_entries": profile.get("total_entries"),
        "first_meet": profile.get("first_meet"),
        "last_meet": profile.get("last_meet"),
        "personal_best": profile.get("personal_best"),
    }


async def fetch_profile_by_username(
    client: httpx.AsyncClient,
    username: str,
) -> dict[str, Any] | None:
    slug = str(username).strip().lstrip("@").lower()
    if not OPL_USERNAME_PATTERN.fullmatch(slug):
        return None

    response = await client.get(
        f"{base_url()}/api/users/{quote(slug, safe='')}",
        params={"units": "kg"},
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    payload = response.json()
    profile = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(profile, dict):
        return None
    return _profile_summary(profile, slug)


async def resolve_opl_profile_input(
    client: httpx.AsyncClient,
    raw_input: str,
) -> dict[str, Any]:
    trimmed = str(raw_input or "").strip().lstrip("@").strip()
    if not trimmed:
        raise OplProfileNotFoundError("OPL profile input is required")

    if OPL_USERNAME_PATTERN.fullmatch(trimmed):
        profile = await fetch_profile_by_username(client, trimmed.lower())
        if profile:
            return profile
        raise OplProfileNotFoundError(f"No OPL profile found for @{trimmed.lower()}")

    candidates = await search_users(client, trimmed)
    normalized_input = trimmed.casefold()
    exact_matches = [
        candidate
        for candidate in candidates
        if candidate["name"].casefold() == normalized_input
    ]

    if len(exact_matches) == 1:
        username = exact_matches[0]["username"]
        profile = await fetch_profile_by_username(client, username)
        if profile:
            return profile
        raise OplProfileNotFoundError(f"No OPL profile found for @{username}")

    if len(candidates) == 1:
        username = candidates[0]["username"]
        profile = await fetch_profile_by_username(client, username)
        if profile:
            return profile
        raise OplProfileNotFoundError(f"No OPL profile found for @{username}")

    if len(candidates) > 1:
        raise OplProfileAmbiguousError(candidates)

    raise OplProfileNotFoundError(f"No OPL profile found for '{trimmed}'")


async def lookup_opl_profile(raw_input: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        return await resolve_opl_profile_input(client, raw_input)


async def fetch_athlete_meets(
    client: httpx.AsyncClient,
    username: str,
) -> list[dict[str, Any]]:
    slug = quote(str(username).strip(), safe="")
    response = await client.get(
        f"{base_url()}/api/users/{slug}",
        params={"units": "kg"},
    )
    response.raise_for_status()
    payload = response.json()
    profile = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(profile, dict):
        return []

    competition_results = profile.get("competition_results")
    if not isinstance(competition_results, list):
        return []

    meets = [
        adapt_competition_result(row)
        for row in competition_results
        if isinstance(row, dict)
    ]
    return await _attach_sex_to_meets(client, username, meets, competition_results)


async def fetch_athlete_results(username: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        meets = await fetch_athlete_meets(client, username)
    return {"data": {"meets": meets, "competition_results": meets}}

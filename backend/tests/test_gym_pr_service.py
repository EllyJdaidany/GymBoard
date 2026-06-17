from unittest.mock import MagicMock

import pytest

from app.services.gym_pr_service import (
    AmbiguousMemberError,
    find_members_by_name,
    replace_gym_prs_for_member,
    resolve_or_create_gym_member,
)


class _FakeQuery:
    def __init__(self, data):
        self._data = data

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        result = MagicMock()
        result.data = self._data
        return result


class _FakeSupabase:
    def __init__(self, tables):
        self.tables = tables
        self.inserted = []
        self.deleted = []
        self.updated = []

    def table(self, name):
        return _Table(self, name)


class _Table:
    def __init__(self, supabase, name):
        self.supabase = supabase
        self.name = name
        self._filters = []
        self._payload = None
        self._mode = None

    def select(self, *_args, **_kwargs):
        self._mode = "select"
        return self

    def insert(self, payload):
        self._mode = "insert"
        self._payload = payload
        return self

    def update(self, payload):
        self._mode = "update"
        self._payload = payload
        return self

    def delete(self):
        self._mode = "delete"
        return self

    def eq(self, field, value):
        self._filters.append((field, value))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        result = MagicMock()
        if self._mode == "select":
            rows = self.supabase.tables.get(self.name, [])
            for field, value in self._filters:
                rows = [row for row in rows if str(row.get(field)) == str(value)]
            result.data = rows
        elif self._mode == "insert":
            row = {**self._payload, "id": "new-member-id"}
            self.supabase.inserted.append((self.name, row))
            self.supabase.tables.setdefault(self.name, []).append(row)
            result.data = [row]
        elif self._mode == "update":
            self.supabase.updated.append((self.name, self._filters, self._payload))
            for row in self.supabase.tables.get(self.name, []):
                if all(str(row.get(field)) == str(value) for field, value in self._filters):
                    row.update(self._payload)
            result.data = []
        elif self._mode == "delete":
            self.supabase.deleted.append((self.name, self._filters))
            rows = self.supabase.tables.get(self.name, [])
            kept = []
            for row in rows:
                if all(str(row.get(field)) == str(value) for field, value in self._filters):
                    continue
                kept.append(row)
            self.supabase.tables[self.name] = kept
            result.data = []
        return result


def test_find_members_by_name_filters_exact_match():
    supabase = _FakeSupabase(
        {
            "member": [
                {"id": "1", "first_name": "Alex", "last_name": "Stone"},
                {"id": "2", "first_name": "Alex", "last_name": "Stone"},
            ]
        }
    )

    matches = find_members_by_name(supabase, "Alex", "Stone")
    assert len(matches) == 2


def test_resolve_or_create_gym_member_raises_for_ambiguous_name():
    supabase = _FakeSupabase(
        {
            "member": [
                {"id": "1", "first_name": "Alex", "last_name": "Stone"},
                {"id": "2", "first_name": "Alex", "last_name": "Stone"},
            ]
        }
    )

    with pytest.raises(AmbiguousMemberError):
        resolve_or_create_gym_member(
            supabase,
            first_name="Alex",
            last_name="Stone",
            sex="male",
            weight_class_kg=83,
        )


def test_resolve_or_create_gym_member_creates_when_missing():
    supabase = _FakeSupabase({"member": []})

    member, created = resolve_or_create_gym_member(
        supabase,
        first_name="Jamie",
        last_name="Lee",
        sex="female",
        weight_class_kg=63,
    )

    assert created is True
    assert member["first_name"] == "Jamie"
    assert member["sex"] == "female"
    assert member["weight_class_kg"] == 63
    assert member["email"].endswith("@gym.manual.catalyst")


def test_replace_gym_prs_for_member_inserts_bucket_scoped_rows(monkeypatch):
    supabase = _FakeSupabase({"gym_pr": []})
    member = {
        "id": "member-1",
        "sex": "male",
        "ruleset": "traditional",
        "weight_class_kg": 83,
    }

    monkeypatch.setattr(
        "app.services.gym_pr_service.resolve_bucket_id_with_fallback",
        lambda sex, ruleset, class_token: ("m-82.5-83", "traditional"),
    )

    updated = replace_gym_prs_for_member(
        supabase,
        member,
        {"squat": 200, "bench": 120, "deadlift": None, "total": 420},
    )

    assert updated == 3
    assert len(supabase.inserted) == 3
    for _, row in supabase.inserted:
        assert row["source"] == "gym"
        assert row["canonical_bucket_id"] == "m-82.5-83"
        assert row["meet_weight_class_kg"] == 83

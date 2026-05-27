import asyncio

from app.services.resource_service import DEFAULT_RESOURCES, seed_default_resources


class _ScalarResult:
    def __init__(self, values: list[str]):
        self._values = values

    def all(self) -> list[str]:
        return self._values


class _ExecuteResult:
    def __init__(self, values: list[str]):
        self._values = values

    def scalars(self) -> _ScalarResult:
        return _ScalarResult(self._values)


class _FakeDb:
    def __init__(self, existing_titles: list[str]):
        self.existing_titles = existing_titles
        self.added = []
        self.commits = 0

    async def execute(self, statement):
        return _ExecuteResult(self.existing_titles)

    def add(self, resource) -> None:
        self.added.append(resource)

    async def commit(self) -> None:
        self.commits += 1


def test_seed_default_resources_does_not_overwrite_existing_resources() -> None:
    existing_titles = [resource["title"] for resource in DEFAULT_RESOURCES]
    db = _FakeDb(existing_titles)

    asyncio.run(seed_default_resources(db))

    assert db.added == []
    assert db.commits == 0


def test_seed_default_resources_adds_only_missing_defaults() -> None:
    existing_titles = [resource["title"] for resource in DEFAULT_RESOURCES[:2]]
    db = _FakeDb(existing_titles)

    asyncio.run(seed_default_resources(db))

    assert [resource.title for resource in db.added] == [
        resource["title"] for resource in DEFAULT_RESOURCES[2:]
    ]
    assert db.commits == 1

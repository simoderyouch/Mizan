from app.utils.project_members import normalize_project_members


def test_normalize_project_members_from_team_dict() -> None:
    assert normalize_project_members({"team": ["You", "Nour", "Adam"]}) == ["You", "Nour", "Adam"]


def test_normalize_project_members_from_list() -> None:
    assert normalize_project_members(["You", "  ", "Meriem"]) == ["You", "Meriem"]


def test_normalize_project_members_from_csv_string() -> None:
    assert normalize_project_members("You, Yassine, Meriem") == ["You", "Yassine", "Meriem"]

"""Fork-specific updater behavior must not silently overwrite CareerForge with upstream."""
from pathlib import Path

from app.services.update_check import REPOSITORY_ENV_VAR, repository

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_default_release_check_targets_careerforge(monkeypatch):
    monkeypatch.delenv(REPOSITORY_ENV_VAR, raising=False)
    assert repository() == "Q717-A/CareerForge"


def test_explicit_repository_override_remains_supported(monkeypatch):
    monkeypatch.setenv(REPOSITORY_ENV_VAR, "example/custom-fork")
    assert repository() == "example/custom-fork"


def test_windows_zip_updater_defaults_to_careerforge():
    script = (REPO_ROOT / "scripts" / "Update-ResumeForge.ps1").read_text(
        encoding="utf-8-sig"
    )
    assert 'else { "Q717-A/CareerForge" }' in script
    assert "magicapple123/ResumeForge" not in script
    assert "$ArchiveUrl = \"https://github.com/$Repository/archive/refs/heads/main.zip\"" in script

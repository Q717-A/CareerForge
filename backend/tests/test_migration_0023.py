"""0023 upgrade and rollback must preserve data without automatic false verification."""
from alembic import command
from sqlalchemy import create_engine, inspect, text

from app.database_migrations import build_alembic_config


def test_claim_truth_grade_upgrade_downgrade_preserves_old_rows(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'truth-status.db'}")
    config = build_alembic_config(engine)
    try:
        command.upgrade(config, "0022_project_lab")
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO claim_record "
                    "(title, source_fact, verification_status, created_at, updated_at) "
                    "VALUES (:title, :fact, :status, :created, :updated)"
                ),
                {
                    "title": "旧版机械项目",
                    "fact": "本人做过机械设计",
                    "status": "已确认",
                    "created": "2026-09-24",
                    "updated": "2026-09-24",
                },
            )
        command.upgrade(config, "0023_claim_truth_status")
        assert "truth_status" in {c["name"] for c in inspect(engine).get_columns("claim_record")}
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT source_fact, truth_status FROM claim_record WHERE title='旧版机械项目'")
            ).one()
            assert row == ("本人做过机械设计", None)
        command.downgrade(config, "0022_project_lab")
        assert "truth_status" not in {c["name"] for c in inspect(engine).get_columns("claim_record")}
        with engine.connect() as conn:
            assert conn.execute(
                text("SELECT source_fact FROM claim_record WHERE title='旧版机械项目'")
            ).scalar_one() == "本人做过机械设计"
    finally:
        engine.dispose()

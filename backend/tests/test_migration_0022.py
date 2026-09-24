"""0022_project_lab migration regression tests."""

from alembic import command
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.models.job import Job

from app.database_migrations import build_alembic_config

PREVIOUS_REVISION = "0021_candidate_additional_info"
HEAD_REVISION = "0022_project_lab"


def _revision(engine) -> str:
    with engine.connect() as connection:
        return connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()


def test_upgrade_creates_project_lab_table(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'project-lab.db'}")
    try:
        command.upgrade(build_alembic_config(engine), HEAD_REVISION)
        inspector = inspect(engine)

        assert _revision(engine) == HEAD_REVISION
        assert "project_lab_project" in inspector.get_table_names()
        assert {
            "id",
            "title",
            "origin",
            "status",
            "target_job_id",
            "target_roles",
            "gap_skills",
            "problem_statement",
            "learning_plan",
            "deliverables",
            "evidence",
            "result_summary",
            "mastery_notes",
            "resume_bullets",
            "interview_questions",
            "repository_url",
            "created_at",
            "updated_at",
        } == {column["name"] for column in inspector.get_columns("project_lab_project")}
        assert {
            "ix_project_lab_project_origin",
            "ix_project_lab_project_status",
            "ix_project_lab_project_target_job_id",
        } <= {item["name"] for item in inspector.get_indexes("project_lab_project")}
        assert any(
            item["referred_table"] == "job"
            and item["constrained_columns"] == ["target_job_id"]
            for item in inspector.get_foreign_keys("project_lab_project")
        )
    finally:
        engine.dispose()


def test_upgrade_preserves_existing_job_rows(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'project-lab-preserve.db'}")
    config = build_alembic_config(engine)
    try:
        command.upgrade(config, PREVIOUS_REVISION)
        with Session(engine) as session:
            session.add(Job(title="机械设计工程师", company="示例公司"))
            session.commit()

        command.upgrade(config, HEAD_REVISION)

        with engine.connect() as connection:
            assert connection.execute(
                text("SELECT title FROM job WHERE title = '机械设计工程师'")
            ).scalar_one() == "机械设计工程师"
        assert "project_lab_project" in inspect(engine).get_table_names()
    finally:
        engine.dispose()


def test_downgrade_removes_only_project_lab_table(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'project-lab-down.db'}")
    config = build_alembic_config(engine)
    try:
        command.upgrade(config, HEAD_REVISION)
        before = set(inspect(engine).get_table_names())

        command.downgrade(config, PREVIOUS_REVISION)

        after = set(inspect(engine).get_table_names())
        assert "project_lab_project" not in after
        assert after == before - {"project_lab_project"}
        assert _revision(engine) == PREVIOUS_REVISION
    finally:
        engine.dispose()
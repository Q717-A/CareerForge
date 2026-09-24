"""CareerForge Project Lab 基础表。

Revision ID: 0022_project_lab
Revises: 0021_candidate_additional_info
Create Date: 2026-09-24
"""
from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022_project_lab"
down_revision: str | Sequence[str] | None = "0021_candidate_additional_info"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    if "project_lab_project" in _tables():
        return

    op.create_table(
        "project_lab_project",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("origin", sa.String(length=24), nullable=False, server_default="manual"),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="proposed"),
        sa.Column(
            "target_job_id",
            sa.Integer(),
            sa.ForeignKey("job.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("target_roles", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("gap_skills", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("problem_statement", sa.Text(), nullable=False, server_default=""),
        sa.Column("learning_plan", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("deliverables", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("evidence", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("result_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("mastery_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("resume_bullets", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("interview_questions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("repository_url", sa.String(length=1024), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_project_lab_project_origin", "project_lab_project", ["origin"])
    op.create_index("ix_project_lab_project_status", "project_lab_project", ["status"])
    op.create_index("ix_project_lab_project_target_job_id", "project_lab_project", ["target_job_id"])


def downgrade() -> None:
    if "project_lab_project" not in _tables():
        return
    op.drop_index("ix_project_lab_project_target_job_id", table_name="project_lab_project")
    op.drop_index("ix_project_lab_project_status", table_name="project_lab_project")
    op.drop_index("ix_project_lab_project_origin", table_name="project_lab_project")
    op.drop_table("project_lab_project")

"""Add explicit claim truth grades, leaving historical records ungraded.

Revision ID: 0023_claim_truth_status
Revises: 0022_project_lab
"""
import sqlalchemy as sa
from alembic import op

revision = "0023_claim_truth_status"
down_revision = "0022_project_lab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("claim_record")}
    if "truth_status" not in columns:
        op.add_column("claim_record", sa.Column("truth_status", sa.String(16), nullable=True))
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("claim_record")}
    if "ix_claim_record_truth_status" not in indexes:
        op.create_index("ix_claim_record_truth_status", "claim_record", ["truth_status"])


def downgrade() -> None:
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("claim_record")}
    if "ix_claim_record_truth_status" in indexes:
        op.drop_index("ix_claim_record_truth_status", table_name="claim_record")
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("claim_record")}
    if "truth_status" in columns:
        with op.batch_alter_table("claim_record") as batch:
            batch.drop_column("truth_status")

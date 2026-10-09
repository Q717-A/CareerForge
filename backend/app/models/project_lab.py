"""Project Lab：把岗位能力缺口变成真正完成并掌握的项目。

Project Lab 与事实台账刻意分开：这里允许“建议做 / 正在学 / 刚实现”的内容存在；
事实台账只负责可对外表达的主张。只有进入 resume_ready 的项目，后续才允许显式转成
事实台账草稿，避免把“AI 推荐我做的项目”误写成“我已经做过的项目”。
"""
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .profile import utcnow

PROJECT_LAB_STATUS_PROPOSED = "proposed"
PROJECT_LAB_STATUS_LEARNING = "learning"
PROJECT_LAB_STATUS_IMPLEMENTED = "implemented"
PROJECT_LAB_STATUS_VERIFIED = "verified"
PROJECT_LAB_STATUS_RESUME_READY = "resume_ready"

PROJECT_LAB_STATUSES = (
    PROJECT_LAB_STATUS_PROPOSED,
    PROJECT_LAB_STATUS_LEARNING,
    PROJECT_LAB_STATUS_IMPLEMENTED,
    PROJECT_LAB_STATUS_VERIFIED,
    PROJECT_LAB_STATUS_RESUME_READY,
)
PROJECT_LAB_STATUS_RANK = {status: index for index, status in enumerate(PROJECT_LAB_STATUSES)}

PROJECT_LAB_ORIGIN_MANUAL = "manual"
PROJECT_LAB_ORIGIN_JOB_GAP = "job_gap"
PROJECT_LAB_ORIGIN_ASSISTANT = "assistant"
PROJECT_LAB_ORIGINS = (
    PROJECT_LAB_ORIGIN_MANUAL,
    PROJECT_LAB_ORIGIN_JOB_GAP,
    PROJECT_LAB_ORIGIN_ASSISTANT,
)


class ProjectLabProject(Base):
    """一项能力补缺项目。"""

    __tablename__ = "project_lab_project"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    origin: Mapped[str] = mapped_column(String(24), default=PROJECT_LAB_ORIGIN_MANUAL, index=True)
    status: Mapped[str] = mapped_column(
        String(24), default=PROJECT_LAB_STATUS_PROPOSED, index=True
    )

    target_job_id: Mapped[int | None] = mapped_column(
        ForeignKey("job.id", ondelete="SET NULL"), nullable=True, index=True
    )
    target_roles: Mapped[list[str]] = mapped_column(JSON, default=list)
    gap_skills: Mapped[list[str]] = mapped_column(JSON, default=list)

    problem_statement: Mapped[str] = mapped_column(Text, default="")
    learning_plan: Mapped[list[str]] = mapped_column(JSON, default=list)
    deliverables: Mapped[list[str]] = mapped_column(JSON, default=list)

    # 证据只保存定位信息，不存账号密码、Cookie、验证码等敏感内容。
    # [{"type": "repository", "location": "...", "note": "..."}]
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    result_summary: Mapped[str] = mapped_column(Text, default="")
    mastery_notes: Mapped[str] = mapped_column(Text, default="")

    # 进入 resume_ready 前必须存在；后续转事实台账时仍只是草稿，不直接进终稿。
    resume_bullets: Mapped[list[str]] = mapped_column(JSON, default=list)
    interview_questions: Mapped[list[str]] = mapped_column(JSON, default=list)
    repository_url: Mapped[str] = mapped_column(String(1024), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


__all__ = [
    "PROJECT_LAB_ORIGINS",
    "PROJECT_LAB_ORIGIN_ASSISTANT",
    "PROJECT_LAB_ORIGIN_JOB_GAP",
    "PROJECT_LAB_ORIGIN_MANUAL",
    "PROJECT_LAB_STATUSES",
    "PROJECT_LAB_STATUS_IMPLEMENTED",
    "PROJECT_LAB_STATUS_LEARNING",
    "PROJECT_LAB_STATUS_PROPOSED",
    "PROJECT_LAB_STATUS_RANK",
    "PROJECT_LAB_STATUS_RESUME_READY",
    "PROJECT_LAB_STATUS_VERIFIED",
    "ProjectLabProject",
]

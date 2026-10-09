"""Project Lab 请求/响应结构。"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ..models.project_lab import (
    PROJECT_LAB_ORIGINS,
    PROJECT_LAB_STATUSES,
    PROJECT_LAB_ORIGIN_MANUAL,
    PROJECT_LAB_STATUS_PROPOSED,
)

MAX_TITLE_CHARS = 200
MAX_TEXT_CHARS = 12_000
MAX_LIST_ITEMS = 50
MAX_LIST_ITEM_CHARS = 1_000

ProjectLabStatus = Literal["proposed", "learning", "implemented", "verified", "resume_ready"]
ProjectLabOrigin = Literal["manual", "job_gap", "assistant"]


class ProjectEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = Field(default="other", max_length=64)
    location: str = Field(default="", max_length=2_048)
    note: str = Field(default="", max_length=1_000)


def _clean_list(value: list[str], label: str) -> list[str]:
    result: list[str] = []
    for raw in value:
        item = str(raw or "").strip()[:MAX_LIST_ITEM_CHARS]
        if item and item not in result:
            result.append(item)
    if len(result) > MAX_LIST_ITEMS:
        raise ValueError(f"{label}最多 {MAX_LIST_ITEMS} 条")
    return result


class ProjectLabBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=MAX_TITLE_CHARS)
    origin: ProjectLabOrigin = PROJECT_LAB_ORIGIN_MANUAL
    status: ProjectLabStatus = PROJECT_LAB_STATUS_PROPOSED
    target_job_id: int | None = Field(default=None, ge=1)
    target_roles: list[str] = Field(default_factory=list)
    gap_skills: list[str] = Field(default_factory=list)
    problem_statement: str = Field(default="", max_length=MAX_TEXT_CHARS)
    learning_plan: list[str] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    evidence: list[ProjectEvidence] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    result_summary: str = Field(default="", max_length=MAX_TEXT_CHARS)
    mastery_notes: str = Field(default="", max_length=MAX_TEXT_CHARS)
    resume_bullets: list[str] = Field(default_factory=list)
    interview_questions: list[str] = Field(default_factory=list)
    repository_url: str = Field(default="", max_length=1_024)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("项目名称不能为空")
        return cleaned

    @field_validator("origin")
    @classmethod
    def origin_must_be_supported(cls, value: str) -> str:
        if value not in PROJECT_LAB_ORIGINS:
            raise ValueError("未知的项目来源")
        return value

    @field_validator("status")
    @classmethod
    def status_must_be_supported(cls, value: str) -> str:
        if value not in PROJECT_LAB_STATUSES:
            raise ValueError("未知的项目状态")
        return value

    @field_validator(
        "target_roles",
        "gap_skills",
        "learning_plan",
        "deliverables",
        "resume_bullets",
        "interview_questions",
    )
    @classmethod
    def clean_lists(cls, value: list[str], info) -> list[str]:
        return _clean_list(value, info.field_name)


class ProjectLabCreate(ProjectLabBase):
    @model_validator(mode="after")
    def initial_status_must_not_claim_completion(self) -> "ProjectLabCreate":
        if self.status not in ("proposed", "learning"):
            raise ValueError("新项目只能从 proposed 或 learning 开始")
        return self


class ProjectLabUpdate(BaseModel):
    """PATCH：只更新显式提供的字段。"""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=MAX_TITLE_CHARS)
    origin: ProjectLabOrigin | None = None
    status: ProjectLabStatus | None = None
    target_job_id: int | None = Field(default=None, ge=1)
    target_roles: list[str] | None = None
    gap_skills: list[str] | None = None
    problem_statement: str | None = Field(default=None, max_length=MAX_TEXT_CHARS)
    learning_plan: list[str] | None = None
    deliverables: list[str] | None = None
    evidence: list[ProjectEvidence] | None = Field(default=None, max_length=MAX_LIST_ITEMS)
    result_summary: str | None = Field(default=None, max_length=MAX_TEXT_CHARS)
    mastery_notes: str | None = Field(default=None, max_length=MAX_TEXT_CHARS)
    resume_bullets: list[str] | None = None
    interview_questions: list[str] | None = None
    repository_url: str | None = Field(default=None, max_length=1_024)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("项目名称不能为空")
        return cleaned

    @field_validator("origin")
    @classmethod
    def origin_must_be_supported(cls, value: str | None) -> str | None:
        if value is not None and value not in PROJECT_LAB_ORIGINS:
            raise ValueError("未知的项目来源")
        return value

    @field_validator("status")
    @classmethod
    def status_must_be_supported(cls, value: str | None) -> str | None:
        if value is not None and value not in PROJECT_LAB_STATUSES:
            raise ValueError("未知的项目状态")
        return value

    @field_validator(
        "target_roles",
        "gap_skills",
        "learning_plan",
        "deliverables",
        "resume_bullets",
        "interview_questions",
    )
    @classmethod
    def clean_optional_lists(cls, value: list[str] | None, info) -> list[str] | None:
        if value is None:
            return None
        return _clean_list(value, info.field_name)


class ProjectLabClaimDraftsOut(BaseModel):
    """显式把 resume_ready 项目同步为事实台账「待确认」草稿后的结果。"""

    project_id: int
    created_count: int
    existing_count: int
    claim_ids: list[int] = Field(default_factory=list)


class ProjectLabOut(ProjectLabBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    gate_warnings: list[str] = Field(default_factory=list)


__all__ = [
    "ProjectEvidence",
    "ProjectLabClaimDraftsOut",
    "ProjectLabCreate",
    "ProjectLabOrigin",
    "ProjectLabOut",
    "ProjectLabStatus",
    "ProjectLabUpdate",
]
"""Project Lab 的状态机与持久化。

核心规则：不能把还没完成、没验证、自己讲不清楚的项目伪装成正式简历项目。
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from . import trash
from ..models.job import Job
from ..models.project_lab import (
    PROJECT_LAB_STATUS_RANK,
    PROJECT_LAB_STATUS_RESUME_READY,
    PROJECT_LAB_STATUS_VERIFIED,
    ProjectLabProject,
)
from ..schemas.project_lab import ProjectLabCreate, ProjectLabOut, ProjectLabUpdate

MAX_PROJECT_LAB_LIST = 500


def project_gate_warnings(project: ProjectLabProject) -> list[str]:
    warnings: list[str] = []
    rank = PROJECT_LAB_STATUS_RANK.get(project.status, 0)

    if rank >= PROJECT_LAB_STATUS_RANK["implemented"]:
        if not values["deliverables"]:
            raise ValueError("进入 implemented 前必须记录至少一个实际交付物")

    if rank >= PROJECT_LAB_STATUS_RANK[PROJECT_LAB_STATUS_VERIFIED]:
        if not project.evidence:
            warnings.append("已进入验证阶段，但还没有任何证据来源")
        if not (project.result_summary or "").strip():
            warnings.append("已进入验证阶段，但还没有结果总结")

    if rank >= PROJECT_LAB_STATUS_RANK[PROJECT_LAB_STATUS_RESUME_READY]:
        if not (project.mastery_notes or "").strip():
            warnings.append("标记为可写入简历前，需要写清自己真正掌握了什么")
        if not project.resume_bullets:
            warnings.append("标记为可写入简历前，需要准备至少一条简历表述")
        if not project.interview_questions:
            warnings.append("标记为可写入简历前，需要准备面试追问")

    return warnings


def project_out(project: ProjectLabProject) -> ProjectLabOut:
    out = ProjectLabOut.model_validate(project)
    out.gate_warnings = project_gate_warnings(project)
    return out


def _resolve_job(db: Session, target_job_id: int | None) -> int | None:
    """只允许关联仍然存在的正式岗位；错误 ID 不得静默变成 None。"""
    if target_job_id is None:
        return None
    if trash.get_live(db, Job, target_job_id) is None:
        raise ValueError("关联岗位不存在或已被删除")
    return target_job_id


def _validate_transition(current: str, target: str) -> None:
    current_rank = PROJECT_LAB_STATUS_RANK[current]
    target_rank = PROJECT_LAB_STATUS_RANK[target]
    # 允许主动退回任意阶段重新学习/修改；向前最多一次走一级，禁止“一键毕业”。
    if target_rank > current_rank + 1:
        raise ValueError(
            "项目状态不能跳级，请按 proposed → learning → implemented → verified → resume_ready 推进"
        )


def _prospective(project: ProjectLabProject, values: dict) -> dict:
    fields = (
        "status",
        "evidence",
        "result_summary",
        "deliverables",
        "mastery_notes",
        "resume_bullets",
        "interview_questions",
    )
    return {field: values.get(field, getattr(project, field)) for field in fields}


def _validate_gates(values: dict) -> None:
    rank = PROJECT_LAB_STATUS_RANK[values["status"]]

    if rank >= PROJECT_LAB_STATUS_RANK[PROJECT_LAB_STATUS_VERIFIED]:
        if not values["evidence"]:
            raise ValueError("进入 verified 前必须至少添加一条证据来源")
        if not str(values["result_summary"] or "").strip():
            raise ValueError("进入 verified 前必须填写结果总结")

    if rank >= PROJECT_LAB_STATUS_RANK[PROJECT_LAB_STATUS_RESUME_READY]:
        if not str(values["mastery_notes"] or "").strip():
            raise ValueError("进入 resume_ready 前必须填写掌握说明")
        if not values["resume_bullets"]:
            raise ValueError("进入 resume_ready 前必须准备至少一条简历表述")
        if not values["interview_questions"]:
            raise ValueError("进入 resume_ready 前必须准备至少一个面试追问")


def list_projects(
    db: Session, *, status: str = "", target_job_id: int | None = None, limit: int = 200
) -> list[ProjectLabProject]:
    query = db.query(ProjectLabProject)
    if status.strip():
        query = query.filter(ProjectLabProject.status == status.strip())
    if target_job_id is not None:
        query = query.filter(ProjectLabProject.target_job_id == target_job_id)
    return (
        query.order_by(ProjectLabProject.updated_at.desc(), ProjectLabProject.id.desc())
        .limit(max(1, min(limit, MAX_PROJECT_LAB_LIST)))
        .all()
    )


def project_or_none(db: Session, project_id: int) -> ProjectLabProject | None:
    return db.get(ProjectLabProject, project_id)


def create_project(db: Session, payload: ProjectLabCreate) -> ProjectLabProject:
    values = payload.model_dump()
    values["target_job_id"] = _resolve_job(db, values.get("target_job_id"))
    project = ProjectLabProject(**values)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(
    db: Session, project: ProjectLabProject, payload: ProjectLabUpdate
) -> ProjectLabProject:
    values = payload.model_dump(exclude_unset=True)
    if "target_job_id" in values:
        values["target_job_id"] = _resolve_job(db, values.get("target_job_id"))

    target_status = values.get("status", project.status)
    _validate_transition(project.status, target_status)
    _validate_gates(_prospective(project, values))

    for field, value in values.items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: int) -> bool:
    project = db.get(ProjectLabProject, project_id)
    if project is None:
        return False
    db.delete(project)
    db.commit()
    return True


__all__ = [
    "MAX_PROJECT_LAB_LIST",
    "create_project",
    "delete_project",
    "list_projects",
    "project_gate_warnings",
    "project_or_none",
    "project_out",
    "update_project",
]
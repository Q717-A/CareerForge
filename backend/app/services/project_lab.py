"""Project Lab 的状态机与持久化。

核心规则：不能把还没完成、没验证、自己讲不清楚的项目伪装成正式简历项目。
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from . import trash
from ..models.claim import (
    CLAIM_CATEGORY_PROJECT,
    RESPONSIBILITY_PARTICIPATED,
    VERIFICATION_PENDING,
    ClaimRecord,
)
from ..models.job import Job
from ..models.project_lab import (
    PROJECT_LAB_STATUS_IMPLEMENTED,
    PROJECT_LAB_STATUS_RANK,
    PROJECT_LAB_STATUS_RESUME_READY,
    PROJECT_LAB_STATUS_VERIFIED,
    ProjectLabProject,
)
from ..schemas.claim import ClaimCreate, SOURCE_TYPES
from ..schemas.project_lab import (
    ProjectLabClaimDraftsOut,
    ProjectLabCreate,
    ProjectLabOut,
    ProjectLabUpdate,
)
from .claims import create_claim

MAX_PROJECT_LAB_LIST = 500


def project_gate_warnings(project: ProjectLabProject) -> list[str]:
    warnings: list[str] = []
    rank = PROJECT_LAB_STATUS_RANK.get(project.status, 0)

    if rank >= PROJECT_LAB_STATUS_RANK[PROJECT_LAB_STATUS_IMPLEMENTED] and not project.deliverables:
        warnings.append("已进入实现阶段，但还没有记录任何实际交付物")

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

    if rank >= PROJECT_LAB_STATUS_RANK[PROJECT_LAB_STATUS_IMPLEMENTED]:
        if not values["deliverables"]:
            raise ValueError("进入 implemented 前必须记录至少一个实际交付物")

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



def _claim_source_marker(project_id: int, bullet_index: int) -> str:
    """一条 Project Lab 简历表述在事实台账里的稳定来源标记。"""
    return f"project-lab://project/{project_id}/resume-bullet/{bullet_index}"


def _project_claim_sources(project: ProjectLabProject, marker: str) -> list[dict]:
    """把 Project Lab 证据映射到事实台账来源；内部标记永远保留在第一条。"""
    sources: list[dict] = [
        {
            "type": "other",
            "location": marker,
            "public": False,
            "note": f"由 Project Lab #{project.id} 显式转入；原项目仍是证据总入口",
        }
    ]
    seen_locations = {marker}
    for evidence in project.evidence:
        location = str(evidence.get("location") or "").strip()
        if not location or location in seen_locations:
            continue
        evidence_type = str(evidence.get("type") or "other").strip()
        if evidence_type not in SOURCE_TYPES:
            evidence_type = "other"
        sources.append(
            {
                "type": evidence_type,
                "location": location[:1024],
                "public": location.startswith(("http://", "https://")),
                "note": str(evidence.get("note") or "").strip()[:500],
            }
        )
        seen_locations.add(location)
        # ClaimSource 最多 10 条；其余证据仍可通过第一条内部标记回到 Project Lab 查看。
        if len(sources) >= 10:
            break
    if project.repository_url and project.repository_url not in seen_locations and len(sources) < 10:
        sources.append(
            {
                "type": "repository",
                "location": project.repository_url[:1024],
                "public": project.repository_url.startswith(("http://", "https://")),
                "note": "Project Lab 项目仓库",
            }
        )
    return sources


def _existing_claim_for_marker(
    db: Session, project: ProjectLabProject, marker: str
) -> ClaimRecord | None:
    """查找仍存活的同源台账条目，保证重复点击转换不会复制出多份草稿。"""
    records = (
        db.query(ClaimRecord)
        .filter(trash.live_only(ClaimRecord), ClaimRecord.subject == project.title)
        .all()
    )
    for record in records:
        if any(str(source.get("location") or "") == marker for source in (record.sources or [])):
            return record
    return None


def create_claim_drafts_from_project(
    db: Session, project: ProjectLabProject
) -> ProjectLabClaimDraftsOut:
    """把一个 resume_ready 项目显式同步为事实台账待确认草稿。

    这里故意**不**创建「已确认」事实：Project Lab 的验证回答的是“项目是否真的做完并能讲清”，
    事实台账还要再次核对对外表述、个人边界和承担程度。重复调用按来源标记幂等复用。
    """
    if project.status != PROJECT_LAB_STATUS_RESUME_READY:
        raise ValueError("只有达到 resume_ready 的项目才能转入事实台账草稿")
    _validate_gates(_prospective(project, {}))

    source_fact_parts = [
        "Project Lab 已完成项目。",
        "交付物：" + "；".join(project.deliverables),
        "结果总结：" + project.result_summary.strip(),
        "掌握说明：" + project.mastery_notes.strip(),
    ]
    source_fact = "\n".join(source_fact_parts)
    verification_details = [
        str(item.get("location") or "").strip()[:1000]
        for item in project.evidence
        if str(item.get("location") or "").strip()
    ][:20]

    claim_ids: list[int] = []
    created = 0
    existing = 0
    for index, bullet in enumerate(project.resume_bullets, start=1):
        marker = _claim_source_marker(project.id, index)
        current = _existing_claim_for_marker(db, project, marker)
        if current is not None:
            claim_ids.append(current.id)
            existing += 1
            continue

        payload = ClaimCreate(
            title=f"{project.title} · 简历表述 {index}",
            category=CLAIM_CATEGORY_PROJECT,
            subject=project.title,
            source_fact=source_fact,
            candidate_wording=(
                f"{bullet}【待确认：从 Project Lab 转入，请核对表述与个人边界】"
            ),
            sources=_project_claim_sources(project, marker),
            responsibility_level=RESPONSIBILITY_PARTICIPATED,
            verification_status=VERIFICATION_PENDING,
            allowed_uses=[],
            interview_details={
                "decisions": [],
                "difficulties": [],
                "verification": verification_details,
                "result": project.result_summary,
            },
            boundary="【待补：请核对并写清个人承担范围】",
            risk_notes=[
                "由 Project Lab 转入的草稿；只有在事实台账中再次确认后才能进入正式简历。"
            ],
            last_verified="",
        )
        record = create_claim(db, payload)
        claim_ids.append(record.id)
        created += 1

    return ProjectLabClaimDraftsOut(
        project_id=project.id,
        created_count=created,
        existing_count=existing,
        claim_ids=claim_ids,
    )


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
    "create_claim_drafts_from_project",
    "create_project",
    "delete_project",
    "list_projects",
    "project_gate_warnings",
    "project_or_none",
    "project_out",
    "update_project",
]
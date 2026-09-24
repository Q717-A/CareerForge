"""Project Lab API。

V1 先提供稳定的数据边界和状态闸门；自动生成项目、转事实台账与前端页面放在后续提交。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.project_lab import PROJECT_LAB_STATUSES
from ..schemas.project_lab import ProjectLabCreate, ProjectLabOut, ProjectLabUpdate
from ..services.project_lab import (
    create_project,
    delete_project,
    list_projects,
    project_or_none,
    project_out,
    update_project,
)

router = APIRouter(prefix="/api/project-lab", tags=["project-lab"])


@router.get("", response_model=list[ProjectLabOut])
def read_projects(
    status: str = Query(default=""),
    target_job_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    if status and status not in PROJECT_LAB_STATUSES:
        raise HTTPException(status_code=422, detail="未知的 Project Lab 状态")
    return [
        project_out(project)
        for project in list_projects(
            db, status=status, target_job_id=target_job_id, limit=limit
        )
    ]


@router.get("/{project_id}", response_model=ProjectLabOut)
def read_project(project_id: int, db: Session = Depends(get_db)):
    project = project_or_none(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project Lab 项目不存在")
    return project_out(project)


@router.post("", response_model=ProjectLabOut, status_code=201)
def create_project_entry(payload: ProjectLabCreate, db: Session = Depends(get_db)):
    try:
        return project_out(create_project(db, payload))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/{project_id}", response_model=ProjectLabOut)
def patch_project(project_id: int, payload: ProjectLabUpdate, db: Session = Depends(get_db)):
    project = project_or_none(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project Lab 项目不存在")
    try:
        return project_out(update_project(db, project, payload))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/{project_id}", status_code=204)
def remove_project(project_id: int, db: Session = Depends(get_db)):
    if not delete_project(db, project_id):
        raise HTTPException(status_code=404, detail="Project Lab 项目不存在")
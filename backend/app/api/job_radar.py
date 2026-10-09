"""公开网页招聘线索搜索和用户显式暂存，不对真实在招状态作保证。"""
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas.job_radar import (
    RadarHit,
    RadarSearchOut,
    RadarSearchRequest,
    RadarStageOut,
    RadarStageRequest,
    RadarStageOutcome,
    valid_source_url,
)
from ..services.assistant.assistant_web_search import AssistantSearchError
from ..services.candidate_jobs import find_staged_candidate, stage_candidate_job
from ..services.job.job_service import find_job_by_identity
from ..services.search.aggregate import aggregate_search
from ..services.settings_service import get_search_config

router = APIRouter(prefix="/api/job-radar", tags=["job-radar"])


@router.post("/search", response_model=RadarSearchOut)
async def search_radar(payload: RadarSearchRequest, db: Session = Depends(get_db)):
    """只读公开搜索；不写候选/正式岗位，也不抓取任意结果页面。"""
    parts = [payload.keywords, payload.company, payload.city, payload.job_type, "招聘 职位"]
    query = " ".join(part for part in parts if part)
    config = get_search_config(db).model_copy(update={"fetch_pages": 0})
    db.close()
    try:
        results = await aggregate_search(query, config)
    except AssistantSearchError as exc:
        return RadarSearchOut(warning=str(exc))

    hits: list[RadarHit] = []
    seen: set[str] = set()
    for result in results:
        url = str(result.get("url") or "").strip()
        if not valid_source_url(url) or len(url) > 1024 or url in seen:
            continue
        seen.add(url)
        hits.append(
            RadarHit(
                title=str(result.get("title") or "未命名招聘网页")[:255],
                url=url,
                snippet=str(result.get("snippet") or "")[:1200],
                host=urlsplit(url).hostname or "",
            )
        )
    return RadarSearchOut(items=hits)


@router.post("/stage", response_model=RadarStageOut)
def stage_radar_results(payload: RadarStageRequest, db: Session = Depends(get_db)):
    """用户勾选后才保存为备选线索，复用正式岗位与暂存区的去重判据。"""
    outcomes: list[RadarStageOutcome] = []
    seen: set[str] = set()
    created = existing = 0

    for item in payload.items:
        if item.source_url in seen:
            continue
        seen.add(item.source_url)
        job = find_job_by_identity(
            db, title=item.title, company=item.company, source_url=item.source_url
        )
        if job is not None:
            existing += 1
            outcomes.append(
                RadarStageOutcome(source_url=item.source_url, status="existing_job", job_id=job.id)
            )
            continue
        candidate = find_staged_candidate(
            db, title=item.title, company=item.company, source_url=item.source_url
        )
        if candidate is not None:
            existing += 1
            outcomes.append(
                RadarStageOutcome(
                    source_url=item.source_url,
                    status="existing_candidate",
                    candidate_id=candidate.id,
                )
            )
            continue
        staged = stage_candidate_job(
            db,
            title=item.title,
            company=item.company,
            source_url=item.source_url,
            description=item.snippet,
            source="联网搜索线索",
        )
        staged.note = "网络搜索发现，岗位真实性及是否仍在招聘尚待人工确认。"
        created += 1
        outcomes.append(
            RadarStageOutcome(
                source_url=item.source_url,
                status="created",
                candidate_id=staged.id,
            )
        )
    db.commit()
    return RadarStageOut(created=created, existing=existing, outcomes=outcomes)

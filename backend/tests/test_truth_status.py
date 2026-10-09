"""Truth Engine: explicit inference/learning claims never enter official résumé facts."""
from app.models.claim import TRUTH_BLOCKED_FROM_FINAL


def _payload(**changes):
    data = {
        "title": "机构设计",
        "category": "项目经历",
        "subject": "机构设计",
        "source_fact": "使用 SolidWorks 完成三维建模。",
        "candidate_wording": "完成机械机构三维建模。",
        "verification_status": "待确认",
        "sources": [{"type": "repository", "location": "https://example.org/project"}],
    }
    data.update(changes)
    return data


def test_invalid_grade_and_unverified_confirmation_rejected(client):
    assert client.post("/api/claims", json=_payload(truth_status="HALLUCINATED")).status_code == 422
    for grade in TRUTH_BLOCKED_FROM_FINAL:
        response = client.post(
            "/api/claims",
            json=_payload(truth_status=grade, verification_status="已确认"),
        )
        assert response.status_code == 422, grade


def test_existing_inference_cannot_be_promoted_without_review(client):
    created = client.post("/api/claims", json=_payload(truth_status="INFERRED"))
    assert created.status_code == 201
    claim = created.json()
    assert claim["truth_status"] == "INFERRED"
    blocked = client.put(
        f"/api/claims/{claim['id']}",
        json=_payload(truth_status="INFERRED", verification_status="已确认"),
    )
    assert blocked.status_code == 422
    assert client.get("/api/claims/baseline").json()["confirmed_count"] == 0


def test_verified_and_reframed_require_sources_then_enter_baseline(client):
    no_evidence = client.post(
        "/api/claims",
        json=_payload(truth_status="VERIFIED", verification_status="已确认", sources=[]),
    )
    assert no_evidence.status_code == 422

    for grade in ("VERIFIED", "REFRAMED"):
        response = client.post(
            "/api/claims",
            json=_payload(title=grade, truth_status=grade, verification_status="已确认"),
        )
        assert response.status_code == 201, response.text

    baseline = client.get("/api/claims/baseline").json()
    assert baseline["confirmed_count"] == 2
    assert "VERIFIED" in baseline["baseline_text"]
    assert "REFRAMED" in baseline["baseline_text"]


def test_legacy_record_remains_ungraded_and_usable_until_manual_review(client):
    old = client.post("/api/claims", json=_payload(verification_status="已确认"))
    assert old.status_code == 201
    assert old.json()["truth_status"] is None
    assert client.get("/api/claims/baseline").json()["confirmed_count"] == 1

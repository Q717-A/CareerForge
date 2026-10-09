"""Job Radar: search is read-only, staging is explicit and traceable."""
from app.services.assistant.assistant_web_search import AssistantSearchError


def test_job_radar_stages_only_selected_and_deduplicates(client, monkeypatch):
    async def fake_search(query, config):
        assert "机械设计" in query and "上海" in query
        assert config.fetch_pages == 0
        return [
            {
                "title": "机械设计工程师招聘",
                "url": "https://careers.example.com/jobs/123",
                "snippet": "岗位职责、任职要求请以官网为准。",
            },
            {
                "title": "不安全网页",
                "url": "javascript:alert(1)",
                "snippet": "",
            },
        ]

    monkeypatch.setattr("app.api.job_radar.aggregate_search", fake_search)
    response = client.post(
        "/api/job-radar/search", json={"keywords": "机械设计", "city": "上海", "job_type": "校招"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert "不代表岗位仍在招聘" in data["disclaimer"]
    assert client.get("/api/candidate-jobs").json() == []

    selection = {
        "items": [
            {
                "title": data["items"][0]["title"],
                "source_url": data["items"][0]["url"],
                "snippet": data["items"][0]["snippet"],
            }
        ]
    }
    staged = client.post("/api/job-radar/stage", json=selection)
    assert staged.status_code == 200
    assert staged.json()["created"] == 1
    candidates = client.get("/api/candidate-jobs").json()
    assert len(candidates) == 1
    assert candidates[0]["source_url"] == "https://careers.example.com/jobs/123"
    assert candidates[0]["source"] == "联网搜索线索"
    assert candidates[0]["status"] == "pending"

    repeat = client.post("/api/job-radar/stage", json=selection)
    assert repeat.status_code == 200
    assert repeat.json()["created"] == 0
    assert repeat.json()["existing"] == 1
    assert len(client.get("/api/candidate-jobs").json()) == 1

    imported = client.post(
        "/api/candidate-jobs/import", json={"candidate_ids": [candidates[0]["id"]]}
    )
    assert imported.status_code == 200
    assert imported.json()["imported"] == 1
    job_id = imported.json()["results"][0]["job_id"]
    job = client.get(f"/api/jobs/{job_id}").json()
    assert job["source_url"] == candidates[0]["source_url"]
    assert job["description"] == candidates[0]["description"]


def test_job_radar_rejects_invalid_url_without_writes(client):
    response = client.post(
        "/api/job-radar/stage",
        json={"items": [{"title": "测试", "source_url": "file:///etc/passwd"}]},
    )
    assert response.status_code == 422
    assert client.get("/api/candidate-jobs").json() == []


def test_job_radar_source_errors_do_not_fabricate_positions(client, monkeypatch):
    async def failing_search(query, config):
        raise AssistantSearchError("搜索引擎暂时不可用")

    monkeypatch.setattr("app.api.job_radar.aggregate_search", failing_search)
    result = client.post("/api/job-radar/search", json={"keywords": "算法工程师"})
    assert result.status_code == 200
    assert result.json()["items"] == []
    assert "搜索引擎暂时不可用" in result.json()["warning"]
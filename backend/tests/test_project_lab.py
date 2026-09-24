"""CareerForge Project Lab 的核心闸门回归测试。"""


def _create(client):
    response = client.post(
        "/api/project-lab",
        json={
            "title": "基于公开数据集的轴承故障诊断",
            "origin": "job_gap",
            "gap_skills": ["Python", "信号处理", "1D-CNN"],
            "learning_plan": ["完成数据预处理", "训练传统模型", "训练 1D-CNN"],
        },
    )
    assert response.status_code == 201
    return response.json()


def test_project_lab_cannot_skip_status(client):
    project = _create(client)
    response = client.patch(
        f"/api/project-lab/{project['id']}",
        json={"status": "implemented"},
    )
    assert response.status_code == 422
    assert "不能跳级" in response.json()["detail"]


def test_project_lab_verified_and_resume_ready_gates(client):
    project = _create(client)
    project_id = project["id"]

    assert client.patch(
        f"/api/project-lab/{project_id}", json={"status": "learning"}
    ).status_code == 200
    assert client.patch(
        f"/api/project-lab/{project_id}", json={"status": "implemented"}
    ).status_code == 200

    blocked = client.patch(
        f"/api/project-lab/{project_id}", json={"status": "verified"}
    )
    assert blocked.status_code == 422
    assert "证据" in blocked.json()["detail"]

    verified = client.patch(
        f"/api/project-lab/{project_id}",
        json={
            "status": "verified",
            "evidence": [
                {
                    "type": "repository",
                    "location": "https://github.com/example/project",
                    "note": "代码与实验记录",
                }
            ],
            "result_summary": "完成传统模型与 1D-CNN 对比实验，并保存可复现实验结果。",
        },
    )
    assert verified.status_code == 200
    assert verified.json()["status"] == "verified"

    blocked_ready = client.patch(
        f"/api/project-lab/{project_id}", json={"status": "resume_ready"}
    )
    assert blocked_ready.status_code == 422
    assert "掌握说明" in blocked_ready.json()["detail"]

    ready = client.patch(
        f"/api/project-lab/{project_id}",
        json={
            "status": "resume_ready",
            "mastery_notes": "能够解释数据预处理、FFT 特征、基线模型与 1D-CNN 的差异。",
            "resume_bullets": [
                "基于公开轴承数据完成故障诊断实验，对比传统模型与 1D-CNN。"
            ],
            "interview_questions": [
                "为什么使用 1D-CNN，而不是直接使用二维时频图？"
            ],
        },
    )
    assert ready.status_code == 200
    assert ready.json()["status"] == "resume_ready"
    assert ready.json()["gate_warnings"] == []


def test_project_lab_list_filter(client):
    project = _create(client)
    response = client.get("/api/project-lab", params={"status": "proposed"})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [project["id"]]

def test_project_lab_crud_smoke(client):
    project = _create(client)
    project_id = project["id"]

    fetched = client.get(f"/api/project-lab/{project_id}")
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "基于公开数据集的轴承故障诊断"

    updated = client.patch(
        f"/api/project-lab/{project_id}",
        json={
            "problem_statement": "验证公开轴承数据上的故障识别流程。",
            "target_roles": ["故障诊断算法工程师"],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["problem_statement"] == "验证公开轴承数据上的故障识别流程。"

    removed = client.delete(f"/api/project-lab/{project_id}")
    assert removed.status_code == 204
    assert client.get(f"/api/project-lab/{project_id}").status_code == 404


def test_project_lab_unknown_status_is_rejected(client):
    response = client.get("/api/project-lab", params={"status": "done"})
    assert response.status_code == 422

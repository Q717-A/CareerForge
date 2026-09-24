/**
 * Project Lab 首个前端纵向切片：显示真实关联、创建入口、proposed → learning。
 */
import { App as AntdApp } from "antd";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectLabProject } from "../types";
import ProjectLabPage from "./ProjectLabPage";

const projectApi = vi.hoisted(() => ({
  listProjectLabProjects: vi.fn(),
  createProjectLabProject: vi.fn(),
  updateProjectLabProject: vi.fn(),
}));

const jobsApi = vi.hoisted(() => ({
  listJobs: vi.fn(),
}));

vi.mock("../api/projectLab", () => projectApi);
vi.mock("../api/jobs", () => jobsApi);

function project(overrides: Partial<ProjectLabProject> = {}): ProjectLabProject {
  return {
    id: 1,
    title: "机械结构仿真补强项目",
    origin: "job_gap",
    status: "proposed",
    target_job_id: 7,
    target_roles: [],
    gap_skills: ["ADAMS", "动力学仿真"],
    problem_statement: "",
    learning_plan: [],
    deliverables: [],
    evidence: [],
    result_summary: "",
    mastery_notes: "",
    resume_bullets: [],
    interview_questions: [],
    repository_url: "",
    created_at: "2026-09-24T00:00:00",
    updated_at: "2026-09-24T00:00:00",
    gate_warnings: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <AntdApp>
      <ProjectLabPage />
    </AntdApp>,
  );
}

beforeEach(() => {
  for (const mock of Object.values(projectApi)) mock.mockReset();
  jobsApi.listJobs.mockReset();
  jobsApi.listJobs.mockResolvedValue({
    items: [
      {
        id: 7,
        title: "机械设计工程师",
        company: "示例公司",
      },
    ],
    total: 1,
  });
});

afterEach(() => cleanup());

describe("ProjectLabPage", () => {
  it("shows the real job link and gap skills", async () => {
    projectApi.listProjectLabProjects.mockResolvedValue([project()]);
    renderPage();

    expect(await screen.findByText("机械结构仿真补强项目")).toBeInTheDocument();
    expect(screen.getByText("目标岗位：示例公司 · 机械设计工程师")).toBeInTheDocument();
    expect(screen.getByText("ADAMS")).toBeInTheDocument();
    expect(screen.getByText("动力学仿真")).toBeInTheDocument();
  });

  it("only exposes the first verified transition in this slice", async () => {
    projectApi.listProjectLabProjects
      .mockResolvedValueOnce([project()])
      .mockResolvedValueOnce([project({ status: "learning" })]);
    projectApi.updateProjectLabProject.mockResolvedValue(project({ status: "learning" }));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "开始学习" }));

    await waitFor(() => {
      expect(projectApi.updateProjectLabProject).toHaveBeenCalledWith(1, { status: "learning" });
    });
    expect(await screen.findByText("学习中")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开始学习" })).not.toBeInTheDocument();
  });

  it("opens a creation form without pretending the project is already completed", async () => {
    projectApi.listProjectLabProjects.mockResolvedValue([]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /新建补强项目/ }));

    expect(screen.getByLabelText("项目名称")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "关联目标岗位" })).toBeInTheDocument();
    expect(screen.getByLabelText("能力缺口")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存项目" })).toBeInTheDocument();
  });

  it("creates a job-gap project with the selected real job", async () => {
    projectApi.listProjectLabProjects.mockResolvedValue([]);
    projectApi.createProjectLabProject.mockResolvedValue(project());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /新建补强项目/ }));
    fireEvent.change(screen.getByLabelText("项目名称"), {
      target: { value: "机械结构仿真补强项目" },
    });
    fireEvent.change(screen.getByLabelText("能力缺口"), {
      target: { value: "ADAMS，动力学仿真" },
    });

    const jobSelect = screen.getByRole("combobox", { name: "关联目标岗位" });
    fireEvent.mouseDown(jobSelect);
    fireEvent.click(await screen.findByText("示例公司 · 机械设计工程师"));
    fireEvent.click(screen.getByRole("button", { name: "保存项目" }));

    await waitFor(() => {
      expect(projectApi.createProjectLabProject).toHaveBeenCalledWith({
        title: "机械结构仿真补强项目",
        origin: "job_gap",
        target_job_id: 7,
        gap_skills: ["ADAMS", "动力学仿真"],
      });
    });
  });

  it("does not hide a persisted job relation when the job list cannot resolve it", async () => {
    jobsApi.listJobs.mockResolvedValue({ items: [], total: 0 });
    projectApi.listProjectLabProjects.mockResolvedValue([project()]);
    renderPage();

    expect(
      await screen.findByText("目标岗位：#7（已删除或未加载到当前岗位列表）"),
    ).toBeInTheDocument();
  });
});

/**
 * Project Lab 首个前端纵向切片：显示真实关联、创建入口、proposed → learning。
 */
import { App as AntdApp } from "antd";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectLabProject } from "../types";
import ProjectLabPage from "./ProjectLabPage";

const projectApi = vi.hoisted(() => ({
  createProjectLabClaimDrafts: vi.fn(),
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

  it("requires a real deliverable before moving learning to implemented", async () => {
    projectApi.listProjectLabProjects
      .mockResolvedValueOnce([project({ status: "learning", deliverables: [] })])
      .mockResolvedValueOnce([
        project({
          status: "implemented",
          deliverables: ["完成数据预处理脚本", "完成 1D-CNN 训练脚本"],
        }),
      ]);
    projectApi.updateProjectLabProject.mockResolvedValue(
      project({
        status: "implemented",
        deliverables: ["完成数据预处理脚本", "完成 1D-CNN 训练脚本"],
      }),
    );
    renderPage();

    const input = await screen.findByLabelText("项目 1 已完成交付物");
    fireEvent.change(input, {
      target: { value: "完成数据预处理脚本\n完成 1D-CNN 训练脚本" },
    });
    fireEvent.click(screen.getByRole("button", { name: "记录交付物并标记已实现" }));

    await waitFor(() => {
      expect(projectApi.updateProjectLabProject).toHaveBeenCalledWith(1, {
        status: "implemented",
        deliverables: ["完成数据预处理脚本", "完成 1D-CNN 训练脚本"],
      });
    });
    expect(await screen.findByText("已实现")).toBeInTheDocument();
    expect(screen.getByText("完成数据预处理脚本")).toBeInTheDocument();
  });

  it("requires evidence and a result summary before marking a project verified", async () => {
    const implemented = project({
      status: "implemented",
      deliverables: ["完成可复现实验脚本"],
    });
    const verified = project({
      status: "verified",
      deliverables: ["完成可复现实验脚本"],
      evidence: [
        {
          type: "repository",
          location: "https://github.com/example/fault-diagnosis",
          note: "代码与实验记录",
        },
      ],
      result_summary: "完成传统模型与 1D-CNN 对比实验并保存结果。",
    });
    projectApi.listProjectLabProjects
      .mockResolvedValueOnce([implemented])
      .mockResolvedValueOnce([verified]);
    projectApi.updateProjectLabProject.mockResolvedValue(verified);
    renderPage();

    fireEvent.change(await screen.findByLabelText("项目 1 证据位置"), {
      target: { value: "https://github.com/example/fault-diagnosis" },
    });
    fireEvent.change(screen.getByLabelText("项目 1 证据备注"), {
      target: { value: "代码与实验记录" },
    });
    fireEvent.change(screen.getByLabelText("项目 1 结果总结"), {
      target: { value: "完成传统模型与 1D-CNN 对比实验并保存结果。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存证据并标记已验证" }));

    await waitFor(() => {
      expect(projectApi.updateProjectLabProject).toHaveBeenCalledWith(1, {
        status: "verified",
        evidence: [
          {
            type: "repository",
            location: "https://github.com/example/fault-diagnosis",
            note: "代码与实验记录",
          },
        ],
        result_summary: "完成传统模型与 1D-CNN 对比实验并保存结果。",
      });
    });
    expect(await screen.findByText("已验证")).toBeInTheDocument();
    expect(screen.getByText(/结果总结：完成传统模型/)).toBeInTheDocument();
  });

  it("requires mastery, resume wording, and interview questions before resume-ready", async () => {
    const verified = project({
      status: "verified",
      deliverables: ["完成可复现实验脚本"],
      evidence: [
        {
          type: "repository",
          location: "https://github.com/example/fault-diagnosis",
          note: "代码与实验记录",
        },
      ],
      result_summary: "完成传统模型与 1D-CNN 对比实验并保存结果。",
    });
    const ready = project({
      ...verified,
      status: "resume_ready",
      mastery_notes: "能够解释预处理、模型结构选择和误差来源。",
      resume_bullets: ["基于公开轴承数据完成故障诊断实验，对比传统模型与 1D-CNN。"],
      interview_questions: ["为什么选择 1D-CNN？"],
    });
    projectApi.listProjectLabProjects
      .mockResolvedValueOnce([verified])
      .mockResolvedValueOnce([ready]);
    projectApi.updateProjectLabProject.mockResolvedValue(ready);
    renderPage();

    fireEvent.change(await screen.findByLabelText("项目 1 掌握说明"), {
      target: { value: "能够解释预处理、模型结构选择和误差来源。" },
    });
    fireEvent.change(screen.getByLabelText("项目 1 简历表述"), {
      target: { value: "基于公开轴承数据完成故障诊断实验，对比传统模型与 1D-CNN。" },
    });
    fireEvent.change(screen.getByLabelText("项目 1 面试追问"), {
      target: { value: "为什么选择 1D-CNN？" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完成掌握检查并允许写入简历" }));

    await waitFor(() => {
      expect(projectApi.updateProjectLabProject).toHaveBeenCalledWith(1, {
        status: "resume_ready",
        mastery_notes: "能够解释预处理、模型结构选择和误差来源。",
        resume_bullets: ["基于公开轴承数据完成故障诊断实验，对比传统模型与 1D-CNN。"],
        interview_questions: ["为什么选择 1D-CNN？"],
      });
    });
    expect(await screen.findByText("可写入简历")).toBeInTheDocument();
    expect(screen.getByText(/后续仍需显式转入事实台账/)).toBeInTheDocument();
  });

  it("converts a resume-ready project into pending claim drafts only on explicit click", async () => {
    projectApi.listProjectLabProjects.mockResolvedValue([
      project({
        status: "resume_ready",
        deliverables: ["完成可复现实验脚本"],
        evidence: [
          {
            type: "repository",
            location: "https://github.com/example/fault-diagnosis",
            note: "代码与实验记录",
          },
        ],
        result_summary: "完成传统模型与 1D-CNN 对比实验并保存结果。",
        mastery_notes: "能够解释预处理、模型结构选择和误差来源。",
        resume_bullets: ["基于公开轴承数据完成故障诊断实验，对比传统模型与 1D-CNN。"],
        interview_questions: ["为什么选择 1D-CNN？"],
      }),
    ]);
    projectApi.createProjectLabClaimDrafts.mockResolvedValue({
      project_id: 1,
      created_count: 1,
      existing_count: 0,
      claim_ids: [42],
    });

    renderPage();

    const button = await screen.findByRole("button", { name: "转入事实台账待确认" });
    expect(projectApi.createProjectLabClaimDrafts).not.toHaveBeenCalled();

    fireEvent.click(button);

    await waitFor(() => {
      expect(projectApi.createProjectLabClaimDrafts).toHaveBeenCalledWith(1);
    });
    expect(await screen.findByText(/已生成 1 条待确认事实草稿/)).toBeInTheDocument();
  });

});

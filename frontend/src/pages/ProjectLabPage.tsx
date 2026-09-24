/**
 * Project Lab 第一条纵向切片。
 *
 * 当前只开放已经有后端验证规则支撑的动作：查看项目、创建项目、关联真实岗位、
 * proposed → learning。更高状态故意不在这一版 UI 里提前暴露，等对应表单和验证闭环完成再放开。
 */
import { ExperimentOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Card, Empty, Input, Select, Skeleton, Space, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { listJobs } from "../api/jobs";
import {
  createProjectLabProject,
  listProjectLabProjects,
  updateProjectLabProject,
} from "../api/projectLab";
import { useApi } from "../hooks/useApi";
import type { ProjectLabProject } from "../types";

const STATUS_LABELS: Record<ProjectLabProject["status"], string> = {
  proposed: "建议项目",
  learning: "学习中",
  implemented: "已实现",
  verified: "已验证",
  resume_ready: "可写入简历",
};

const STATUS_COLORS: Record<ProjectLabProject["status"], string> = {
  proposed: "default",
  learning: "blue",
  implemented: "gold",
  verified: "green",
  resume_ready: "purple",
};

function splitSkills(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[，,、;；\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export default function ProjectLabPage() {
  const { message } = App.useApp();
  const projects = useApi(() => listProjectLabProjects(), []);
  const jobs = useApi(() => listJobs({ page: 1, page_size: 100 }), []);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [targetJobId, setTargetJobId] = useState<number | undefined>();
  const [skills, setSkills] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advancingId, setAdvancingId] = useState<number | null>(null);
  const [deliverableDrafts, setDeliverableDrafts] = useState<Record<number, string>>({});
  const [verificationDrafts, setVerificationDrafts] = useState<
    Record<number, { evidenceLocation: string; evidenceNote: string; resultSummary: string }>
  >({});

  const jobMap = useMemo(
    () => new Map((jobs.data?.items ?? []).map((job) => [job.id, job])),
    [jobs.data],
  );
  const jobOptions = useMemo(
    () =>
      (jobs.data?.items ?? []).map((job) => ({
        value: job.id,
        label: `${job.company ? `${job.company} · ` : ""}${job.title}`,
      })),
    [jobs.data],
  );

  const resetCreate = () => {
    setCreating(false);
    setTitle("");
    setTargetJobId(undefined);
    setSkills("");
  };

  const create = async () => {
    if (!title.trim()) {
      message.warning("请先填写项目名称");
      return;
    }
    setSubmitting(true);
    try {
      await createProjectLabProject({
        title: title.trim(),
        origin: targetJobId ? "job_gap" : "manual",
        target_job_id: targetJobId ?? null,
        gap_skills: splitSkills(skills),
      });
      message.success("项目已创建，当前仍是「建议项目」状态");
      resetCreate();
      await projects.reload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const startLearning = async (project: ProjectLabProject) => {
    setAdvancingId(project.id);
    try {
      await updateProjectLabProject(project.id, { status: "learning" });
      message.success("已进入学习阶段");
      await projects.reload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "状态更新失败");
    } finally {
      setAdvancingId(null);
    }
  };

  const markImplemented = async (project: ProjectLabProject) => {
    const draft = deliverableDrafts[project.id] ?? "";
    const deliverables = Array.from(
      new Set([
        ...project.deliverables,
        ...draft
          .split(/[\n，,;；]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ]),
    );
    if (deliverables.length === 0) {
      message.warning("请先记录至少一个实际交付物");
      return;
    }

    setAdvancingId(project.id);
    try {
      await updateProjectLabProject(project.id, {
        status: "implemented",
        deliverables,
      });
      message.success("已记录交付物并进入「已实现」阶段");
      setDeliverableDrafts((current) => ({ ...current, [project.id]: "" }));
      await projects.reload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "状态更新失败");
    } finally {
      setAdvancingId(null);
    }
  };

  const markVerified = async (project: ProjectLabProject) => {
    const draft = verificationDrafts[project.id];
    const evidenceLocation = (draft?.evidenceLocation ?? "").trim();
    const evidenceNote = (draft?.evidenceNote ?? "").trim();
    const resultSummary = (draft?.resultSummary ?? project.result_summary).trim();

    const evidence = [...project.evidence];
    if (evidenceLocation && !evidence.some((item) => item.location === evidenceLocation)) {
      evidence.push({
        type: evidenceLocation.includes("github.com") ? "repository" : "other",
        location: evidenceLocation,
        note: evidenceNote,
      });
    }
    if (evidence.length === 0) {
      message.warning("请先添加至少一条可回溯的证据");
      return;
    }
    if (!resultSummary) {
      message.warning("请先填写结果总结");
      return;
    }

    setAdvancingId(project.id);
    try {
      await updateProjectLabProject(project.id, {
        status: "verified",
        evidence,
        result_summary: resultSummary,
      });
      message.success("项目证据已核对，进入「已验证」阶段");
      setVerificationDrafts((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      await projects.reload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "验证失败");
    } finally {
      setAdvancingId(null);
    }
  };

  return (
    <div className="project-lab-page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <Space direction="vertical" size={0}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            项目实验室
          </Typography.Title>
          <Typography.Text type="secondary">
            把岗位缺口变成真正做完、能解释、可验证的项目。AI
            推荐的项目不会因为创建了就自动进入简历。
          </Typography.Text>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreating((value) => !value)}
        >
          新建补强项目
        </Button>
      </div>

      {creating && (
        <Card size="small" style={{ marginBottom: 16 }} title="创建项目草稿">
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Input
              aria-label="项目名称"
              placeholder="例如：基于公开数据集的轴承故障诊断"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Select
              aria-label="关联目标岗位"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="可选：关联一个已有岗位"
              style={{ width: "100%" }}
              loading={jobs.loading}
              value={targetJobId}
              options={jobOptions}
              onChange={(value) => setTargetJobId(value)}
            />
            <Input
              aria-label="能力缺口"
              placeholder="能力缺口，用逗号分隔：Python，信号处理，1D-CNN"
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
            />
            <Space>
              <Button type="primary" loading={submitting} onClick={() => void create()}>
                保存项目
              </Button>
              <Button onClick={resetCreate}>取消</Button>
            </Space>
          </Space>
        </Card>
      )}

      {projects.loading && <Skeleton active paragraph={{ rows: 6 }} />}
      {projects.error && <Typography.Text type="danger">{projects.error}</Typography.Text>}
      {!projects.loading && !projects.error && (projects.data?.length ?? 0) === 0 && (
        <Empty description="还没有补强项目。先从一个真实岗位缺口开始，不要为了填简历而凭空造项目。" />
      )}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {(projects.data ?? []).map((project) => {
          const job = project.target_job_id ? jobMap.get(project.target_job_id) : undefined;
          return (
            <Card key={project.id} size="small">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <Space direction="vertical" size={8} style={{ minWidth: 0 }}>
                  <Space wrap>
                    <ExperimentOutlined />
                    <Typography.Text strong>{project.title}</Typography.Text>
                    <Tag color={STATUS_COLORS[project.status]}>{STATUS_LABELS[project.status]}</Tag>
                  </Space>
                  {project.target_job_id && (
                    <Typography.Text type="secondary">
                      {job
                        ? `目标岗位：${job.company ? `${job.company} · ` : ""}${job.title}`
                        : `目标岗位：#${project.target_job_id}（已删除或未加载到当前岗位列表）`}
                    </Typography.Text>
                  )}
                  {project.gap_skills.length > 0 && (
                    <Space size={[4, 4]} wrap>
                      <Typography.Text type="secondary">待补能力：</Typography.Text>
                      {project.gap_skills.map((skill) => (
                        <Tag key={skill}>{skill}</Tag>
                      ))}
                    </Space>
                  )}
                  {project.status === "learning" && (
                    <Space direction="vertical" size={6} style={{ width: "100%" }}>
                      <Typography.Text type="secondary">
                        学习完成后，先记录你真实产出的交付物，再进入「已实现」。不能一键跳过。
                      </Typography.Text>
                      <Input.TextArea
                        aria-label={`项目 ${project.id} 已完成交付物`}
                        placeholder="每行一项，例如：完成数据清洗脚本；完成基线模型对比实验"
                        autoSize={{ minRows: 2, maxRows: 4 }}
                        value={deliverableDrafts[project.id] ?? ""}
                        onChange={(event) =>
                          setDeliverableDrafts((current) => ({
                            ...current,
                            [project.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        loading={advancingId === project.id}
                        onClick={() => void markImplemented(project)}
                      >
                        记录交付物并标记已实现
                      </Button>
                    </Space>
                  )}
                  {project.deliverables.length > 0 && (
                    <Space size={[4, 4]} wrap>
                      <Typography.Text type="secondary">交付物：</Typography.Text>
                      {project.deliverables.map((item) => (
                        <Tag key={item}>{item}</Tag>
                      ))}
                    </Space>
                  )}
                  {project.status === "implemented" && (
                    <Space direction="vertical" size={6} style={{ width: "100%" }}>
                      <Typography.Text type="secondary">
                        下一步不是直接写进简历，而是留下可回溯证据并总结真实结果。
                      </Typography.Text>
                      <Input
                        aria-label={`项目 ${project.id} 证据位置`}
                        placeholder="GitHub 仓库、报告路径、公开链接等"
                        value={verificationDrafts[project.id]?.evidenceLocation ?? ""}
                        onChange={(event) =>
                          setVerificationDrafts((current) => ({
                            ...current,
                            [project.id]: {
                              evidenceLocation: event.target.value,
                              evidenceNote: current[project.id]?.evidenceNote ?? "",
                              resultSummary: current[project.id]?.resultSummary ?? "",
                            },
                          }))
                        }
                      />
                      <Input
                        aria-label={`项目 ${project.id} 证据备注`}
                        placeholder="可选：这份证据能证明什么"
                        value={verificationDrafts[project.id]?.evidenceNote ?? ""}
                        onChange={(event) =>
                          setVerificationDrafts((current) => ({
                            ...current,
                            [project.id]: {
                              evidenceLocation: current[project.id]?.evidenceLocation ?? "",
                              evidenceNote: event.target.value,
                              resultSummary: current[project.id]?.resultSummary ?? "",
                            },
                          }))
                        }
                      />
                      <Input.TextArea
                        aria-label={`项目 ${project.id} 结果总结`}
                        placeholder="写真实结果：完成了什么、对比了什么、得到什么结论。不要补不存在的数字。"
                        autoSize={{ minRows: 2, maxRows: 5 }}
                        value={
                          verificationDrafts[project.id]?.resultSummary ?? project.result_summary
                        }
                        onChange={(event) =>
                          setVerificationDrafts((current) => ({
                            ...current,
                            [project.id]: {
                              evidenceLocation: current[project.id]?.evidenceLocation ?? "",
                              evidenceNote: current[project.id]?.evidenceNote ?? "",
                              resultSummary: event.target.value,
                            },
                          }))
                        }
                      />
                      <Button
                        loading={advancingId === project.id}
                        onClick={() => void markVerified(project)}
                      >
                        保存证据并标记已验证
                      </Button>
                    </Space>
                  )}
                  {project.result_summary && (
                    <Typography.Text type="secondary">
                      结果总结：{project.result_summary}
                    </Typography.Text>
                  )}
                  {project.evidence.length > 0 && (
                    <Space direction="vertical" size={2}>
                      <Typography.Text type="secondary">
                        证据：{project.evidence.length} 条
                      </Typography.Text>
                      {project.evidence.map((item, index) =>
                        /^https?:\/\//.test(item.location) ? (
                          <Typography.Link
                            key={`${item.location}-${index}`}
                            href={item.location}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {item.location}
                          </Typography.Link>
                        ) : (
                          <Typography.Text key={`${item.location}-${index}`}>
                            {item.location}
                          </Typography.Text>
                        ),
                      )}
                    </Space>
                  )}
                </Space>
                {project.status === "proposed" && (
                  <Button
                    loading={advancingId === project.id}
                    onClick={() => void startLearning(project)}
                  >
                    开始学习
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </Space>
    </div>
  );
}

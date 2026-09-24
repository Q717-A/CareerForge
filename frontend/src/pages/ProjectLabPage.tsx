/**
 * Project Lab 第一条纵向切片。
 *
 * 当前只开放已经有后端验证规则支撑的动作：查看项目、创建项目、关联真实岗位、
 * proposed → learning。更高状态故意不在这一版 UI 里提前暴露，等对应表单和验证闭环完成再放开。
 */
import { ExperimentOutlined, PlusOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
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
            把岗位缺口变成真正做完、能解释、可验证的项目。AI 推荐的项目不会因为创建了就自动进入简历。
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
                  {job && (
                    <Typography.Text type="secondary">
                      目标岗位：{job.company ? `${job.company} · ` : ""}{job.title}
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
                    <Typography.Text type="secondary">
                      当前只先验证“开始学习”这一步；实现、证据验证和进入简历将在后续切片开放。
                    </Typography.Text>
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

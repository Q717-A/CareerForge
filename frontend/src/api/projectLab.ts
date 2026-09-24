/** CareerForge Project Lab 接口。 */
import type {
  ProjectLabClaimDraftsResult,
  ProjectLabPayload,
  ProjectLabProject,
  ProjectLabStatus,
  ProjectLabUpdatePayload,
} from "../types";
import { buildQuery, request } from "./client";

export function listProjectLabProjects(
  params: { status?: ProjectLabStatus | ""; target_job_id?: number; limit?: number } = {},
): Promise<ProjectLabProject[]> {
  return request(`/project-lab${buildQuery(params)}`);
}

export function getProjectLabProject(id: number): Promise<ProjectLabProject> {
  return request(`/project-lab/${id}`);
}

export function createProjectLabProject(payload: ProjectLabPayload): Promise<ProjectLabProject> {
  return request("/project-lab", { method: "POST", body: JSON.stringify(payload) });
}

export function updateProjectLabProject(
  id: number,
  payload: ProjectLabUpdatePayload,
): Promise<ProjectLabProject> {
  return request(`/project-lab/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteProjectLabProject(id: number): Promise<void> {
  return request(`/project-lab/${id}`, { method: "DELETE" });
}

/** 显式把 resume_ready 项目的简历表述转成事实台账「待确认」草稿。 */
export function createProjectLabClaimDrafts(id: number): Promise<ProjectLabClaimDraftsResult> {
  return request(`/project-lab/${id}/claim-drafts`, { method: "POST" });
}

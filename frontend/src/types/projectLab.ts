/** CareerForge Project Lab：能力缺口项目与状态闸门。 */

export const PROJECT_LAB_STATUSES = [
  "proposed",
  "learning",
  "implemented",
  "verified",
  "resume_ready",
] as const;

export type ProjectLabStatus = (typeof PROJECT_LAB_STATUSES)[number];
export type ProjectLabOrigin = "manual" | "job_gap" | "assistant";

export interface ProjectEvidence {
  type: string;
  location: string;
  note: string;
}

export interface ProjectLabProject {
  id: number;
  title: string;
  origin: ProjectLabOrigin;
  status: ProjectLabStatus;
  target_job_id: number | null;
  target_roles: string[];
  gap_skills: string[];
  problem_statement: string;
  learning_plan: string[];
  deliverables: string[];
  evidence: ProjectEvidence[];
  result_summary: string;
  mastery_notes: string;
  resume_bullets: string[];
  interview_questions: string[];
  repository_url: string;
  created_at: string;
  updated_at: string;
  gate_warnings: string[];
}

export interface ProjectLabPayload {
  title: string;
  origin?: ProjectLabOrigin;
  status?: ProjectLabStatus;
  target_job_id?: number | null;
  target_roles?: string[];
  gap_skills?: string[];
  problem_statement?: string;
  learning_plan?: string[];
  deliverables?: string[];
  evidence?: ProjectEvidence[];
  result_summary?: string;
  mastery_notes?: string;
  resume_bullets?: string[];
  interview_questions?: string[];
  repository_url?: string;
}

export type ProjectLabUpdatePayload = Partial<ProjectLabPayload>;

export interface ProjectLabClaimDraftsResult {
  project_id: number;
  created_count: number;
  existing_count: number;
  claim_ids: number[];
}

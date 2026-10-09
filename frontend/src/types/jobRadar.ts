/** 线索不等于在招岗位，所有数据必须经过人工核实。 */
export interface RadarSearchRequest {
  keywords: string;
  city?: string;
  company?: string;
  job_type?: string;
}

export interface RadarHit {
  title: string;
  url: string;
  snippet: string;
  host: string;
}

export interface RadarSearchOut {
  items: RadarHit[];
  warning: string;
  disclaimer: string;
}

export interface RadarStageOut {
  created: number;
  existing: number;
  outcomes: {
    source_url: string;
    status: "created" | "existing_candidate" | "existing_job";
    candidate_id: number | null;
    job_id: number | null;
  }[];
}

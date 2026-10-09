/** 岗位雷达：公开网页线索搜索与显式暂存。 */
import type {
  RadarSearchRequest,
  RadarSearchOut,
  RadarHit,
  RadarStageOut,
} from "../types/jobRadar";
import { request } from "./client";

export function searchJobRadar(payload: RadarSearchRequest): Promise<RadarSearchOut> {
  return request("/job-radar/search", { method: "POST", body: JSON.stringify(payload) });
}

export function stageJobRadar(items: RadarHit[]): Promise<RadarStageOut> {
  return request("/job-radar/stage", {
    method: "POST",
    body: JSON.stringify({
      items: items.map((item) => ({
        title: item.title.slice(0, 128),
        source_url: item.url,
        snippet: item.snippet,
      })),
    }),
  });
}

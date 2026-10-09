/** 雷达搜索不入库，只有用户勾选并保存才写入备选。 */
import { App as AntdApp } from "antd";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JobRadarPage from "./JobRadarPage";

const api = vi.hoisted(() => ({ searchJobRadar: vi.fn(), stageJobRadar: vi.fn() }));
vi.mock("../api/jobRadar", () => api);

function renderPage() {
  return render(
    <MemoryRouter>
      <AntdApp>
        <JobRadarPage />
      </AntdApp>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  api.searchJobRadar.mockReset();
  api.stageJobRadar.mockReset();
});
afterEach(() => cleanup());

describe("JobRadarPage", () => {
  it("does not save search results until the user explicitly selects them", async () => {
    api.searchJobRadar.mockResolvedValue({
      items: [
        {
          title: "机械设计工程师招聘",
          url: "https://careers.example.com/jobs/123",
          host: "careers.example.com",
          snippet: "详情以官网为准",
        },
      ],
      warning: "",
      disclaimer: "仅为网页线索，不代表仍在招聘。",
    });
    api.stageJobRadar.mockResolvedValue({ created: 1, existing: 0, outcomes: [] });
    renderPage();
    fireEvent.change(screen.getByLabelText("岗位关键词"), { target: { value: "机械设计" } });
    fireEvent.click(screen.getByRole("button", { name: "搜索线索" }));
    const source = await screen.findByRole("link", { name: "机械设计工程师招聘" });
    expect(source).toHaveAttribute("href", "https://careers.example.com/jobs/123");
    expect(api.stageJobRadar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "选择线索：机械设计工程师招聘" }));
    fireEvent.click(screen.getByRole("button", { name: "将勾选线索保存到备选岗位" }));
    await waitFor(() =>
      expect(api.stageJobRadar).toHaveBeenCalledWith([
        {
          title: "机械设计工程师招聘",
          url: "https://careers.example.com/jobs/123",
          host: "careers.example.com",
          snippet: "详情以官网为准",
        },
      ]),
    );
  });

  it("shows source errors without fabricating job listings", async () => {
    api.searchJobRadar.mockResolvedValue({
      items: [],
      warning: "搜索引擎暂时不可用",
      disclaimer: "岗位来源未经核验",
    });
    renderPage();
    fireEvent.change(screen.getByLabelText("岗位关键词"), { target: { value: "仿真工程师" } });
    fireEvent.click(screen.getByRole("button", { name: "搜索线索" }));
    expect(await screen.findByText("搜索引擎暂时不可用")).toBeInTheDocument();
    expect(api.stageJobRadar).not.toHaveBeenCalled();
  });
});

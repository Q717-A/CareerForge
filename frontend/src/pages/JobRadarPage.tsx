/** 公开招聘网页线索 → 用户勾选 → 备选岗位，绝不自动写正式简历。 */
import { RadarChartOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchJobRadar, stageJobRadar } from "../api/jobRadar";
import type { RadarHit, RadarSearchOut } from "../types/jobRadar";

const JOB_TYPES = [
  { value: "", label: "不限" },
  { value: "校招", label: "校招" },
  { value: "实习", label: "实习" },
  { value: "社招", label: "社招" },
];

export default function JobRadarPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState("");
  const [city, setCity] = useState("");
  const [company, setCompany] = useState("");
  const [jobType, setJobType] = useState("");
  const [searching, setSearching] = useState(false);
  const [staging, setStaging] = useState(false);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<RadarSearchOut | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const search = async () => {
    if (keywords.trim().length < 2) {
      message.warning("请填写至少两个字的岗位关键词");
      return;
    }
    setSearching(true);
    setSelected([]);
    setResult(null);
    setSearched(false);
    try {
      const response = await searchJobRadar({
        keywords: keywords.trim(),
        city: city.trim(),
        company: company.trim(),
        job_type: jobType,
      });
      setResult(response);
      setSearched(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "岗位线索搜索失败");
    } finally {
      setSearching(false);
    }
  };

  const stageSelected = async () => {
    if (!result || selected.length === 0) return;
    const chosen: RadarHit[] = result.items.filter((item) => selected.includes(item.url));
    setStaging(true);
    try {
      const outcome = await stageJobRadar(chosen);
      message.success(`新增 ${outcome.created} 条备选线索，已有 ${outcome.existing} 条未重复创建`);
      setSelected([]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存备选岗位失败");
    } finally {
      setStaging(false);
    }
  };

  return (
    <div>
      <Space direction="vertical" size={4} style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          <RadarChartOutlined /> 岗位雷达
        </Typography.Title>
        <Typography.Text type="secondary">
          从公开网页发现招聘线索，核对来源并挑选到备选岗位，不自动认定在招或投递。
        </Typography.Text>
      </Space>
      <Card size="small" title="搜索公开招聘线索" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Input
            aria-label="岗位关键词"
            placeholder="例如：机械设计工程师、CAE 仿真、AI 算法工程师"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
          />
          <Space wrap>
            <Input
              aria-label="目标城市"
              placeholder="城市（搜索关键词）"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
            <Input
              aria-label="目标公司"
              placeholder="公司（可选）"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
            <Select
              aria-label="岗位类型"
              options={JOB_TYPES}
              value={jobType}
              style={{ width: 125 }}
              onChange={setJobType}
            />
          </Space>
          <Space wrap>
            <Button type="primary" loading={searching} onClick={() => void search()}>
              搜索线索
            </Button>
            <Button onClick={() => navigate("/apply")}>招聘平台浏览器采集</Button>
            <Button onClick={() => navigate("/jobs?candidates=1")}>核对备选岗位</Button>
          </Space>
        </Space>
      </Card>
      {result && (
        <Alert type="warning" showIcon message={result.disclaimer} style={{ marginBottom: 16 }} />
      )}
      {result?.warning && (
        <Alert type="info" showIcon message={result.warning} style={{ marginBottom: 16 }} />
      )}
      {searched && result?.items.length === 0 && (
        <Empty description="没有找到可核查的线索；可换关键词或使用投递台浏览器采集。" />
      )}
      {(result?.items.length ?? 0) > 0 && (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space wrap>
            <Typography.Text>已选 {selected.length} 条</Typography.Text>
            <Button
              type="primary"
              loading={staging}
              disabled={selected.length === 0}
              onClick={() => void stageSelected()}
            >
              将勾选线索保存到备选岗位
            </Button>
          </Space>
          {result?.items.map((item) => (
            <Card key={item.url} size="small">
              <Space align="start">
                <Checkbox
                  aria-label={`选择线索：${item.title}`}
                  checked={selected.includes(item.url)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, item.url]
                        : current.filter((url) => url !== item.url),
                    )
                  }
                />
                <Space direction="vertical" size={4}>
                  <Typography.Link href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </Typography.Link>
                  <Tag>{item.host}</Tag>
                  <Typography.Text type="secondary">{item.snippet}</Typography.Text>
                </Space>
              </Space>
            </Card>
          ))}
        </Space>
      )}
    </div>
  );
}

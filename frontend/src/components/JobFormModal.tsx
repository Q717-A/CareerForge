/** 岗位新增/编辑弹窗：手动添加、识别导入、备注图片与来源标注。 */
import { DeleteOutlined, FileSearchOutlined, PictureOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  DatePicker,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Typography,
  Upload,
} from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useRef, useState } from "react";
import { createJob, parseJobsMultiple, updateJob } from "../api/jobs";
import { attachmentInputs, useRecognitionFiles } from "../hooks/useRecognitionFiles";
import { readAsDataUrl } from "../utils/attachments";
import MultiJobDraftList from "./jobs/MultiJobDraftList";
import RecognitionFileField from "./RecognitionFileField";
import RecognitionOutcome from "./RecognitionOutcome";
import type {
  CandidateJob,
  Job,
  JobPayload,
  JobRecognitionSource,
  ParsedJobDraft,
  RecognitionSource,
} from "../types";

/** 与后端 MAX_JOB_NOTE_IMAGES / 图片体积上限一致（服务端仍是权威校验）。 */
const MAX_NOTE_IMAGES = 2;
const MAX_NOTE_IMAGE_BYTES = 2 * 1024 * 1024;

type RecognitionInputKind = "text" | "image" | "document";

interface Props {
  open: boolean;
  /** 传入岗位表示编辑，null 表示新增 */
  initial: Job | null;
  /** 保存过的候选岗位的结构化信息；人工确认后才创建正式岗位。 */
  presetCandidate?: CandidateJob | null;
  /** 从备选岗位导入时预填的招聘原文（只用于新增）。 */
  presetRawText?: string;
  /** 从备选岗位导入时的来源标注；不填则按识别输入自动判定。 */
  presetSource?: JobRecognitionSource;
  onClose: () => void;
  /** 保存成功回调；新建时带上新岗位 id（备选岗位导入用它标记） 。 */
  onSaved: (jobId?: number) => void;
}

const JOB_TYPE_OPTIONS = ["校招", "实习", "社招", "其他"].map((value) => ({ value, label: value }));
const STATUS_OPTIONS = ["开放中", "已截止", "已投递"].map((value) => ({ value, label: value }));

/** 判断"这次识别到底有没有读出东西"时只看这些字段：job_type 与 status 恒有默认值。 */
const RECOGNIZED_CONTENT_FIELDS = [
  "title",
  "company",
  "location",
  "salary",
  "description",
  "requirements",
  "additional_info",
  "source_url",
  "posted_at",
] as const;

export default function JobFormModal({
  open,
  initial,
  presetCandidate,
  presetRawText,
  presetSource,
  onClose,
  onSaved,
}: Props) {
  const [form] = Form.useForm<JobPayload>();
  const { message } = App.useApp();
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [recognizedText, setRecognizedText] = useState("");
  const [recognitionSource, setRecognitionSource] = useState<RecognitionSource | null>(null);
  // 这次识别是用什么输入的：保存时据此把「图片识别 / 文档识别 / 粘贴文本识别」写进溯源字段。
  const [inputKind, setInputKind] = useState<RecognitionInputKind>("text");
  const [noteImages, setNoteImages] = useState<string[]>([]);
  // 一次粘贴里识别出多份招聘信息时，先在这里存下来让用户确认，不直接覆盖表单。
  const [drafts, setDrafts] = useState<ParsedJobDraft[]>([]);
  const [draftsEngine, setDraftsEngine] = useState<RecognitionSource>("local");
  const [savingDrafts, setSavingDrafts] = useState(false);
  const { files, reading, addFiles, removeFile, clear, onPaste } = useRecognitionFiles();
  const parseRequestId = useRef(0);
  const submittingRef = useRef(false);
  const isEdit = !!initial;

  // 打开时回填编辑数据（或重置为默认值）
  useEffect(() => {
    parseRequestId.current += 1;
    setParsing(false);
    setSubmitting(false);
    submittingRef.current = false;
    // 每次打开都从干净状态开始：上次留下的多份草稿不该出现在这一次的弹窗里。
    setDrafts([]);
    setSavingDrafts(false);
    if (!open) return;
    if (initial) {
      form.setFieldsValue(initial);
      setNoteImages(initial.note_images ?? []);
    } else {
      form.resetFields();
      if (presetCandidate) {
        form.setFieldsValue({
          title: presetCandidate.title,
          company: presetCandidate.company,
          location: presetCandidate.location,
          salary: presetCandidate.salary,
          description: presetCandidate.description || presetCandidate.raw_text,
          requirements: presetCandidate.requirements,
          source_url: presetCandidate.source_url,
          note: presetCandidate.note,
        });
      }
      setRawText(presetRawText ?? "");
      setParseWarnings([]);
      setRecognizedText("");
      setRecognitionSource(null);
      setInputKind("text");
      setNoteImages([]);
      clear();
    }
  }, [open, initial, presetCandidate, presetRawText, form, clear]);

  const addNoteImage = async (file: File) => {
    if (file.size > MAX_NOTE_IMAGE_BYTES) {
      message.error("单张图片不能超过 2 MB");
      return;
    }
    if (noteImages.length >= MAX_NOTE_IMAGES) {
      message.warning(`备注最多放 ${MAX_NOTE_IMAGES} 张图片`);
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      setNoteImages((current) => [...current, dataUrl]);
    } catch {
      message.error("读取图片失败，请重试");
    }
  };

  // 至少两份才算"多份"：只有一份时走原来的回填表单流程，不打断用户。
  const multiMode = drafts.length > 1;

  const parseImport = async () => {
    if (submittingRef.current) return;
    const value = rawText.trim();
    if (!value && files.length === 0) {
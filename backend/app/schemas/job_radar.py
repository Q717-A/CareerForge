"""Job Radar 只发现公开招聘线索，不把搜索结果当作已核实岗位。"""
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RadarSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    keywords: str = Field(min_length=2, max_length=120)
    city: str = Field(default="", max_length=60)
    company: str = Field(default="", max_length=80)
    job_type: str = Field(default="", max_length=12)

    @field_validator("keywords", "city", "company", "job_type")
    @classmethod
    def strip_fields(cls, value: str) -> str:
        return value.strip()

    @field_validator("job_type")
    @classmethod
    def validate_job_type(cls, value: str) -> str:
        if value not in ("", "校招", "实习", "社招"):
            raise ValueError("未知的岗位类型")
        return value


class RadarHit(BaseModel):
    title: str = Field(max_length=255)
    url: str = Field(max_length=1024)
    snippet: str = Field(default="", max_length=1200)
    host: str = Field(default="", max_length=255)


class RadarSearchOut(BaseModel):
    items: list[RadarHit] = Field(default_factory=list)
    warning: str = ""
    disclaimer: str = (
        "这些只是公开网页搜索线索，不代表岗位仍在招聘或学历、薪资、城市条件已核实。"
        "请打开来源核对 JD，选中后只进入备选岗位，不能直接投递。"
    )


def valid_source_url(value: str) -> bool:
    if any(char in value for char in ("\r", "\n", "\t")):
        return False
    try:
        parsed = urlsplit(value)
        return (
            parsed.scheme.lower() in {"http", "https"}
            and bool(parsed.hostname)
            and not parsed.username
            and not parsed.password
        )
    except ValueError:
        return False


class RadarStageItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=128)
    company: str = Field(default="", max_length=128)
    source_url: str = Field(min_length=1, max_length=1024)
    snippet: str = Field(default="", max_length=1200)

    @field_validator("title", "company", "source_url", "snippet")
    @classmethod
    def strip_fields(cls, value: str) -> str:
        return value.strip()

    @field_validator("source_url")
    @classmethod
    def check_url(cls, value: str) -> str:
        if not valid_source_url(value):
            raise ValueError("线索必须包含有效的 HTTP(S) 来源链接")
        return value


class RadarStageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[RadarStageItem] = Field(min_length=1, max_length=30)


class RadarStageOutcome(BaseModel):
    source_url: str
    status: str
    candidate_id: int | None = None
    job_id: int | None = None


class RadarStageOut(BaseModel):
    created: int = 0
    existing: int = 0
    outcomes: list[RadarStageOutcome] = Field(default_factory=list)

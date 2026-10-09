# CareerForge Windows 安装与更新安全说明

CareerForge 是 `Q717-A/CareerForge` 的增强分支。原始 ResumeForge 及其 Release、演示站点不等于 CareerForge 的代码交付渠道。

## 第一次安装

建议先确认仓库 URL 为 `https://github.com/Q717-A/CareerForge`。

1. 使用 Git 克隆本仓库 `main` 分支，或从本仓库的 **Code → Download ZIP** 获取当前源码。
2. 在隔离目录中首次测试，使用虚构简历，不要把真实完整简历提交到 GitHub。
3. Windows 上运行项目已有的 `start.cmd`，依赖安装时注意终端提示。
4. 在 Project Lab、事实台账、Job Radar、备选岗位之间先运行一个虚构岗位闭环，确认数据库能够持续保存。

## 后续更新

- Git 方式：核对 `git remote -v` 指向 `Q717-A/CareerForge`，然后在受控分支运行 `git pull --ff-only`。
- ZIP 方式：本 fork 的 `update.cmd` 默认从 `Q717-A/CareerForge/main` 获取源码，而不是原作者仓库。
- 可设置环境变量 `RESUMEFORGE_UPDATE_REPO` 自定义仓库来源；不确定时应先检查是否设置了该变量，避免下载错误仓库。
- 更新脚本保留 `data`、`.env`、`runtime`、`.venv` 和 `node_modules`，但涉及数据库结构时仍应先备份 `data` 目录并确认回滚路径。
- `backend/app/services/update_check.py` 的版本检查默认也指向本 fork。**没有发布独立 GitHub Release 不代表需要安装上游的版本**。
- 运行 `update.cmd -DryRun` 只能预览部分更新动作；它不代替环境隔离与正式备份。

## 上游项目致谢

CareerForge 保留 ResumeForge 原项目的许可证和归属。任何展示了上游 Release、官网或 QQ 群的链接，仅代表原项目资源，不是 CareerForge 官方安装来源。

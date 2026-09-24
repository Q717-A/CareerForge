# CareerForge Verification Checklist

这份清单是开发闸门，不是发布后的说明文档。目标是避免“功能都写了，最后才发现模块之间接不上”。

## 状态定义

- **planned**：只有方案；
- **implemented**：代码已写，但还没有完整验证；
- **verified**：对应测试与冒烟已经实际执行并通过；
- **integrated**：已经与上游/下游模块跑通；
- **release-ready**：CI、迁移、旧数据兼容和核心人工流程都通过。

没有实际执行测试时，不把 implemented 写成 verified。

## 每个后端功能切片

- [ ] 模型字段与 Pydantic/TypeScript 契约一致；
- [ ] Alembic revision 是线性的，current head 断言同步更新；
- [ ] 从空库升级到 head 能得到与 Base.metadata 一致的结构；
- [ ] 从上一 revision 升级不丢既有行；
- [ ] downgrade 至少能回到上一 revision；
- [ ] 新表不会让旧备份永久失效：旧备份应先迁移再做表集合校验；
- [ ] CRUD 冒烟覆盖 create/get/list/update/delete；
- [ ] 错误 ID、非法状态、缺失证据等失败路径有测试；
- [ ] 与已有模块的外键/逻辑关联至少有一条真实集成测试；
- [ ] 无效关联必须 fail closed，不能静默吞掉并伪装成成功。

## 每个前端功能切片

- [ ] API client 与后端路径、方法、字段一致；
- [ ] TypeScript 类型覆盖后端响应；
- [ ] 页面只实现当前已验证的后端能力，不预埋“看起来能点但后端没接”的按钮；
- [ ] 加载、空态、错误态、提交中状态都有明确反馈；
- [ ] 至少一条页面测试覆盖真实用户主路径；
- [ ] npm test / format:check / lint / build 实际执行并通过。

## 闭环验证

每完成一条纵向功能，都按用户路径验证，而不是按文件数量验证。

Project Lab 第一条闭环应当是：

```
岗位存在
→ 创建 Project Lab 项目并关联岗位
→ proposed
→ learning
→ implemented
→ 补证据和结果
→ verified
→ 补掌握说明 / 简历 bullet / 面试追问
→ resume_ready
```

在“转事实台账”功能加入之后，再增加：

```
resume_ready
→ 用户显式确认
→ 生成事实台账草稿
→ 仍处于待确认
→ 用户核实
→ 才能进入正式简历
```

## 当前验证状态

### Project Lab backend

- implemented：是；
- 静态集成复核：完成；
- 专用 API/状态机测试：已写；
- 0022 迁移测试：已写；
- 旧备份迁移覆盖：已补；
- Job 真实关联测试：已写；
- GitHub Actions CI：**尚未实际运行**；
- 当前结论：**implemented / waiting-for-CI，不标记 verified**。

在 CI 首次跑绿之前，不继续堆叠 Job Radar、Truth Engine 等大模块。

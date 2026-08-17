# dsh-meego

适用于飞书项目（Meego）的 DeepSeek Harness 插件。它为智能体提供一组清晰、可控的 Meego 工具，用于查找项目、查询工作项、查看个人待办，以及在确认后创建、更新或流转工作项。

English: [README.md](README.md)

## 功能

- `meego_project_search`：按项目名称查找项目，并获取准确的项目 Key。
- `meego_workitem_get`：查看指定工作项的详情。
- `meego_workitem_query`：执行聚焦的 MQL 工作项查询。
- `meego_mywork_todo`：查看个人待办、已完成、逾期或本周工作项。
- `meego_workitem_create`：创建工作项。
- `meego_workitem_update`：更新工作项字段。
- `meego_workitem_transition_state`：流转工作项状态。

## 安装前提

1. Node.js 22.13 或更高版本。
2. 已安装并能在 `PATH` 中找到 `meegle` 命令行工具。
3. 已登录 Meego CLI。

```bash
meegle auth login --host project.feishu.cn
```

如果你的组织使用其他 Meego 域名，请将上面的 host 替换为实际地址。

## 安装插件

```bash
npx -y @deepseek-ai/dsh plugin --profile web add github:Lilien-xu/dsh-meego
npx -y @deepseek-ai/dsh --profile web
```

## 使用与安全说明

插件每次调用前都会检查 Meego CLI 的登录状态。查询类工具只读，可用于发现项目信息和工作项；创建、更新、状态流转工具会修改数据，应在确认目标和具体变更后调用。

更新或创建工作项前，建议先查询 Meego 元数据，以确认字段 Key 和字段值格式。Meego 字段遵循 CLI 的字符串协议：标量值使用字符串，数组或对象需要在 `field_value` 中传入 JSON 字符串。

插件不会收集、保存或转发 OAuth 凭证。登录凭证由本机 Meego CLI 的凭证存储管理。如 `meegle` 不在标准路径中，可以通过 `MEEGLE_BIN` 指定可执行文件路径。

## 开发

运行时入口是 `dsh/index.js`。插件只使用 Node.js 内置模块和 DSH 原始工具注册接口，不会打包凭证，也不额外引入 API 客户端。

## 许可证

MIT

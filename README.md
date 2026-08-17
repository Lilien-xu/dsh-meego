# dsh-meego

DeepSeek Harness plugin for Feishu Project (Meego). It gives the agent a small, explicit tool surface for finding projects, querying work items, checking personal todos, and—only after user confirmation—creating, updating, or transitioning work items.

## What it does

- `meego_project_search` — resolve a project name to its authoritative project key.
- `meego_workitem_get` — inspect a work item.
- `meego_workitem_query` — run focused MQL queries.
- `meego_mywork_todo` — list todo/done/overdue/this-week items.
- `meego_workitem_create` — create a work item.
- `meego_workitem_update` — update fields.
- `meego_workitem_transition_state` — move a status-flow work item.

The plugin calls the locally installed `meegle` CLI. OAuth tokens remain in the Meego CLI credential store; this package does not collect, persist, or forward them. Set `MEEGLE_BIN` only when the CLI is installed under a non-standard path.

## Install

Prerequisites:

1. Node.js 22.13+.
2. The `meegle` CLI on `PATH`.
3. A logged-in Meego CLI profile.

```bash
meegle auth login --host project.feishu.cn
npx -y @deepseek-ai/dsh plugin --profile web add dsh-meego
npx -y @deepseek-ai/dsh --profile web
```

If your organization uses another Meego host, pass that host to `meegle auth login`.

For a GitHub-only install before publishing to npm, push this repository as a public repo and use:

```bash
npx -y @deepseek-ai/dsh plugin --profile web add github:Lilien-xu/dsh-meego
```

## Safety contract

The plugin performs an auth-status check before every call. Read-only tools are safe to use for discovery. Create/update/transition tools are marked as mutating in their descriptions and should only be called after the user confirms the exact target and change. Before creating or updating, fetch Meego metadata so field keys and value formats are correct.

Meego field values follow the CLI's string protocol: scalar values are strings, and arrays/objects must be JSON-stringified inside `field_value`.

## Development

The runtime entry is `dsh/index.js`. It intentionally uses only Node built-ins and the DSH raw tool registration surface, so the package can be built and inspected without bundling credentials or a second API client.

## License

MIT.

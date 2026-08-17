import { spawn } from 'node:child_process';

export const name = 'meego';
export const inject = ['tools'];

const DEFAULT_TIMEOUT_MS = 45_000;
const OUTPUT_CAP = 120_000;
const MEEGLE_BIN = process.env.MEEGLE_BIN || 'meegle';

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    command: { type: 'string' },
    data: {},
  },
  required: ['command', 'data'],
};

const PROJECT_SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    project_key: { type: 'string', description: 'Optional project key, simple name, or exact project name.' },
    page_num: { type: 'integer', description: 'Page number, starting at 1.' },
  },
};

const WORKITEM_GET_SCHEMA = {
  type: 'object',
  properties: {
    work_item_id: { type: 'string', description: 'Work item ID or exact name.' },
    project_key: { type: 'string', description: 'Optional Meego project key.' },
    fields: { type: 'array', items: { type: 'string' }, description: 'Optional field keys/names. Use ["_all"] for all fields.' },
  },
  required: ['work_item_id'],
};

const QUERY_SCHEMA = {
  type: 'object',
  properties: {
    project_key: { type: 'string', description: 'Project key, simple name, or exact project name.' },
    mql: { type: 'string', description: 'Complete Meego MQL query.' },
  },
  required: ['project_key', 'mql'],
};

const TODO_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['todo', 'done', 'overdue', 'this_week'], description: 'Todo bucket.' },
    page_num: { type: 'integer', description: 'Page number, starting at 1.' },
    asset_key: { type: 'string', description: 'Optional workspace key when Meego asks you to choose one.' },
  },
  required: ['action', 'page_num'],
};

const CREATE_SCHEMA = {
  type: 'object',
  properties: {
    work_item_type: { type: 'string', description: 'Work item type key or name.' },
    project_key: { type: 'string', description: 'Project key, simple name, or exact project name.' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          field_key: { type: 'string' },
          field_value: { type: 'string', description: 'Meego field value. Arrays/objects must be JSON-stringified.' },
        },
        required: ['field_key', 'field_value'],
      },
      description: 'Field values. Fetch metadata first when the type or field key is unknown.',
    },
    work_item_id: { type: 'string', description: 'Optional resource template instance ID.' },
  },
  required: ['work_item_type', 'fields'],
};

const UPDATE_SCHEMA = {
  type: 'object',
  properties: {
    work_item_id: { type: 'string', description: 'Work item ID or exact name.' },
    project_key: { type: 'string', description: 'Optional Meego project key.' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          field_key: { type: 'string' },
          field_value: { type: 'string', description: 'Meego field value. Arrays/objects must be JSON-stringified.' },
        },
        required: ['field_key', 'field_value'],
      },
    },
  },
  required: ['work_item_id', 'fields'],
};

const TRANSITION_SCHEMA = {
  type: 'object',
  properties: {
    work_item_id: { type: 'string', description: 'Work item ID.' },
    transition_id: { type: 'string', description: 'Transition ID from workflow_list_state_transitions.' },
    project_key: { type: 'string', description: 'Optional Meego project key.' },
  },
  required: ['work_item_id', 'transition_id'],
};

export function apply(ctx) {
  register(ctx, {
    name: 'meego_project_search',
    description: 'Find Feishu Project (Meego) spaces and resolve a human project name to an authoritative project key. Read-only.',
    parameters: PROJECT_SEARCH_SCHEMA,
    execute: (args, exec) => runMeego('project search', args, exec.signal),
  });

  register(ctx, {
    name: 'meego_workitem_get',
    description: 'Get one Feishu Project (Meego) work item by ID or exact name. Read-only. Fetch metadata first if a field key is unknown.',
    parameters: WORKITEM_GET_SCHEMA,
    execute: (args, exec) => runMeego('workitem get', args, exec.signal),
  });

  register(ctx, {
    name: 'meego_workitem_query',
    description: 'Query Feishu Project (Meego) work items with MQL. Read-only. Keep SELECT fields focused and paginate when needed.',
    parameters: QUERY_SCHEMA,
    execute: (args, exec) => runMeego('workitem query', args, exec.signal),
  });

  register(ctx, {
    name: 'meego_mywork_todo',
    description: 'List the current user\'s Meego todo, done, overdue, or this-week work items. Read-only.',
    parameters: TODO_SCHEMA,
    execute: (args, exec) => runMeego('mywork todo', args, exec.signal),
  });

  register(ctx, {
    name: 'meego_workitem_create',
    description: 'Create a Feishu Project (Meego) work item. MUTATING: call only after the user has clearly confirmed the exact project, type, title, and fields.',
    parameters: CREATE_SCHEMA,
    execute: (args, exec) => runMeego('workitem create', args, exec.signal),
  });

  register(ctx, {
    name: 'meego_workitem_update',
    description: 'Update fields on a Feishu Project (Meego) work item. MUTATING: call only after the user has clearly confirmed the exact work item and changes.',
    parameters: UPDATE_SCHEMA,
    execute: (args, exec) => runMeego('workitem update', args, exec.signal),
  });

  register(ctx, {
    name: 'meego_workitem_transition_state',
    description: 'Move a Meego status-flow work item using a transition ID. MUTATING: call only after the user has clearly confirmed the exact transition.',
    parameters: TRANSITION_SCHEMA,
    execute: (args, exec) => runMeego('workflow transition-state', args, exec.signal),
  });
}

function register(ctx, definition) {
  ctx.tools.register({
    ...definition,
    output: {
      schema: RESULT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: renderResult(value) }],
      presentationMeta: (_args, value) => ({ command: value.command }),
    },
    timeoutMs: DEFAULT_TIMEOUT_MS + 5_000,
    isConcurrencySafe: () => definition.name.startsWith('meego_') && !definition.name.includes('create') && !definition.name.includes('update') && !definition.name.includes('transition'),
    presentCall: (args) => ({ card: 'generic', title: definition.name, rawInput: redactArgs(args) }),
  });
}

async function runMeego(command, args, signal) {
  const status = await runCli(['auth', 'status', '--format', 'json'], signal);
  if (status.code !== 0) {
    throw new Error(`Meego auth status failed: ${compact(status.stderr || status.stdout)}`);
  }
  const auth = parseJson(status.stdout, 'meegle auth status');
  if (auth?.authenticated !== true) {
    throw new Error('Meego is not authenticated. Run `meegle auth login --host project.feishu.cn` (or your Meego host) first.');
  }

  const cliArgs = commandArgs(command, args);
  const result = await runCli([...cliArgs, '--format', 'json'], signal);
  if (result.code !== 0) {
    throw new Error(`${command} failed: ${compact(result.stderr || result.stdout)}`);
  }
  const data = parseJson(result.stdout, `meegle ${command}`);
  if (data && typeof data === 'object' && !Array.isArray(data) && (data.error || data.err_msg)) {
    throw new Error(`${command} failed: ${compact(data.message || data.err_msg || data.error)}`);
  }
  return { command, data };
}

function commandArgs(command, args) {
  const params = { ...args };
  if (command === 'workitem get' && !params.fields) delete params.fields;
  if (command === 'project search' && !params.project_key) delete params.project_key;
  return [command.split(' '), '--params', JSON.stringify(params)].flat();
}

function runCli(args, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(MEEGLE_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'], signal, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout = cap(stdout + chunk.toString());
    });
    child.stderr.on('data', (chunk) => {
      stderr = cap(stderr + chunk.toString());
    });
    child.on('error', reject);
    child.on('close', (code, signalName) => resolve({ code: code ?? 1, signal: signalName, stdout, stderr }));
  });
}

function parseJson(text, source) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${source} returned non-JSON output: ${compact(text)}`);
  }
}

function renderResult(value) {
  return JSON.stringify(value.data, null, 2);
}

function redactArgs(args) {
  if (!args || typeof args !== 'object') return args;
  const copy = JSON.parse(JSON.stringify(args));
  if (copy.fields) {
    for (const field of copy.fields) {
      if (field && typeof field.field_value === 'string' && field.field_value.length > 200) {
        field.field_value = `${field.field_value.slice(0, 200)}…`;
      }
    }
  }
  return copy;
}

function compact(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 800);
}

function cap(text) {
  return text.length > OUTPUT_CAP ? `${text.slice(0, OUTPUT_CAP)}…` : text;
}

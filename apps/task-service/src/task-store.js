const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_DATA_FILE = 'tasks.json';

const defaultTasks = [
  {
    id: 'learning-process-basics',
    title: 'Grundlagen kennenlernen',
    description: 'Ein kurzer einführender Lernschritt für den Demo-Ablauf.',
    type: 'DEMO_TASK',
    content: {
      instructions: 'Lies die Grundlagen und bestätige anschließend deinen Lernfortschritt.',
    },
    defaultMaxScore: 10,
    defaultPassThreshold: 50,
    mockEvaluationMode: 'SELF_CONFIRMATION',
  },
  {
    id: 'learning-process-apply-basics',
    title: 'Grundlagen anwenden',
    description: 'Eine manuell bewertete Demo-Aufgabe mit Abgabe und Lehrendenfeedback.',
    type: 'DEMO_TASK',
    content: {
      instructions: 'Bearbeite die Grundlagenaufgabe und lade deine Abgabe hoch.',
    },
    defaultMaxScore: 10,
    defaultPassThreshold: 50,
    mockEvaluationMode: 'MANUAL_REVIEW',
  },
  {
    id: 'learning-process-final-task',
    title: 'Automatische Demo-Bewertung auslösen',
    description: 'Eine automatisch bewertete Demo-Aufgabe, die im Mini-Projekt durch einen Mock bewertet wird.',
    type: 'DEMO_TASK',
    content: {
      instructions: 'Sende eine Demo-Abgabe ab. Der Task Service bewertet sie automatisch.',
    },
    defaultMaxScore: 10,
    defaultPassThreshold: 50,
    mockEvaluationMode: 'AUTO_PASS_UNLESS_FAILED',
  },
];

const toIsoString = (value = new Date()) => value instanceof Date
  ? value.toISOString()
  : new Date(value).toISOString();

const normalizeNumber = (value, fallback) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizeTaskPayload = (payload = {}, existingTask = null) => {
  const now = toIsoString();
  const title = payload.title ?? existingTask?.title;

  if (typeof title !== 'string' || title.trim().length === 0) {
    const error = new Error('title is required');
    error.statusCode = 400;
    throw error;
  }

  const id = payload.id ?? existingTask?.id ?? crypto.randomUUID();
  const normalizedId = String(id).trim();

  if (!normalizedId) {
    const error = new Error('id must not be empty');
    error.statusCode = 400;
    throw error;
  }

  return {
    id: normalizedId,
    title: title.trim(),
    description: String(payload.description ?? existingTask?.description ?? '').trim(),
    type: String(payload.type ?? existingTask?.type ?? 'MOCK').trim() || 'MOCK',
    content: payload.content && typeof payload.content === 'object'
      ? payload.content
      : existingTask?.content ?? {},
    defaultMaxScore: normalizeNumber(
      payload.defaultMaxScore ?? payload.maxScore,
      existingTask?.defaultMaxScore ?? 10,
    ),
    defaultPassThreshold: normalizeNumber(
      payload.defaultPassThreshold ?? payload.passThreshold,
      existingTask?.defaultPassThreshold ?? 50,
    ),
    mockEvaluationMode: String(
      payload.mockEvaluationMode ?? existingTask?.mockEvaluationMode ?? 'AUTO_PASS_UNLESS_FAILED',
    ),
    createdAt: existingTask?.createdAt ?? now,
    updatedAt: now,
  };
};

class TaskStore {
  constructor(options = {}) {
    const dataDir = options.dataDir ?? process.env.TASK_SERVICE_DATA_DIR ?? DEFAULT_DATA_DIR;

    this.filePath = options.filePath ?? path.join(dataDir, DEFAULT_DATA_FILE);
    this.seedTasks = options.seedTasks ?? defaultTasks;
  }

  async listTasks(ids = []) {
    const tasks = await this.readTasks();
    const wantedIds = new Set(ids.filter(Boolean).map(String));
    const filteredTasks = wantedIds.size > 0
      ? tasks.filter((task) => wantedIds.has(task.id))
      : tasks;

    return filteredTasks.sort((left, right) => left.title.localeCompare(right.title));
  }

  async getTask(id) {
    const tasks = await this.readTasks();

    return tasks.find((task) => task.id === String(id)) ?? null;
  }

  async upsertTask(payload) {
    const tasks = await this.readTasks();
    const existingIndex = tasks.findIndex((task) => task.id === String(payload.id ?? ''));
    const existingTask = existingIndex >= 0 ? tasks[existingIndex] : null;
    const task = normalizeTaskPayload(payload, existingTask);

    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }

    await this.writeTasks(tasks);

    return task;
  }

  async updateTask(id, payload) {
    const tasks = await this.readTasks();
    const existingIndex = tasks.findIndex((task) => task.id === String(id));

    if (existingIndex < 0) {
      return null;
    }

    const task = normalizeTaskPayload({ ...payload, id: String(id) }, tasks[existingIndex]);
    tasks[existingIndex] = task;
    await this.writeTasks(tasks);

    return task;
  }

  async deleteTask(id) {
    const tasks = await this.readTasks();
    const nextTasks = tasks.filter((task) => task.id !== String(id));

    if (nextTasks.length === tasks.length) {
      return false;
    }

    await this.writeTasks(nextTasks);

    return true;
  }

  async readTasks() {
    await this.ensureInitialized();
    const content = await fs.readFile(this.filePath, 'utf8');
    const parsed = JSON.parse(content);

    return Array.isArray(parsed.tasks) ? parsed.tasks : [];
  }

  async writeTasks(tasks) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify({ tasks }, null, 2)}\n`,
      'utf8',
    );
    await fs.rename(temporaryPath, this.filePath);
  }

  async ensureInitialized() {
    try {
      await fs.access(this.filePath);
    } catch {
      const now = toIsoString();
      await this.writeTasks(
        this.seedTasks.map((task) => normalizeTaskPayload({
          ...task,
          createdAt: task.createdAt ?? now,
          updatedAt: task.updatedAt ?? now,
        })),
      );
    }
  }
}

module.exports = {
  TaskStore,
  defaultTasks,
  normalizeTaskPayload,
};

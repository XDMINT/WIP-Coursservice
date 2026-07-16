const http = require('node:http');

const { evaluateSubmission } = require('./evaluation');
const { TaskStore } = require('./task-store');

const PORT = Number(process.env.PORT ?? 3000);
const MAX_REQUEST_BYTES = 1024 * 1024;

const parseUrl = (request) => new URL(request.url, 'http://task-service.local');

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
};

const readJsonBody = (request) => new Promise((resolve, reject) => {
  let body = '';

  request.on('data', (chunk) => {
    body += chunk;

    if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) {
      reject(new Error('Request body too large'));
      request.destroy();
    }
  });

  request.on('end', () => {
    if (!body.trim()) {
      resolve({});
      return;
    }

    try {
      resolve(JSON.parse(body));
    } catch {
      reject(new Error('Request body must be valid JSON'));
    }
  });

  request.on('error', reject);
});

const extractTaskId = (pathname) => {
  const match = pathname.match(/^\/api\/tasks\/([^/]+)$/);

  return match ? decodeURIComponent(match[1]) : null;
};

const createServer = (options = {}) => {
  const taskStore = options.taskStore ?? new TaskStore(options.storeOptions);

  return http.createServer(async (request, response) => {
  const requestUrl = parseUrl(request);

  if (request.method === 'GET' && request.url === '/api/health') {
    sendJson(response, 200, { status: 'ok', service: 'task-service' });
    return;
  }

  try {
    if (request.method === 'GET' && requestUrl.pathname === '/api/tasks') {
      const ids = requestUrl.searchParams.getAll('ids')
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean);

      sendJson(response, 200, await taskStore.listTasks(ids));
      return;
    }

    const taskId = extractTaskId(requestUrl.pathname);

    if (request.method === 'GET' && taskId) {
      const task = await taskStore.getTask(taskId);

      if (!task) {
        sendJson(response, 404, { message: 'Task not found' });
        return;
      }

      sendJson(response, 200, task);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/tasks') {
      const payload = await readJsonBody(request);
      const task = await taskStore.upsertTask(payload);

      sendJson(response, 201, task);
      return;
    }

    if (request.method === 'PUT' && taskId) {
      const payload = await readJsonBody(request);
      const task = await taskStore.updateTask(taskId, payload);

      if (!task) {
        sendJson(response, 404, { message: 'Task not found' });
        return;
      }

      sendJson(response, 200, task);
      return;
    }

    if (request.method === 'DELETE' && taskId) {
      const deleted = await taskStore.deleteTask(taskId);

      if (!deleted) {
        sendJson(response, 404, { message: 'Task not found' });
        return;
      }

      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/tasks/evaluate') {
      const payload = await readJsonBody(request);

      if (!payload.taskId || !payload.studentId) {
        sendJson(response, 400, {
          message: 'taskId and studentId are required',
        });
        return;
      }

      const task = await taskStore.getTask(payload.taskId);
      const evaluationPayload = task
        ? {
          ...payload,
          maxScore: payload.maxScore ?? payload.maxPoints ?? task.defaultMaxScore,
          passThresholdPercent:
            payload.passThresholdPercent ?? payload.passThreshold ?? task.defaultPassThreshold,
        }
        : payload;

      sendJson(response, 200, evaluateSubmission(evaluationPayload));
      return;
    }

    sendJson(response, 404, { message: 'Not found' });
  } catch (error) {
    sendJson(response, error.statusCode ?? 400, {
      message: error instanceof Error ? error.message : 'Invalid task evaluation request',
    });
  }
  });
};

if (require.main === module) {
  createServer().listen(PORT, '0.0.0.0', () => {
    console.log(`task-service listening on ${PORT}`);
  });
}

module.exports = {
  createServer,
};

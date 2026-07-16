const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { evaluateSubmission } = require('../src/evaluation');
const { createServer } = require('../src/main');
const { TaskStore } = require('../src/task-store');

describe('task-service mock evaluation', () => {
  it('returns deterministic passed results at the configured threshold', () => {
    assert.deepEqual(
      evaluateSubmission({
        taskId: 'task-1',
        studentId: 'student-1',
        maxScore: 10,
        passThresholdPercent: 50,
        submission: {
          content: 'Demo-Abgabe',
          passed: true,
        },
      }),
      {
        taskId: 'task-1',
        score: 5,
        maxScore: 10,
        passed: true,
        feedback: 'Demo-Bewertung erfolgreich.',
      },
    );
  });

  it('returns deterministic failed results when requested by the demo submission', () => {
    assert.deepEqual(
      evaluateSubmission({
        taskId: 'task-2',
        studentId: 'student-1',
        maxScore: 10,
        passThresholdPercent: 50,
        submission: {
          passed: false,
        },
      }),
      {
        taskId: 'task-2',
        score: 4,
        maxScore: 10,
        passed: false,
        feedback: 'Demo-Bewertung nicht erfolgreich.',
      },
    );
  });

  it('serves the HTTP evaluation endpoint', async () => {
    const taskStore = new TaskStore({
      filePath: '/tmp/ewill-task-service-test-evaluation.json',
      seedTasks: [],
    });
    await taskStore.writeTasks([{
      id: 'task-http',
      title: 'HTTP Task',
      description: 'Stored task',
      type: 'MOCK',
      content: {},
      defaultMaxScore: 100,
      defaultPassThreshold: 50,
      mockEvaluationMode: 'AUTO_PASS_UNLESS_FAILED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }]);
    const server = createServer({ taskStore });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const address = server.address();
      const response = await fetch(`http://127.0.0.1:${address.port}/api/tasks/evaluate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          taskId: 'task-http',
          studentId: 'student-http',
          maxScore: 100,
          submission: {
            content: 'Demo',
          },
        }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        taskId: 'task-http',
        score: 50,
        maxScore: 100,
        passed: true,
        feedback: 'Demo-Bewertung erfolgreich.',
      });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('creates, reads, updates and deletes stored tasks through HTTP', async () => {
    const taskStore = new TaskStore({
      filePath: '/tmp/ewill-task-service-test-crud.json',
      seedTasks: [],
    });
    await taskStore.writeTasks([]);
    const server = createServer({ taskStore });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const address = server.address();
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const createResponse = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          id: 'stored-task',
          title: 'Stored task',
          description: 'Initial description',
          type: 'MOCK',
          content: {
            instructions: 'Do the thing.',
          },
          defaultMaxScore: 12,
          defaultPassThreshold: 60,
        }),
      });

      assert.equal(createResponse.status, 201);
      assert.equal((await createResponse.json()).id, 'stored-task');

      const readResponse = await fetch(`${baseUrl}/api/tasks/stored-task`);
      assert.equal(readResponse.status, 200);
      const storedTask = await readResponse.json();
      assert.match(storedTask.createdAt, /\d{4}-\d{2}-\d{2}T/);
      assert.match(storedTask.updatedAt, /\d{4}-\d{2}-\d{2}T/);
      assert.deepEqual({
        ...storedTask,
        createdAt: '<date>',
        updatedAt: '<date>',
      }, {
        id: 'stored-task',
        title: 'Stored task',
        description: 'Initial description',
        type: 'MOCK',
        content: {
          instructions: 'Do the thing.',
        },
        defaultMaxScore: 12,
        defaultPassThreshold: 60,
        mockEvaluationMode: 'AUTO_PASS_UNLESS_FAILED',
        createdAt: '<date>',
        updatedAt: '<date>',
      });

      const updateResponse = await fetch(`${baseUrl}/api/tasks/stored-task`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Updated task',
        }),
      });

      assert.equal(updateResponse.status, 200);
      assert.equal((await updateResponse.json()).title, 'Updated task');

      const listResponse = await fetch(`${baseUrl}/api/tasks?ids=stored-task,missing-task`);
      assert.equal(listResponse.status, 200);
      assert.equal((await listResponse.json()).length, 1);

      const deleteResponse = await fetch(`${baseUrl}/api/tasks/stored-task`, {
        method: 'DELETE',
      });

      assert.equal(deleteResponse.status, 204);
      assert.equal((await fetch(`${baseUrl}/api/tasks/stored-task`)).status, 404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

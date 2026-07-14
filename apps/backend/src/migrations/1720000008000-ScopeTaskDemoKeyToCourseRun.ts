import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScopeTaskDemoKeyToCourseRun1720000008000 implements MigrationInterface {
  name = 'ScopeTaskDemoKeyToCourseRun1720000008000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "uq_task_course_demo_key"');
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_run_demo_key"
      ON "task" ("courseRunId", "demoKey")
      WHERE "courseRunId" IS NOT NULL AND "demoKey" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "uq_task_run_demo_key"');
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_course_demo_key"
      ON "task" ("courseId", "demoKey")
      WHERE "demoKey" IS NOT NULL
    `);
  }
}

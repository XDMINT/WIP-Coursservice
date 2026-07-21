import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskDependencies1720000017000 implements MigrationInterface {
  name = 'AddTaskDependencies1720000017000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_dependency" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "taskId" uuid NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
        "prerequisiteTaskId" uuid NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
        "condition" varchar NOT NULL DEFAULT 'PASSED',
        "operator" varchar NOT NULL DEFAULT 'ALL_OF',
        "createdBy" varchar,
        "updatedBy" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_dependency_target_prerequisite"
      ON "task_dependency" ("taskId", "prerequisiteTaskId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_dependency_prerequisite"
      ON "task_dependency" ("prerequisiteTaskId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_dependency_prerequisite"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_task_dependency_target_prerequisite"');
    await queryRunner.query('DROP TABLE IF EXISTS "task_dependency"');
  }
}

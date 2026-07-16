import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenTaskProgressPersistence1720000004000 implements MigrationInterface {
  name = 'HardenTaskProgressPersistence1720000004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_progress_task_enrollment"
      ON "task_progress" ("taskId", "enrollmentId")
      WHERE "taskId" IS NOT NULL AND "enrollmentId" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_progress_enrollment"
      ON "task_progress" ("enrollmentId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_progress_task"
      ON "task_progress" ("taskId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_progress_task"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_progress_enrollment"');
  }
}

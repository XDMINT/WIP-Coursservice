import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandLearningProcess1720000003000 implements MigrationInterface {
  name = 'ExpandLearningProcess1720000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task"
        ADD COLUMN IF NOT EXISTS "unlockMode" varchar NOT NULL DEFAULT 'IMMEDIATE',
        ADD COLUMN IF NOT EXISTS "demoKey" varchar
    `);

    await queryRunner.query(`
      UPDATE "task"
      SET "unlockMode" = 'AUTOMATIC'
      WHERE "prerequisiteTaskId" IS NOT NULL
        AND "prerequisiteTaskId" <> ''
        AND ("unlockMode" IS NULL OR "unlockMode" = 'IMMEDIATE')
    `);

    await queryRunner.query(`
      ALTER TABLE "task_progress"
        ADD COLUMN IF NOT EXISTS "unlockedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "unlockSource" varchar,
        ADD COLUMN IF NOT EXISTS "resultPassed" boolean,
        ADD COLUMN IF NOT EXISTS "resultRecordedAt" timestamptz
    `);

    await queryRunner.query(`
      UPDATE "task_progress"
      SET "status" = 'AVAILABLE'
      WHERE "status" = 'NOT_STARTED'
    `);

    await queryRunner.query(`
      UPDATE "task_progress"
      SET
        "unlockedAt" = COALESCE("unlockedAt", "createdAt", now()),
        "unlockSource" = COALESCE("unlockSource", 'IMMEDIATE')
      WHERE "status" IN ('AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'FAILED')
    `);

    await queryRunner.query(`
      UPDATE "task_progress"
      SET
        "resultPassed" = COALESCE("resultPassed", true),
        "resultRecordedAt" = COALESCE("resultRecordedAt", "completedAt", "updatedAt", now())
      WHERE "status" = 'COMPLETED'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_course_order"
      ON "task" ("courseId", "order")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_prerequisite"
      ON "task" ("prerequisiteTaskId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_course_demo_key"
      ON "task" ("courseId", "demoKey")
      WHERE "demoKey" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_progress_task_enrollment"
      ON "task_progress" ("taskId", "enrollmentId")
      WHERE "taskId" IS NOT NULL AND "enrollmentId" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "uq_task_progress_task_enrollment"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_task_course_demo_key"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_prerequisite"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_course_order"');
    await queryRunner.query('ALTER TABLE "task_progress" DROP COLUMN IF EXISTS "resultRecordedAt"');
    await queryRunner.query('ALTER TABLE "task_progress" DROP COLUMN IF EXISTS "resultPassed"');
    await queryRunner.query('ALTER TABLE "task_progress" DROP COLUMN IF EXISTS "unlockSource"');
    await queryRunner.query('ALTER TABLE "task_progress" DROP COLUMN IF EXISTS "unlockedAt"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "demoKey"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "unlockMode"');
  }
}

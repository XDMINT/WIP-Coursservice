import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskAssessments1720000013000 implements MigrationInterface {
  name = 'AddTaskAssessments1720000013000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task"
        ADD COLUMN IF NOT EXISTS "gradingMode" varchar NOT NULL DEFAULT 'NOT_GRADED',
        ADD COLUMN IF NOT EXISTS "maxPoints" numeric(10, 2),
        ADD COLUMN IF NOT EXISTS "passThreshold" numeric(5, 2),
        ADD COLUMN IF NOT EXISTS "feedbackRequired" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "allowRetries" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_assessment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "courseRunId" uuid NOT NULL REFERENCES "course_runs"("id") ON DELETE CASCADE,
        "courseVersionId" uuid NOT NULL REFERENCES "course_versions"("id") ON DELETE CASCADE,
        "taskId" uuid NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
        "studentId" varchar NOT NULL,
        "gradingMode" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'NOT_SUBMITTED',
        "points" numeric(10, 2),
        "maxPoints" numeric(10, 2),
        "passThreshold" numeric(5, 2),
        "passed" boolean,
        "feedback" text,
        "submissionData" jsonb,
        "assessedBy" varchar,
        "assessedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_assessment_run_task_student"
      ON "task_assessment" ("courseRunId", "taskId", "studentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_assessment_run_student"
      ON "task_assessment" ("courseRunId", "studentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_assessment_task"
      ON "task_assessment" ("taskId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_assessment_task"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_assessment_run_student"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_task_assessment_run_task_student"');
    await queryRunner.query('DROP TABLE IF EXISTS "task_assessment"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "allowRetries"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "feedbackRequired"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "passThreshold"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "maxPoints"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "gradingMode"');
  }
}

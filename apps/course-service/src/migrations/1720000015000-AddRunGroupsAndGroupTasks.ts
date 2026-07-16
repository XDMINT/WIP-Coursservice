import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRunGroupsAndGroupTasks1720000015000 implements MigrationInterface {
  name = 'AddRunGroupsAndGroupTasks1720000015000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groups"
      ADD COLUMN IF NOT EXISTS "course_run_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "groups"
      SET "course_run_id" = "course_runs"."id"
      FROM "course_runs"
      WHERE
        "groups"."course_id" = "course_runs"."courseId"
        AND "course_runs"."isActive" = true
        AND "groups"."course_run_id" IS NULL
    `);

    await this.addForeignKeyIfMissing(
      queryRunner,
      'groups',
      'fk_groups_course_run',
      'course_run_id',
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_groups_course_run_id"
      ON "groups" ("course_run_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "task"
      ADD COLUMN IF NOT EXISTS "workMode" varchar NOT NULL DEFAULT 'INDIVIDUAL'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "group_task_progress" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "courseRunId" uuid NOT NULL REFERENCES "course_runs"("id") ON DELETE CASCADE,
        "courseVersionId" uuid NOT NULL REFERENCES "course_versions"("id") ON DELETE CASCADE,
        "taskId" uuid NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
        "groupId" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
        "status" varchar NOT NULL DEFAULT 'AVAILABLE',
        "progressData" jsonb,
        "startedAt" timestamptz,
        "submittedAt" timestamptz,
        "completedAt" timestamptz,
        "createdBy" varchar,
        "updatedBy" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_group_task_progress_run_task_group"
      ON "group_task_progress" ("courseRunId", "taskId", "groupId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_group_task_progress_run_group"
      ON "group_task_progress" ("courseRunId", "groupId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_group_task_progress_task"
      ON "group_task_progress" ("taskId")
    `);

    await queryRunner.query(`
      ALTER TABLE "task_assessment"
      ADD COLUMN IF NOT EXISTS "assessmentTargetType" varchar NOT NULL DEFAULT 'INDIVIDUAL',
      ADD COLUMN IF NOT EXISTS "groupId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "task_assessment"
      ALTER COLUMN "studentId" DROP NOT NULL
    `);

    await this.addForeignKeyIfMissing(
      queryRunner,
      'task_assessment',
      'fk_task_assessment_group',
      'groupId',
      'groups',
      'id',
    );

    await queryRunner.query(`
      UPDATE "task_assessment"
      SET "assessmentTargetType" = 'INDIVIDUAL'
      WHERE "assessmentTargetType" IS NULL
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_task_assessment_run_task_student"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_assessment_run_task_student"
      ON "task_assessment" ("courseRunId", "taskId", "studentId")
      WHERE "studentId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_assessment_run_task_group"
      ON "task_assessment" ("courseRunId", "taskId", "groupId")
      WHERE "groupId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_assessment_run_group"
      ON "task_assessment" ("courseRunId", "groupId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_assessment_run_group"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_task_assessment_run_task_group"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_task_assessment_run_task_student"');
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_assessment_run_task_student"
      ON "task_assessment" ("courseRunId", "taskId", "studentId")
    `);
    await queryRunner.query('ALTER TABLE "task_assessment" DROP CONSTRAINT IF EXISTS "fk_task_assessment_group"');
    await queryRunner.query('ALTER TABLE "task_assessment" DROP COLUMN IF EXISTS "groupId"');
    await queryRunner.query('ALTER TABLE "task_assessment" DROP COLUMN IF EXISTS "assessmentTargetType"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_group_task_progress_task"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_group_task_progress_run_group"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_group_task_progress_run_task_group"');
    await queryRunner.query('DROP TABLE IF EXISTS "group_task_progress"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "workMode"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_groups_course_run_id"');
    await queryRunner.query('ALTER TABLE "groups" DROP CONSTRAINT IF EXISTS "fk_groups_course_run"');
    await queryRunner.query('ALTER TABLE "groups" DROP COLUMN IF EXISTS "course_run_id"');
  }

  private async addForeignKeyIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    constraintName: string,
    columnName: string,
    referencedTable = 'course_runs',
    referencedColumn = 'id',
  ): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE
            constraint_name = '${constraintName}'
            AND table_name = '${tableName}'
        ) THEN
          ALTER TABLE "${tableName}"
          ADD CONSTRAINT "${constraintName}"
          FOREIGN KEY ("${columnName}") REFERENCES "${referencedTable}"("${referencedColumn}")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }
}

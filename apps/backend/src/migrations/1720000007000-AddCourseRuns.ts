import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseRuns1720000007000 implements MigrationInterface {
  name = 'AddCourseRuns1720000007000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "recurrence_type" varchar NOT NULL DEFAULT 'CONTINUOUS'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "courseId" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "label" varchar NOT NULL,
        "startDate" date,
        "endDate" date,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "sourceRunId" uuid REFERENCES "course_runs"("id") ON DELETE SET NULL,
        "isActive" boolean NOT NULL DEFAULT false,
        "createdBy" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO "course_runs" (
        "courseId",
        "label",
        "startDate",
        "status",
        "isActive",
        "createdBy"
      )
      SELECT
        "courses"."id",
        COALESCE(NULLIF("courses"."semester", ''), 'Fortlaufend'),
        "courses"."created_at"::date,
        "courses"."status",
        true,
        COALESCE("courses"."created_by", "courses"."updated_by")
      FROM "courses"
      WHERE NOT EXISTS (
        SELECT 1
        FROM "course_runs"
        WHERE "course_runs"."courseId" = "courses"."id"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_course_runs_course_id"
      ON "course_runs" ("courseId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_course_runs_active_per_course"
      ON "course_runs" ("courseId")
      WHERE "isActive" = true
    `);

    await queryRunner.query(`
      ALTER TABLE "enrollments"
      ADD COLUMN IF NOT EXISTS "course_run_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "learning_material"
      ADD COLUMN IF NOT EXISTS "courseRunId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "task"
      ADD COLUMN IF NOT EXISTS "courseRunId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "assignment"
      ADD COLUMN IF NOT EXISTS "courseRunId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "course_result"
      ADD COLUMN IF NOT EXISTS "courseRunId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "course_versions"
      ADD COLUMN IF NOT EXISTS "course_run_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "enrollments"
      SET "course_run_id" = "course_runs"."id"
      FROM "course_runs"
      WHERE
        "enrollments"."course_id" = "course_runs"."courseId"
        AND "course_runs"."isActive" = true
        AND "enrollments"."course_run_id" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "learning_material"
      SET "courseRunId" = "course_runs"."id"
      FROM "course_runs"
      WHERE
        "learning_material"."courseId" = "course_runs"."courseId"
        AND "course_runs"."isActive" = true
        AND "learning_material"."courseRunId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "task"
      SET "courseRunId" = "course_runs"."id"
      FROM "course_runs"
      WHERE
        "task"."courseId" = "course_runs"."courseId"
        AND "course_runs"."isActive" = true
        AND "task"."courseRunId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "assignment"
      SET "courseRunId" = "course_runs"."id"
      FROM "course_runs"
      WHERE
        "assignment"."courseId" = "course_runs"."courseId"
        AND "course_runs"."isActive" = true
        AND "assignment"."courseRunId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "course_result"
      SET "courseRunId" = "course_runs"."id"
      FROM "course_runs"
      WHERE
        "course_result"."courseId" = "course_runs"."courseId"
        AND "course_runs"."isActive" = true
        AND "course_result"."courseRunId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "course_versions"
      SET "course_run_id" = "course_runs"."id"
      FROM "course_runs"
      WHERE
        "course_versions"."course_id" = "course_runs"."courseId"
        AND "course_runs"."isActive" = true
        AND "course_versions"."course_run_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "enrollments"
      DROP CONSTRAINT IF EXISTS "uq_enrollments_course_user"
    `);
    await queryRunner.query('DROP INDEX IF EXISTS "uq_course_versions_active_per_course"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_course_versions_course_version_number"');

    await this.addForeignKeyIfMissing(
      queryRunner,
      'enrollments',
      'fk_enrollments_course_run',
      'course_run_id',
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      'learning_material',
      'fk_learning_material_course_run',
      'courseRunId',
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      'task',
      'fk_task_course_run',
      'courseRunId',
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      'assignment',
      'fk_assignment_course_run',
      'courseRunId',
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      'course_result',
      'fk_course_result_course_run',
      'courseRunId',
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      'course_versions',
      'fk_course_versions_course_run',
      'course_run_id',
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_enrollments_run_user"
      ON "enrollments" ("course_run_id", "user_id")
      WHERE "course_run_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_course_versions_run_version_number"
      ON "course_versions" ("course_run_id", "version_number")
      WHERE "course_run_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_course_versions_active_per_run"
      ON "course_versions" ("course_run_id")
      WHERE "course_run_id" IS NOT NULL AND "is_active" = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_learning_material_course_run_id"
      ON "learning_material" ("courseRunId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_course_run_id"
      ON "task" ("courseRunId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_assignment_course_run_id"
      ON "assignment" ("courseRunId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_course_result_course_run_id"
      ON "course_result" ("courseRunId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_course_result_course_run_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_assignment_course_run_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_course_run_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_learning_material_course_run_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_course_versions_active_per_run"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_course_versions_run_version_number"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_enrollments_run_user"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_course_runs_active_per_course"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_course_runs_course_id"');
    await queryRunner.query('ALTER TABLE "course_versions" DROP CONSTRAINT IF EXISTS "fk_course_versions_course_run"');
    await queryRunner.query('ALTER TABLE "course_result" DROP CONSTRAINT IF EXISTS "fk_course_result_course_run"');
    await queryRunner.query('ALTER TABLE "assignment" DROP CONSTRAINT IF EXISTS "fk_assignment_course_run"');
    await queryRunner.query('ALTER TABLE "task" DROP CONSTRAINT IF EXISTS "fk_task_course_run"');
    await queryRunner.query('ALTER TABLE "learning_material" DROP CONSTRAINT IF EXISTS "fk_learning_material_course_run"');
    await queryRunner.query('ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "fk_enrollments_course_run"');
    await queryRunner.query('ALTER TABLE "course_versions" DROP COLUMN IF EXISTS "course_run_id"');
    await queryRunner.query('ALTER TABLE "course_result" DROP COLUMN IF EXISTS "courseRunId"');
    await queryRunner.query('ALTER TABLE "assignment" DROP COLUMN IF EXISTS "courseRunId"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "courseRunId"');
    await queryRunner.query('ALTER TABLE "learning_material" DROP COLUMN IF EXISTS "courseRunId"');
    await queryRunner.query('ALTER TABLE "enrollments" DROP COLUMN IF EXISTS "course_run_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "course_runs"');
    await queryRunner.query('ALTER TABLE "courses" DROP COLUMN IF EXISTS "recurrence_type"');
  }

  private async addForeignKeyIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    constraintName: string,
    columnName: string,
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
          FOREIGN KEY ("${columnName}") REFERENCES "course_runs"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }
}

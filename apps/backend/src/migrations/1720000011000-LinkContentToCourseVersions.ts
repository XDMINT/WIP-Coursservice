import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkContentToCourseVersions1720000011000 implements MigrationInterface {
  name = 'LinkContentToCourseVersions1720000011000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "learning_material"
      ADD COLUMN IF NOT EXISTS "courseVersionId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "task"
      ADD COLUMN IF NOT EXISTS "courseVersionId" uuid
    `);

    await queryRunner.query(`
      WITH active_versions AS (
        SELECT DISTINCT ON ("course_run_id")
          "id",
          "course_run_id"
        FROM "course_versions"
        WHERE "course_run_id" IS NOT NULL AND "is_active" = true
        ORDER BY "course_run_id", "version_number" DESC
      )
      UPDATE "learning_material"
      SET "courseVersionId" = active_versions."id"
      FROM active_versions
      WHERE
        "learning_material"."courseRunId" = active_versions."course_run_id"
        AND "learning_material"."courseVersionId" IS NULL
    `);
    await queryRunner.query(`
      WITH active_versions AS (
        SELECT DISTINCT ON ("course_run_id")
          "id",
          "course_run_id"
        FROM "course_versions"
        WHERE "course_run_id" IS NOT NULL AND "is_active" = true
        ORDER BY "course_run_id", "version_number" DESC
      )
      UPDATE "task"
      SET "courseVersionId" = active_versions."id"
      FROM active_versions
      WHERE
        "task"."courseRunId" = active_versions."course_run_id"
        AND "task"."courseVersionId" IS NULL
    `);

    await queryRunner.query(`
      WITH latest_versions AS (
        SELECT DISTINCT ON ("course_run_id")
          "id",
          "course_run_id"
        FROM "course_versions"
        WHERE "course_run_id" IS NOT NULL
        ORDER BY "course_run_id", "version_number" DESC
      )
      UPDATE "learning_material"
      SET "courseVersionId" = latest_versions."id"
      FROM latest_versions
      WHERE
        "learning_material"."courseRunId" = latest_versions."course_run_id"
        AND "learning_material"."courseVersionId" IS NULL
    `);
    await queryRunner.query(`
      WITH latest_versions AS (
        SELECT DISTINCT ON ("course_run_id")
          "id",
          "course_run_id"
        FROM "course_versions"
        WHERE "course_run_id" IS NOT NULL
        ORDER BY "course_run_id", "version_number" DESC
      )
      UPDATE "task"
      SET "courseVersionId" = latest_versions."id"
      FROM latest_versions
      WHERE
        "task"."courseRunId" = latest_versions."course_run_id"
        AND "task"."courseVersionId" IS NULL
    `);

    await this.addForeignKeyIfMissing(
      queryRunner,
      'learning_material',
      'fk_learning_material_course_version',
      'courseVersionId',
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      'task',
      'fk_task_course_version',
      'courseVersionId',
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_learning_material_course_version"
      ON "learning_material" ("courseVersionId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_course_version"
      ON "task" ("courseVersionId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_course_version"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_learning_material_course_version"');
    await queryRunner.query('ALTER TABLE "task" DROP CONSTRAINT IF EXISTS "fk_task_course_version"');
    await queryRunner.query('ALTER TABLE "learning_material" DROP CONSTRAINT IF EXISTS "fk_learning_material_course_version"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "courseVersionId"');
    await queryRunner.query('ALTER TABLE "learning_material" DROP COLUMN IF EXISTS "courseVersionId"');
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
          FROM pg_constraint
          WHERE conname = '${constraintName}'
        ) THEN
          ALTER TABLE "${tableName}"
          ADD CONSTRAINT "${constraintName}"
          FOREIGN KEY ("${columnName}")
          REFERENCES "course_versions"("id")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }
}

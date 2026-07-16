import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenCourseVersions1720000006000 implements MigrationInterface {
  name = 'HardenCourseVersions1720000006000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_versions"
      ADD COLUMN IF NOT EXISTS "change_summary" text
    `);

    await queryRunner.query(`
      WITH numbered_versions AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "course_id"
            ORDER BY "version_number" ASC, "created_at" ASC, "id" ASC
          ) AS "next_version_number"
        FROM "course_versions"
      )
      UPDATE "course_versions" AS "version"
      SET "version_number" = numbered_versions."next_version_number"
      FROM numbered_versions
      WHERE "version"."id" = numbered_versions."id"
    `);

    await queryRunner.query(`
      WITH active_versions AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "course_id"
            ORDER BY "version_number" DESC, "created_at" DESC, "id" DESC
          ) AS "active_rank"
        FROM "course_versions"
        WHERE "is_active" = true
      )
      UPDATE "course_versions" AS "version"
      SET "is_active" = false
      FROM active_versions
      WHERE
        "version"."id" = active_versions."id"
        AND active_versions."active_rank" > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_course_versions_course_version_number"
      ON "course_versions" ("course_id", "version_number")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_course_versions_active_per_course"
      ON "course_versions" ("course_id")
      WHERE "is_active" = true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "uq_course_versions_active_per_course"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_course_versions_course_version_number"');
    await queryRunner.query('ALTER TABLE "course_versions" DROP COLUMN IF EXISTS "change_summary"');
  }
}

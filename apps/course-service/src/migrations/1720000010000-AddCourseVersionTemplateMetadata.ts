import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseVersionTemplateMetadata1720000010000 implements MigrationInterface {
  name = 'AddCourseVersionTemplateMetadata1720000010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_versions"
      ADD COLUMN IF NOT EXISTS "label" varchar
    `);
    await queryRunner.query(`
      ALTER TABLE "course_versions"
      ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT 'PUBLISHED'
    `);
    await queryRunner.query(`
      ALTER TABLE "course_versions"
      ADD COLUMN IF NOT EXISTS "sourceVersionId" uuid
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_course_versions_source_version'
        ) THEN
          ALTER TABLE "course_versions"
          ADD CONSTRAINT "fk_course_versions_source_version"
          FOREIGN KEY ("sourceVersionId")
          REFERENCES "course_versions"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'chk_course_versions_not_self_source'
        ) THEN
          ALTER TABLE "course_versions"
          ADD CONSTRAINT "chk_course_versions_not_self_source"
          CHECK ("sourceVersionId" IS NULL OR "sourceVersionId" <> "id");
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_course_versions_source_version"
      ON "course_versions" ("sourceVersionId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_course_versions_source_version"');
    await queryRunner.query('ALTER TABLE "course_versions" DROP CONSTRAINT IF EXISTS "chk_course_versions_not_self_source"');
    await queryRunner.query('ALTER TABLE "course_versions" DROP CONSTRAINT IF EXISTS "fk_course_versions_source_version"');
    await queryRunner.query('ALTER TABLE "course_versions" DROP COLUMN IF EXISTS "sourceVersionId"');
    await queryRunner.query('ALTER TABLE "course_versions" DROP COLUMN IF EXISTS "status"');
    await queryRunner.query('ALTER TABLE "course_versions" DROP COLUMN IF EXISTS "label"');
  }
}

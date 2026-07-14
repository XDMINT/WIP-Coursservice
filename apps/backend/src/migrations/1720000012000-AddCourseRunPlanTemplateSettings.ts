import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseRunPlanTemplateSettings1720000012000 implements MigrationInterface {
  name = 'AddCourseRunPlanTemplateSettings1720000012000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "content_template_strategy" varchar NOT NULL DEFAULT 'ACTIVE_VERSION_OF_CURRENT_RUN'
    `);
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "planned_source_version_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_courses_planned_source_version"
      ON "courses" ("planned_source_version_id")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_courses_planned_source_version'
        ) THEN
          ALTER TABLE "courses"
          ADD CONSTRAINT "fk_courses_planned_source_version"
          FOREIGN KEY ("planned_source_version_id")
          REFERENCES "course_versions"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "fk_courses_planned_source_version"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_courses_planned_source_version"');
    await queryRunner.query('ALTER TABLE "courses" DROP COLUMN IF EXISTS "planned_source_version_id"');
    await queryRunner.query('ALTER TABLE "courses" DROP COLUMN IF EXISTS "content_template_strategy"');
  }
}

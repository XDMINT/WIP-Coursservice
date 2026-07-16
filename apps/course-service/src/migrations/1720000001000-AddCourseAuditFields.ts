import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseAuditFields1720000001000 implements MigrationInterface {
  name = 'AddCourseAuditFields1720000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "created_by" varchar,
      ADD COLUMN IF NOT EXISTS "updated_by" varchar
    `);

    await queryRunner.query(`
      ALTER TABLE "enrollments"
      ADD COLUMN IF NOT EXISTS "createdBy" varchar,
      ADD COLUMN IF NOT EXISTS "updatedBy" varchar,
      ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      UPDATE "courses"
      SET "created_by" = COALESCE("created_by", "owner_id"::varchar),
          "updated_by" = COALESCE("updated_by", "owner_id"::varchar)
      WHERE "owner_id" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "enrollments"
      SET "createdBy" = COALESCE("createdBy", "user_id"),
          "updatedBy" = COALESCE("updatedBy", "user_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "enrollments"
      DROP COLUMN IF EXISTS "updatedAt",
      DROP COLUMN IF EXISTS "updatedBy",
      DROP COLUMN IF EXISTS "createdBy"
    `);

    await queryRunner.query(`
      ALTER TABLE "courses"
      DROP COLUMN IF EXISTS "updated_by",
      DROP COLUMN IF EXISTS "created_by"
    `);
  }
}

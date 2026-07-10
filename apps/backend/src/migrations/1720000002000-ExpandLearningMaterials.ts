import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandLearningMaterials1720000002000 implements MigrationInterface {
  name = 'ExpandLearningMaterials1720000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "learning_material"
      ALTER COLUMN "description" DROP NOT NULL,
      ALTER COLUMN "url" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "learning_material"
      ADD COLUMN IF NOT EXISTS "originalFileName" varchar,
      ADD COLUMN IF NOT EXISTS "storageKey" varchar,
      ADD COLUMN IF NOT EXISTS "mimeType" varchar,
      ADD COLUMN IF NOT EXISTS "fileSize" bigint,
      ADD COLUMN IF NOT EXISTS "previewMetadata" jsonb,
      ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "publicationStatus" varchar NOT NULL DEFAULT 'DRAFT',
      ADD COLUMN IF NOT EXISTS "publishedAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz
    `);

    await queryRunner.query(`
      UPDATE "learning_material"
      SET "publicationStatus" = CASE
        WHEN "isPublished" = true THEN 'PUBLISHED'
        ELSE 'DRAFT'
      END,
      "publishedAt" = CASE
        WHEN "isPublished" = true THEN COALESCE("publishedAt", "updatedAt")
        ELSE "publishedAt"
      END
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_learning_material_course_status_sort" ON "learning_material" ("courseId", "publicationStatus", "sortOrder")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_learning_material_course_status_sort"',
    );

    await queryRunner.query(`
      ALTER TABLE "learning_material"
      DROP COLUMN IF EXISTS "archivedAt",
      DROP COLUMN IF EXISTS "publishedAt",
      DROP COLUMN IF EXISTS "publicationStatus",
      DROP COLUMN IF EXISTS "sortOrder",
      DROP COLUMN IF EXISTS "tags",
      DROP COLUMN IF EXISTS "previewMetadata",
      DROP COLUMN IF EXISTS "fileSize",
      DROP COLUMN IF EXISTS "mimeType",
      DROP COLUMN IF EXISTS "storageKey",
      DROP COLUMN IF EXISTS "originalFileName"
    `);
  }
}

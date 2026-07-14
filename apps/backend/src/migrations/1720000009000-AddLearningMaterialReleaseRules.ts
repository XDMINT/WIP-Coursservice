import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLearningMaterialReleaseRules1720000009000 implements MigrationInterface {
  name = 'AddLearningMaterialReleaseRules1720000009000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "learning_material"
      ADD COLUMN IF NOT EXISTS "releaseMode" varchar NOT NULL DEFAULT 'IMMEDIATE'
    `);
    await queryRunner.query(`
      ALTER TABLE "learning_material"
      ADD COLUMN IF NOT EXISTS "releaseAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "learning_material"
      ADD COLUMN IF NOT EXISTS "releaseAfterTaskId" uuid
    `);
    await queryRunner.query(`
      UPDATE "learning_material"
      SET "releaseMode" = 'IMMEDIATE'
      WHERE "releaseMode" IS NULL OR "releaseMode" = ''
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_learning_material_release_after_task"
      ON "learning_material" ("releaseAfterTaskId")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE
            constraint_name = 'fk_learning_material_release_after_task'
            AND table_name = 'learning_material'
        ) THEN
          ALTER TABLE "learning_material"
          ADD CONSTRAINT "fk_learning_material_release_after_task"
          FOREIGN KEY ("releaseAfterTaskId") REFERENCES "task"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "learning_material" DROP CONSTRAINT IF EXISTS "fk_learning_material_release_after_task"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_learning_material_release_after_task"');
    await queryRunner.query('ALTER TABLE "learning_material" DROP COLUMN IF EXISTS "releaseAfterTaskId"');
    await queryRunner.query('ALTER TABLE "learning_material" DROP COLUMN IF EXISTS "releaseAt"');
    await queryRunner.query('ALTER TABLE "learning_material" DROP COLUMN IF EXISTS "releaseMode"');
  }
}

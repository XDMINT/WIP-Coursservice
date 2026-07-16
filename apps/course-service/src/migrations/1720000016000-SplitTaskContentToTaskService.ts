import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitTaskContentToTaskService1720000016000 implements MigrationInterface {
  name = 'SplitTaskContentToTaskService1720000016000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task"
        ADD COLUMN IF NOT EXISTS "externalTaskId" varchar
    `);

    await queryRunner.query(`
      UPDATE "task"
      SET "externalTaskId" = COALESCE(NULLIF("demoKey", ''), "id"::text)
      WHERE "externalTaskId" IS NULL OR "externalTaskId" = ''
    `);

    await queryRunner.query(`
      ALTER TABLE "task"
        ALTER COLUMN "externalTaskId" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_task_external_task_id"
      ON "task" ("externalTaskId")
    `);

    await queryRunner.query(`
      ALTER TABLE "task"
        ALTER COLUMN "title" DROP NOT NULL,
        ALTER COLUMN "description" DROP NOT NULL,
        ALTER COLUMN "type" DROP NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task"
        ALTER COLUMN "title" SET DEFAULT 'Aufgabe',
        ALTER COLUMN "description" SET DEFAULT '',
        ALTER COLUMN "type" SET DEFAULT 'MOCK'
    `);

    await queryRunner.query(`
      UPDATE "task"
      SET
        "title" = COALESCE("title", 'Aufgabe'),
        "description" = COALESCE("description", ''),
        "type" = COALESCE("type", 'MOCK')
    `);

    await queryRunner.query(`
      ALTER TABLE "task"
        ALTER COLUMN "title" SET NOT NULL,
        ALTER COLUMN "description" SET NOT NULL,
        ALTER COLUMN "type" SET NOT NULL,
        ALTER COLUMN "title" DROP DEFAULT,
        ALTER COLUMN "description" DROP DEFAULT,
        ALTER COLUMN "type" DROP DEFAULT
    `);

    await queryRunner.query('DROP INDEX IF EXISTS "idx_task_external_task_id"');
    await queryRunner.query('ALTER TABLE "task" DROP COLUMN IF EXISTS "externalTaskId"');
  }
}

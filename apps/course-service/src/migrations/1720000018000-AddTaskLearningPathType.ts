import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskLearningPathType1720000018000 implements MigrationInterface {
  name = 'AddTaskLearningPathType1720000018000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task"
        ADD COLUMN IF NOT EXISTS "learningPathType" varchar NOT NULL DEFAULT 'STANDARD'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task"
        DROP COLUMN IF EXISTS "learningPathType"
    `);
  }
}

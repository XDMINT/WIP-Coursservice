import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditEvents1720000014000 implements MigrationInterface {
  name = 'AddAuditEvents1720000014000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventType" varchar NOT NULL,
        "actorUserId" varchar,
        "actorRole" varchar,
        "courseId" uuid,
        "courseRunId" uuid,
        "courseVersionId" uuid,
        "entityType" varchar,
        "entityId" varchar,
        "summary" text NOT NULL,
        "metadataJson" jsonb,
        "requestId" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_events_course_created"
      ON "audit_events" ("courseId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_events_run_created"
      ON "audit_events" ("courseRunId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_events_type_created"
      ON "audit_events" ("eventType", "createdAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_audit_events_type_created"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_audit_events_run_created"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_audit_events_course_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "audit_events"');
  }
}

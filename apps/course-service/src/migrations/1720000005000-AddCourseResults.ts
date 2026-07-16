import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseResults1720000005000 implements MigrationInterface {
  name = 'AddCourseResults1720000005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_result" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "courseId" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "enrollmentId" uuid NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
        "studentId" varchar NOT NULL,
        "assessmentMode" varchar NOT NULL,
        "pointsAchieved" numeric(10, 2),
        "maxPoints" numeric(10, 2),
        "percentage" numeric(5, 2),
        "manualGrade" varchar,
        "passStatus" varchar NOT NULL DEFAULT 'NOT_ASSESSED',
        "source" varchar NOT NULL,
        "comment" text,
        "gradedBy" varchar,
        "gradedAt" timestamptz,
        "sourceDetails" jsonb,
        "createdBy" varchar,
        "updatedBy" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_course_result_course_enrollment"
      ON "course_result" ("courseId", "enrollmentId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_course_result_course_student"
      ON "course_result" ("courseId", "studentId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_course_result_pass_status"
      ON "course_result" ("passStatus")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "course_result"');
  }
}

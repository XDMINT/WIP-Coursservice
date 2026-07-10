import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourseSchema1720000000000 implements MigrationInterface {
  name = 'CreateCourseSchema1720000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "external_id" varchar NOT NULL UNIQUE,
        "title" varchar NOT NULL,
        "description" text,
        "semester" varchar,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "location" varchar,
        "key_password" varchar,
        "owner_id" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "version_number" integer NOT NULL,
        "content" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enrollments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "user_id" varchar NOT NULL,
        "role" varchar NOT NULL,
        "enrolledAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_enrollments_course_user" UNIQUE ("course_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "description" text,
        "group_type" varchar NOT NULL DEFAULT 'WORKGROUP',
        "is_active" boolean NOT NULL DEFAULT true,
        "group_grade" numeric(5, 2) DEFAULT 0,
        "group_feedback" text,
        "created_by" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "updated_by" varchar
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "group_memberships" (
        "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
        "user_id" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'MEMBER',
        "joined_at" timestamptz,
        "left_at" timestamptz,
        "individual_grade" numeric(5, 2) DEFAULT 0,
        "individual_feedback" text,
        "added_by" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("group_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "learning_material" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "description" varchar NOT NULL,
        "content" varchar,
        "type" varchar NOT NULL,
        "url" varchar NOT NULL,
        "filePath" varchar,
        "isPublished" boolean NOT NULL DEFAULT false,
        "createdBy" varchar NOT NULL,
        "updatedBy" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "courseId" uuid REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assignment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "description" varchar NOT NULL,
        "type" varchar NOT NULL,
        "maxPoints" integer NOT NULL,
        "weight" integer NOT NULL,
        "dueDate" timestamptz NOT NULL,
        "isPublished" boolean NOT NULL DEFAULT false,
        "isGraded" boolean NOT NULL DEFAULT false,
        "createdBy" varchar NOT NULL,
        "updatedBy" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "courseId" uuid REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grade" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pointsAchieved" integer NOT NULL,
        "feedback" varchar NOT NULL,
        "gradedBy" varchar NOT NULL,
        "gradedAt" timestamptz NOT NULL,
        "isFinal" boolean NOT NULL DEFAULT false,
        "updatedBy" varchar NOT NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "enrollmentId" uuid REFERENCES "enrollments"("id") ON DELETE CASCADE,
        "assignmentId" uuid REFERENCES "assignment"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "description" varchar NOT NULL,
        "type" varchar NOT NULL,
        "order" integer NOT NULL,
        "prerequisiteTaskId" varchar,
        "completionCriteria" jsonb,
        "isPublished" boolean NOT NULL DEFAULT false,
        "createdBy" varchar NOT NULL,
        "updatedBy" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "courseId" uuid REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_progress" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "status" varchar NOT NULL,
        "completionPercentage" integer NOT NULL DEFAULT 0,
        "progressData" jsonb,
        "startedAt" timestamptz,
        "completedAt" timestamptz,
        "createdBy" varchar NOT NULL,
        "updatedBy" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "taskId" uuid REFERENCES "task"("id") ON DELETE CASCADE,
        "enrollmentId" uuid REFERENCES "enrollments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content_release" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "contentType" varchar NOT NULL,
        "contentId" varchar NOT NULL,
        "releaseType" varchar NOT NULL,
        "releaseDate" timestamptz,
        "releaseConditions" jsonb,
        "isActive" boolean NOT NULL DEFAULT false,
        "isReleased" boolean NOT NULL DEFAULT false,
        "releasedAt" timestamptz,
        "releasedBy" varchar,
        "createdBy" varchar NOT NULL,
        "updatedBy" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "courseId" uuid REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content_template" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "description" varchar NOT NULL,
        "templateType" varchar NOT NULL,
        "templateData" jsonb NOT NULL,
        "placeholders" jsonb,
        "isGlobal" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdBy" varchar NOT NULL,
        "updatedBy" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "courseId" uuid REFERENCES "courses"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_event" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "description" varchar NOT NULL,
        "eventType" varchar NOT NULL,
        "startTime" timestamptz NOT NULL,
        "endTime" timestamptz NOT NULL,
        "location" varchar NOT NULL,
        "onlineLink" varchar,
        "isAllDay" boolean NOT NULL DEFAULT false,
        "isRecurring" boolean NOT NULL DEFAULT false,
        "recurrencePattern" jsonb,
        "relatedContentId" varchar,
        "relatedContentType" varchar,
        "createdBy" varchar NOT NULL,
        "updatedBy" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "courseId" uuid REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_courses_owner_id" ON "courses" ("owner_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_enrollments_user_id" ON "enrollments" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_learning_material_course_id" ON "learning_material" ("courseId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_assignment_course_id" ON "assignment" ("courseId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_task_course_id" ON "task" ("courseId")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "calendar_event"');
    await queryRunner.query('DROP TABLE IF EXISTS "content_template"');
    await queryRunner.query('DROP TABLE IF EXISTS "content_release"');
    await queryRunner.query('DROP TABLE IF EXISTS "task_progress"');
    await queryRunner.query('DROP TABLE IF EXISTS "task"');
    await queryRunner.query('DROP TABLE IF EXISTS "grade"');
    await queryRunner.query('DROP TABLE IF EXISTS "assignment"');
    await queryRunner.query('DROP TABLE IF EXISTS "learning_material"');
    await queryRunner.query('DROP TABLE IF EXISTS "group_memberships"');
    await queryRunner.query('DROP TABLE IF EXISTS "groups"');
    await queryRunner.query('DROP TABLE IF EXISTS "enrollments"');
    await queryRunner.query('DROP TABLE IF EXISTS "course_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "courses"');
  }
}

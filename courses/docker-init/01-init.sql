    CREATE TABLE IF NOT EXISTS courses (
        id VARCHAR(36) PRIMARY KEY,
        external_id VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        semester VARCHAR(255) NOT NULL,
        status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );

    CREATE TABLE IF NOT EXISTS course_versions (
        id VARCHAR(36) PRIMARY KEY,
        course_id VARCHAR(36) NOT NULL,
        version_number INT NOT NULL,
        content JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT false,
        CONSTRAINT fk_course_versions_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE
        );

    CREATE TABLE IF NOT EXISTS enrollments (
        id VARCHAR(36) PRIMARY KEY,
        course_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        role ENUM('STUDENT', 'TEACHER', 'TUTOR') NOT NULL,    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_enrollments_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE
        );

    CREATE TABLE IF NOT EXISTS `groups` (
        id VARCHAR(36) PRIMARY KEY,
        course_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_groups_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE
        );

    CREATE TABLE IF NOT EXISTS group_memberships (
        group_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        PRIMARY KEY (group_id, user_id),
        CONSTRAINT fk_group_memberships_group
        FOREIGN KEY (group_id) REFERENCES `groups`(id)
        ON DELETE CASCADE
        );

    INSERT INTO courses (
        id,
        external_id,
        title,
        description,
        semester,
        status
    ) VALUES (
                 '11111111-1111-1111-1111-111111111111',
                 'COURSE-DEMO-001',
                 'Demo Kurs Web Engineering',
                 'Demo-Kurs mit TypeORM und Docker.',
                 'SoSe 2026',
                 'PUBLISHED'
             );

    INSERT INTO course_versions (
        id,
        course_id,
        version_number,
        content,
        created_by,
        is_active
    ) VALUES (
                 '22222222-2222-2222-2222-222222222222',
                 '11111111-1111-1111-1111-111111111111',
                 1,
                 CAST('{"modules":["Intro","TypeORM","Docker"],"goals":["Backend testen","DB verstehen"]}' AS JSON),
                 'demo-user-1',
                 true
             );

    INSERT INTO enrollments (
        id,
        course_id,
        user_id,
        role
    ) VALUES
          (
              '33333333-3333-3333-3333-333333333333',
              '11111111-1111-1111-1111-111111111111',
              'demo-user-1',
              'TEACHER'
          ),
          (
              '44444444-4444-4444-4444-444444444444',
              '11111111-1111-1111-1111-111111111111',
              'demo-user-2',
              'STUDENT'
          );

    INSERT INTO `groups` (
        id,
        course_id,
        name
    ) VALUES (
                 '55555555-5555-5555-5555-555555555555',
                 '11111111-1111-1111-1111-111111111111',
                 'Demo Gruppe A'
             );

    INSERT INTO group_memberships (
        group_id,
        user_id
    ) VALUES
          (
              '55555555-5555-5555-5555-555555555555',
              'demo-user-1'
          ),
          (
              '55555555-5555-5555-5555-555555555555',
              'demo-user-2'
          );
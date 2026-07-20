import { CoursePermission, hasCoursePermission } from '../courses.permissions';
import { ApiForbiddenError, ApiNotFoundError, ApiValidationError } from '../common/api-errors';
import {
  CourseCatalogItemResponseDto,
  CourseContextResponseDto,
  CourseResponseDto,
  EnrollmentResponseDto,
  mapCourseContextToDto,
  mapCourseToDto,
  mapEnrollmentToDto,
} from '../dto/course.dto';
import { AuditEventListQueryDto, AuditEventResponseDto, mapAuditEventToDto } from '../dto/audit-event.dto';
import { AuditEventType } from '../entities/audit-event.entity';
import { Course, CourseStatus } from '../entities/course.entity';
import { CourseMemberRole, Enrollment } from '../entities/enrollment.entity';

type CourseServiceFacade = any;

export class CourseCatalogService {
  [key: string]: any;

  readonly api: any;

  constructor(private readonly courseService: CourseServiceFacade) {
    this.api = new Proxy(this, {
      get: (target, property, receiver) => {
        if (property in target) {
          const value = Reflect.get(target, property, receiver);

          return typeof value === 'function' ? (value as Function).bind(receiver) : value;
        }

        const value = target.courseService?.[property as keyof CourseServiceFacade];

        return typeof value === 'function'
          ? (value as Function).bind(target.courseService)
          : value;
      },
      set: (target, property, value, receiver) => {
        if (property in target) {
          return Reflect.set(target, property, value, receiver);
        }

        target.courseService[property as keyof CourseServiceFacade] = value;

        return true;
      },
    });
  }

  async findAll(userId?: string | number): Promise<CourseResponseDto[]> {
    if (userId === undefined || userId === null) {
      const courses = await this.coursesRepository.find();
      return courses.map(mapCourseToDto);
    }

    const coursesById = new Map<string, Course>();
    const ownerId = this.toOptionalNumber(userId);

    if (ownerId !== undefined) {
      const ownedCourses = await this.coursesRepository.find({
        where: { owner_id: ownerId },
      });

      ownedCourses.forEach((course) => coursesById.set(course.id, course));
    }

    const enrollments = await this.enrollmentRepository.find({
      where: { userId: this.toUserId(userId) },
      relations: ['course', 'courseRun'],
    });

    enrollments
      .filter((enrollment) => enrollment.courseRun?.isActive === true)
      .map((enrollment) => enrollment.course)
      .filter(Boolean)
      .forEach((course) => coursesById.set(course.id, course));

    return Array.from(coursesById.values()).map(mapCourseToDto);
  }

  async getAvailableCourses(
    actorUserId?: string | number,
  ): Promise<CourseCatalogItemResponseDto[]> {
    const actorId = this.requireActorUserId(actorUserId);
    const courses = await this.coursesRepository.find({
      where: {
        status: CourseStatus.PUBLISHED,
      },
      order: {
        title: 'ASC',
      },
    });
    const enrollments = await this.enrollmentRepository.find({
      where: {
        userId: actorId,
      },
      relations: ['courseRun'],
    });
    const enrollmentByCourseId = new Map(
      enrollments
        .filter((enrollment) => enrollment.courseRun?.isActive)
        .map((enrollment) => [enrollment.courseId, enrollment]),
    );
    const ownerId = this.toOptionalNumber(actorId);
    const result: CourseCatalogItemResponseDto[] = [];

    for (const course of courses) {
      if (enrollmentByCourseId.has(course.id)) {
        continue;
      }

      if (ownerId !== undefined && course.owner_id === ownerId) {
        continue;
      }

      const currentRun = await this.getCurrentCourseRunOrCreate(course.id);

      result.push(await this.mapCourseCatalogItemWithCounts(course, null, currentRun));
    }

    return result;
  }

  async getEnrolledCourses(
    actorUserId?: string | number,
  ): Promise<CourseCatalogItemResponseDto[]> {
    const actorId = this.requireActorUserId(actorUserId);
    const coursesById = new Map<string, CourseCatalogItemResponseDto>();
    const enrollments = await this.enrollmentRepository.find({
      where: {
        userId: actorId,
      },
      relations: ['course', 'courseRun'],
    });

    const activeEnrollments = enrollments
      .filter((enrollment) => Boolean(enrollment.course))
      .filter((enrollment) => enrollment.courseRun?.isActive === true);

    for (const enrollment of activeEnrollments) {
      coursesById.set(
        enrollment.course.id,
        await this.mapCourseCatalogItemWithCounts(
          enrollment.course,
          enrollment,
          enrollment.courseRun,
        ),
      );
    }

    const ownerId = this.toOptionalNumber(actorId);

    if (ownerId !== undefined) {
      const ownedCourses = await this.coursesRepository.find({
        where: {
          owner_id: ownerId,
        },
        order: {
          title: 'ASC',
        },
      });

      for (const course of ownedCourses) {
        if (!coursesById.has(course.id)) {
          const currentRun = await this.getCurrentCourseRunOrCreate(course.id);
          const teacherEnrollment = new Enrollment();
          teacherEnrollment.courseId = course.id;
          teacherEnrollment.course = course;
          teacherEnrollment.courseRunId = currentRun.id;
          teacherEnrollment.courseRun = currentRun;
          teacherEnrollment.userId = actorId;
          teacherEnrollment.role = CourseMemberRole.TEACHER;
          coursesById.set(
            course.id,
            await this.mapCourseCatalogItemWithCounts(course, teacherEnrollment, currentRun),
          );
        }
      }
    }

    return Array.from(coursesById.values()).sort((left, right) =>
      left.title.localeCompare(right.title),
    );
  }

  async findOne(id: string | number): Promise<CourseResponseDto> {
    const course = await this.coursesRepository.findOne({
      where: { id: this.toCourseId(id) },
      relations: ['versions', 'enrollments', 'groups'],
    });

    if (!course) {
      throw new ApiNotFoundError('Course not found');
    }

    return mapCourseToDto(course);
  }

  async getUserRoleInCourse(
    courseId: string | number,
    userId: string | number,
  ): Promise<CourseMemberRole | null> {
    await this.findCourseOrThrow(courseId);
    return this.resolveCourseRole(courseId, userId);
  }

  async getCourseContext(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<CourseContextResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const course = await this.findCourseOrThrow(courseId);
    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);
    const role = await this.resolveCourseRole(courseId, actorId);

    if (!hasCoursePermission(role, CoursePermission.ReadCourseContent)) {
      throw new ApiForbiddenError(
        'You are not enrolled in this course',
        'COURSE_ACCESS_DENIED',
      );
    }

    if (role === CourseMemberRole.STUDENT && course.status !== CourseStatus.PUBLISHED) {
      throw new ApiForbiddenError(
        'Course content is not released for students',
        'COURSE_ACCESS_DENIED',
      );
    }

    const currentVersion = await this.getActiveCourseVersionForRunOrThrow(
      course.id,
      currentRun.id,
    );

    return mapCourseContextToDto(course, actorId, role, currentRun, currentVersion);
  }

  async getCourseMembers(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<EnrollmentResponseDto[]> {
    await this.assertCoursePermission(
      courseId,
      actorUserId,
      CoursePermission.ManageMembers,
    );

    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);
    const enrollments = await this.enrollmentRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: currentRun.id,
      },
    });

    return enrollments.map(mapEnrollmentToDto);
  }

  async getCourseMembersByRun(
    courseId: string | number,
    runId: string,
    actorUserId?: string | number,
  ): Promise<EnrollmentResponseDto[]> {
    const run = await this.assertCourseRunManageable(courseId, runId, actorUserId);
    const enrollments = await this.enrollmentRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
      },
    });

    return enrollments.map(mapEnrollmentToDto);
  }

  async listAuditEvents(
    courseId: string | number,
    query: AuditEventListQueryDto = {},
    actorUserId?: string | number,
  ): Promise<AuditEventResponseDto[]> {
    if (!this.auditLogService) {
      return [];
    }

    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorId,
      CoursePermission.ManageCourse,
    );

    if (query.courseRunId) {
      await this.assertCourseRunManageable(
        normalizedCourseId,
        query.courseRunId,
        actorId,
      );
    }

    const events = await this.auditLogService.listEvents({
      courseId: normalizedCourseId,
      courseRunId: query.courseRunId,
      eventType: query.eventType,
      from: this.parseAuditDate(query.from, 'from'),
      to: this.parseAuditDate(query.to, 'to'),
      limit: this.parseAuditLimit(query.limit),
    });

    return events.map(mapAuditEventToDto);
  }

  async createCourse(
    body: any,
    actorUserId?: string | number,
  ): Promise<CourseResponseDto> {
    body = body ?? {};

    const course = new Course();
    const actorId = actorUserId !== undefined ? this.toUserId(actorUserId) : undefined;
    const ownerId = this.toOptionalNumber(
      body.owner_id ?? body.ownerId ?? actorId ?? body.userId,
    );
    const status = this.normalizeCourseStatus(body.status);
    const recurrenceType = this.normalizeRecurrenceType(
      body.recurrenceType ?? body.recurrence_type,
    );

    course.external_id =
      body.external_id ?? body.externalId ?? this.createExternalCourseId();
    course.title = this.requireCourseTitle(body.title);
    course.description = body.description;
    course.semester = body.semester;
    course.recurrenceType = recurrenceType;
    course.status = status ?? CourseStatus.DRAFT;
    course.location = body.location;
    course.key_password = body.key_password ?? body.keyPassword;
    course.owner_id = ownerId;
    course.created_by = actorId ?? ownerId?.toString();
    course.updated_by = actorId ?? ownerId?.toString();

    const savedCourse = await this.coursesRepository.save(course);
    const initialRun = await this.createInitialCourseRun(savedCourse, actorId, body);
    const initialVersion = await this.createInitialContentVersionForRun(
      savedCourse,
      initialRun,
      actorId ?? savedCourse.created_by ?? 'system',
      `Initiale Inhaltsversion fuer ${initialRun.label}`,
    );

    if (ownerId !== undefined) {
      const existingEnrollment = await this.findCourseEnrollment(
        savedCourse.id,
        ownerId,
        initialRun.id,
      );

      if (!existingEnrollment) {
        const enrollment = new Enrollment();
        enrollment.courseId = savedCourse.id;
        enrollment.course = savedCourse;
        enrollment.courseRunId = initialRun.id;
        enrollment.courseRun = initialRun;
        enrollment.userId = this.toUserId(ownerId);
        enrollment.role = CourseMemberRole.TEACHER;
        enrollment.createdBy = actorId ?? this.toUserId(ownerId);
        enrollment.updatedBy = actorId ?? this.toUserId(ownerId);

        await this.enrollmentRepository.save(enrollment);
      }
    }

    await this.recordAuditEvent({
      eventType: AuditEventType.COURSE_CREATED,
      actorUserId: actorId ?? ownerId?.toString(),
      actorRole: CourseMemberRole.TEACHER,
      courseId: savedCourse.id,
      entityType: 'course',
      entityId: savedCourse.id,
      summary: `Kurs erstellt: ${savedCourse.title}`,
      metadataJson: {
        status: savedCourse.status,
        recurrenceType: savedCourse.recurrenceType,
      },
    });
    await this.recordAuditEvent({
      eventType: AuditEventType.COURSE_RUN_CREATED,
      actorUserId: actorId ?? ownerId?.toString(),
      actorRole: CourseMemberRole.TEACHER,
      courseId: savedCourse.id,
      courseRunId: initialRun.id,
      entityType: 'course_run',
      entityId: initialRun.id,
      summary: `Initialer Kursdurchlauf erstellt: ${initialRun.label}`,
      metadataJson: {
        status: initialRun.status,
        active: initialRun.isActive,
      },
    });
    await this.recordAuditEvent({
      eventType: AuditEventType.CONTENT_VERSION_CREATED,
      actorUserId: actorId ?? ownerId?.toString(),
      actorRole: CourseMemberRole.TEACHER,
      courseId: savedCourse.id,
      courseRunId: initialRun.id,
      courseVersionId: initialVersion.id,
      entityType: 'course_version',
      entityId: initialVersion.id,
      summary: `Initiale Inhaltsversion erstellt: ${initialVersion.label}`,
      metadataJson: {
        versionNumber: initialVersion.version_number,
        active: initialVersion.is_active,
      },
    });

    return mapCourseToDto(savedCourse);
  }

  async joinCourse(
    courseId: string | number,
    userId: string | number,
    key?: string,
  ): Promise<EnrollmentResponseDto> {
    return this.enrollInCourse(courseId, userId, key);
  }

  async enrollInCourse(
    courseId: string | number,
    actorUserId?: string | number,
    key?: string,
  ): Promise<EnrollmentResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const normalizedCourseId = this.toCourseId(courseId);
    const course = await this.coursesRepository.findOne({
      where: { id: normalizedCourseId },
    });

    if (!course) {
      throw new ApiNotFoundError('Course not found');
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new ApiForbiddenError(
        'Only published courses can be joined',
        'COURSE_ACCESS_DENIED',
      );
    }

    if (course.key_password && course.key_password !== key) {
      throw new ApiForbiddenError('Invalid course key', 'COURSE_ACCESS_DENIED');
    }

    const currentRun = await this.getCurrentCourseRunOrCreate(normalizedCourseId);
    const existingEnrollment = await this.findCourseEnrollment(
      normalizedCourseId,
      actorId,
      currentRun.id,
    );

    if (existingEnrollment) {
      if (existingEnrollment.role !== CourseMemberRole.STUDENT) {
        throw new ApiForbiddenError(
          'Teaching roles cannot be enrolled as students',
          'COURSE_ACCESS_DENIED',
        );
      }

      return mapEnrollmentToDto(existingEnrollment);
    }

    const ownerId = this.toOptionalNumber(actorId);

    if (ownerId !== undefined && course.owner_id === ownerId) {
      throw new ApiForbiddenError(
        'Course owners cannot be enrolled as students',
        'COURSE_ACCESS_DENIED',
      );
    }

    const enrollment = new Enrollment();
    enrollment.courseId = normalizedCourseId;
    enrollment.course = course;
    enrollment.courseRunId = currentRun.id;
    enrollment.courseRun = currentRun;
    enrollment.userId = actorId;
    enrollment.role = CourseMemberRole.STUDENT;
    enrollment.createdBy = actorId;
    enrollment.updatedBy = actorId;

    const savedEnrollment = await this.enrollmentRepository.save(enrollment);
    await this.initializeImmediateTaskProgressForEnrollment(
      normalizedCourseId,
      savedEnrollment,
      actorId,
    );
    await this.recordAuditEvent({
      eventType: AuditEventType.STUDENT_ENROLLED,
      actorUserId: actorId,
      actorRole: CourseMemberRole.STUDENT,
      courseId: normalizedCourseId,
      courseRunId: currentRun.id,
      entityType: 'enrollment',
      entityId: savedEnrollment.id,
      summary: `Student eingeschrieben: ${actorId}`,
      metadataJson: {
        studentId: actorId,
      },
    });

    return mapEnrollmentToDto(savedEnrollment);
  }

  async leaveCourse(
    courseId: string | number,
    userId?: string | number,
    actorUserId?: string | number,
  ): Promise<void> {
    if (userId === undefined || userId === null) {
      throw new ApiValidationError('User ID is required to leave a course');
    }

    const actorId = this.requireActorUserId(actorUserId ?? userId);
    const normalizedUserId = this.toUserId(userId);

    if (actorId !== normalizedUserId) {
      await this.assertCoursePermission(
        courseId,
        actorId,
        CoursePermission.ManageMembers,
      );
    }

    const result = await this.enrollmentRepository.delete({
      courseId: this.toCourseId(courseId),
      courseRunId: (await this.getCurrentCourseRunOrCreate(courseId)).id,
      userId: normalizedUserId,
    });

    if ((result.affected ?? 0) > 0) {
      await this.recordAuditEvent({
        eventType: AuditEventType.STUDENT_REMOVED,
        actorUserId: actorId,
        courseId,
        entityType: 'enrollment',
        entityId: normalizedUserId,
        summary: `Student aus Kurs entfernt: ${normalizedUserId}`,
        metadataJson: {
          studentId: normalizedUserId,
        },
      });
    }
  }

  async updateCourse(
    id: string | number,
    body: any,
    actorUserId?: string | number,
  ): Promise<CourseResponseDto> {
    body = body ?? {};
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(id, actorId, CoursePermission.ManageCourse);

    const course = await this.coursesRepository.findOne({
      where: { id: this.toCourseId(id) },
    });

    if (!course) {
      throw new ApiNotFoundError('Course not found');
    }

    const status = this.normalizeCourseStatus(body.status);
    const ownerId = this.toOptionalNumber(body.owner_id ?? body.ownerId);

    if (body.external_id !== undefined || body.externalId !== undefined) {
      course.external_id = body.external_id ?? body.externalId;
    }

    if (body.title !== undefined) {
      course.title = this.requireCourseTitle(body.title);
    }

    if (body.description !== undefined) {
      course.description = body.description;
    }

    if (body.semester !== undefined) {
      course.semester = body.semester;
    }

    if (body.recurrenceType !== undefined || body.recurrence_type !== undefined) {
      course.recurrenceType = this.normalizeRecurrenceType(
        body.recurrenceType ?? body.recurrence_type,
      );
    }

    if (status !== undefined) {
      course.status = status;
    }

    if (body.location !== undefined) {
      course.location = body.location;
    }

    if (body.key_password !== undefined || body.keyPassword !== undefined) {
      course.key_password = body.key_password ?? body.keyPassword;
    }

    if (ownerId !== undefined) {
      course.owner_id = ownerId;
    }

    course.updated_by = actorId;

    const savedCourse = await this.coursesRepository.save(course);
    await this.recordAuditEvent({
      eventType: AuditEventType.COURSE_UPDATED,
      actorUserId: actorId,
      courseId: savedCourse.id,
      entityType: 'course',
      entityId: savedCourse.id,
      summary: `Kurs aktualisiert: ${savedCourse.title}`,
      metadataJson: {
        status: savedCourse.status,
        recurrenceType: savedCourse.recurrenceType,
      },
    });

    return mapCourseToDto(savedCourse);
  }

  async changeUserRole(
    courseId: string | number,
    userId: string | number,
    role: string,
    actorUserId?: string | number,
  ): Promise<EnrollmentResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorId,
      CoursePermission.ManageMembers,
    );
    const enrollment = await this.findCourseEnrollment(
      normalizedCourseId,
      userId,
    );

    if (!enrollment) {
      throw new ApiNotFoundError('Enrollment not found');
    }

    enrollment.role = this.normalizeCourseRole(role);
    enrollment.updatedBy = actorId;

    return mapEnrollmentToDto(await this.enrollmentRepository.save(enrollment));
  }

  async removeCourse(
    id: string | number,
    actorUserId?: string | number,
  ): Promise<void> {
    await this.assertCoursePermission(id, actorUserId, CoursePermission.ManageCourse);
    const result = await this.coursesRepository.delete(this.toCourseId(id));

    if (result.affected === 0) {
      throw new ApiNotFoundError('Course not found');
    }
  }
}

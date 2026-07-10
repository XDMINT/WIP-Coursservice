/**
 * Courses Service - Business logic layer for course management
 * 
 * This service provides all the business logic for managing courses, learning materials,
 * assignments, grades, tasks, content releases, templates, groups, and calendar events.
 * It acts as the bridge between the controllers and the database repositories.
 * 
 * @module CoursesService
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, ILike, MoreThanOrEqual, Not, IsNull, In } from 'typeorm';
import { Readable } from 'stream';
import {
  LearningMaterial,
  LearningMaterialPublicationStatus,
  LearningMaterialType,
} from './entities/learning-material.entity';
import { Assignment } from './entities/assignment.entity';
import { Grade } from './entities/grade.entity';
import { Enrollment, CourseMemberRole } from './entities/enrollment.entity';
import { Task, TaskUnlockMode } from './entities/task.entity';
import {
  TaskProgress,
  TaskProgressStatus,
  TaskUnlockSource,
} from './entities/task-progress.entity';
import { ContentRelease, ReleaseType } from './entities/content-release.entity';
import { ContentTemplate } from './entities/content-template.entity';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { CalendarEvent } from './entities/calendar-event.entity';
import {
  ApiForbiddenError,
  ApiNotFoundError,
  ApiUnauthorizedError,
  ApiValidationError,
} from './common/api-errors';
import {
  CourseContextResponseDto,
  CourseResponseDto,
  EnrollmentResponseDto,
  mapCourseContextToDto,
  mapCourseToDto,
  mapEnrollmentToDto,
} from './dto/course.dto';
import {
  CoursePermission,
  hasCoursePermission,
  normalizeCourseRole,
} from './courses.permissions';
import {
  CreateExternalLearningMaterialDto,
  LearningMaterialResponseDto,
  UpdateLearningMaterialDto,
  UpdateLearningMaterialSortDto,
  mapLearningMaterialToDto,
} from './dto/learning-material.dto';
import {
  CreateLearningTaskDto,
  LearningPathResponseDto,
  LearningTaskProgressDto,
  LearningTaskResponseDto,
  ManualUnlockLearningTaskDto,
  StudentLearningTaskResponseDto,
  StudentProgressOverviewDto,
  UpdateLearningTaskDto,
  UpdateLearningTaskReleaseConfigDto,
  UpdateLearningTaskSortDto,
  mapLearningTaskToDto,
  mapLearningTaskWithProgressToDto,
  mapTaskProgressToDto,
} from './dto/learning-process.dto';
import { LocalMaterialStorage } from './storage/material-storage';

export type UploadedLearningMaterialFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

export type LearningMaterialDownload = {
  stream: Readable;
  fileName: string;
  mimeType: string;
  fileSize?: number;
};

const maxMaterialFileSizeBytes = () =>
  Number(process.env.COURSE_MATERIAL_MAX_FILE_SIZE_BYTES ?? 50 * 1024 * 1024);

export const ALLOWED_MATERIAL_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/markdown',
  'text/plain',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

/**
 * Courses Service Class
 * 
 * Main service class providing business logic for course management functionality
 */
@Injectable()
export class CoursesService {
  /**
   * Constructor with dependency injection
   * 
   * @param {Repository<Course>} coursesRepository - Course repository
   * @param {Repository<LearningMaterial>} learningMaterialRepository - Learning material repository
   * @param {Repository<Assignment>} assignmentRepository - Assignment repository
   * @param {Repository<Grade>} gradeRepository - Grade repository
   * @param {Repository<Enrollment>} enrollmentRepository - Enrollment repository
   * @param {Repository<Task>} taskRepository - Task repository
   * @param {Repository<TaskProgress>} taskProgressRepository - Task progress repository
   * @param {Repository<ContentRelease>} contentReleaseRepository - Content release repository
   * @param {Repository<ContentTemplate>} contentTemplateRepository - Content template repository
   * @param {Repository<CourseGroup>} courseGroupRepository - Course group repository
   * @param {Repository<GroupMembership>} groupMembershipRepository - Group membership repository
   * @param {Repository<CalendarEvent>} calendarEventRepository - Calendar event repository
   */
  constructor(
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    @InjectRepository(LearningMaterial)
    private learningMaterialRepository: Repository<LearningMaterial>,
    @InjectRepository(Assignment)
    private assignmentRepository: Repository<Assignment>,
    @InjectRepository(Grade)
    private gradeRepository: Repository<Grade>,
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(TaskProgress)
    private taskProgressRepository: Repository<TaskProgress>,
    @InjectRepository(ContentRelease)
    private contentReleaseRepository: Repository<ContentRelease>,
    @InjectRepository(ContentTemplate)
    private contentTemplateRepository: Repository<ContentTemplate>,
    @InjectRepository(CourseGroup)
    private courseGroupRepository: Repository<CourseGroup>,
    @InjectRepository(GroupMembership)
    private groupMembershipRepository: Repository<GroupMembership>,
    @InjectRepository(CalendarEvent)
    private calendarEventRepository: Repository<CalendarEvent>,
    private readonly materialStorage: LocalMaterialStorage,
  ) {}

  /**
   * Get hello message for testing
   * 
   * @returns {string} A simple hello message
   */
  getHello(): string {
    return 'Hello World!';
  }

  private toCourseId(id: string | number): string {
    return String(id);
  }

  private toUserId(userId: string | number): string {
    return String(userId);
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  private normalizeCourseStatus(status: unknown): CourseStatus | undefined {
    if (status === undefined || status === null || status === '') {
      return undefined;
    }

    const normalizedStatus = String(status).toUpperCase() as CourseStatus;

    if (!Object.values(CourseStatus).includes(normalizedStatus)) {
      throw new ApiValidationError('Invalid course status');
    }

    return normalizedStatus;
  }

  private normalizeCourseRole(role: string): CourseMemberRole {
    try {
      return normalizeCourseRole(role);
    } catch {
      throw new ApiValidationError('Invalid course role');
    }
  }

  private createExternalCourseId(): string {
    return `course-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private requireActorUserId(actorUserId?: string | number): string {
    if (actorUserId === undefined || actorUserId === null || actorUserId === '') {
      throw new ApiUnauthorizedError();
    }

    return this.toUserId(actorUserId);
  }

  private requireCourseTitle(title: unknown): string {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new ApiValidationError('Course title is required', ['title must not be empty']);
    }

    return title.trim();
  }

  private async findCourseOrThrow(courseId: string | number): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id: this.toCourseId(courseId) },
    });

    if (!course) {
      throw new ApiNotFoundError('Course not found');
    }

    return course;
  }

  private async resolveCourseRole(
    courseId: string | number,
    userId: string | number,
  ): Promise<CourseMemberRole | null> {
    const normalizedCourseId = this.toCourseId(courseId);
    const enrollment = await this.findCourseEnrollment(
      normalizedCourseId,
      userId,
    );

    if (enrollment) {
      return this.normalizeCourseRole(enrollment.role);
    }

    const ownerId = this.toOptionalNumber(userId);

    if (ownerId === undefined) {
      return null;
    }

    const ownedCourse = await this.coursesRepository.findOne({
      where: {
        id: normalizedCourseId,
        owner_id: ownerId,
      },
    });

    return ownedCourse ? CourseMemberRole.TEACHER : null;
  }

  private async assertCoursePermission(
    courseId: string | number,
    actorUserId: string | number | undefined,
    permission: CoursePermission,
  ): Promise<CourseMemberRole> {
    const normalizedActorId = this.requireActorUserId(actorUserId);
    const role = await this.resolveCourseRole(courseId, normalizedActorId);

    if (!hasCoursePermission(role, permission)) {
      throw new ApiForbiddenError(
        'You do not have permission to access this course resource',
        'COURSE_ACCESS_DENIED',
      );
    }

    return role;
  }

  private normalizeMaterialType(type: unknown): LearningMaterialType {
    const normalizedType = String(type ?? '').toUpperCase();

    if (normalizedType === 'LINK') {
      return LearningMaterialType.EXTERNAL_LINK;
    }

    if (
      Object.values(LearningMaterialType).includes(
        normalizedType as LearningMaterialType,
      )
    ) {
      return normalizedType as LearningMaterialType;
    }

    throw new ApiValidationError('Invalid learning material type');
  }

  private parseTags(tags: unknown): string[] {
    if (tags === undefined || tags === null || tags === '') {
      return [];
    }

    let rawTags: unknown;

    try {
      rawTags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string' && tags.trim().startsWith('[')
          ? JSON.parse(tags)
          : String(tags).split(',');
    } catch {
      throw new ApiValidationError('Tags must be valid JSON or a comma separated list');
    }

    if (!Array.isArray(rawTags)) {
      throw new ApiValidationError('Tags must be a list');
    }

    return rawTags
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .filter((tag, index, list) => list.indexOf(tag) === index);
  }

  private parsePreviewMetadata(
    previewMetadata: unknown,
  ): Record<string, unknown> | undefined {
    if (
      previewMetadata === undefined ||
      previewMetadata === null ||
      previewMetadata === ''
    ) {
      return undefined;
    }

    if (typeof previewMetadata === 'object' && !Array.isArray(previewMetadata)) {
      return previewMetadata as Record<string, unknown>;
    }

    if (typeof previewMetadata === 'string') {
      let parsed: unknown;

      try {
        parsed = JSON.parse(previewMetadata);
      } catch {
        throw new ApiValidationError('Preview metadata must be valid JSON');
      }

      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }

    throw new ApiValidationError('Preview metadata must be an object');
  }

  private parseSortOrder(sortOrder: unknown): number {
    if (sortOrder === undefined || sortOrder === null || sortOrder === '') {
      return 0;
    }

    const parsedSortOrder = Number(sortOrder);

    if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
      throw new ApiValidationError('Sort order must be a non-negative integer');
    }

    return parsedSortOrder;
  }

  private requireMaterialTitle(title: unknown): string {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new ApiValidationError('Learning material title is required', [
        'title must not be empty',
      ]);
    }

    return title.trim();
  }

  private validateExternalUrl(url: unknown): string {
    if (typeof url !== 'string' || url.trim().length === 0) {
      throw new ApiValidationError('URL is required');
    }

    try {
      const parsedUrl = new URL(url);

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Unsupported protocol');
      }

      return parsedUrl.toString();
    } catch {
      throw new ApiValidationError('External link must be a valid HTTP or HTTPS URL');
    }
  }

  private validateUploadedMaterialFile(file?: UploadedLearningMaterialFile): asserts file is UploadedLearningMaterialFile & {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  } {
    if (!file?.buffer || !file.originalname || !file.mimetype) {
      throw new ApiValidationError('A file upload is required');
    }

    if (!ALLOWED_MATERIAL_MIME_TYPES.includes(file.mimetype)) {
      throw new ApiValidationError('File type is not allowed', [
        `${file.mimetype} is not allowed`,
      ]);
    }

    if (file.size > maxMaterialFileSizeBytes()) {
      throw new ApiValidationError('File is too large', [
        `maximum size is ${maxMaterialFileSizeBytes()} bytes`,
      ]);
    }
  }

  private async findLearningMaterialOrThrow(
    materialId: string,
  ): Promise<LearningMaterial> {
    const material = await this.learningMaterialRepository.findOne({
      where: { id: materialId },
    });

    if (!material || material.publicationStatus === LearningMaterialPublicationStatus.ARCHIVED) {
      throw new ApiNotFoundError(
        'Learning material not found',
        'MATERIAL_NOT_FOUND',
      );
    }

    return material;
  }

  private async assertLearningMaterialReadable(
    material: LearningMaterial,
    actorUserId?: string | number,
  ): Promise<CourseMemberRole> {
    const role = await this.assertCoursePermission(
      material.courseId,
      actorUserId,
      CoursePermission.ReadCourseContent,
    );

    if (
      !hasCoursePermission(role, CoursePermission.ManageCourseContent) &&
      material.publicationStatus !== LearningMaterialPublicationStatus.PUBLISHED
    ) {
      throw new ApiForbiddenError(
        'Learning material is not published',
        'MATERIAL_ACCESS_DENIED',
      );
    }

    return role;
  }

  private async assertLearningMaterialManageable(
    material: LearningMaterial,
    actorUserId?: string | number,
  ): Promise<void> {
    await this.assertCoursePermission(
      material.courseId,
      actorUserId,
      CoursePermission.ManageCourseContent,
    );
  }

  private async findCourseEnrollment(
    courseId: string,
    userId: string | number,
  ): Promise<Enrollment | null> {
    return this.enrollmentRepository.findOne({
      where: {
        courseId,
        userId: this.toUserId(userId),
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
      relations: ['course'],
    });

    enrollments
      .map((enrollment) => enrollment.course)
      .filter(Boolean)
      .forEach((course) => coursesById.set(course.id, course));

    return Array.from(coursesById.values()).map(mapCourseToDto);
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

    return mapCourseContextToDto(course, actorId, role);
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

    const enrollments = await this.enrollmentRepository.find({
      where: { courseId: this.toCourseId(courseId) },
    });

    return enrollments.map(mapEnrollmentToDto);
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

    course.external_id =
      body.external_id ?? body.externalId ?? this.createExternalCourseId();
    course.title = this.requireCourseTitle(body.title);
    course.description = body.description;
    course.semester = body.semester;
    course.status = status ?? CourseStatus.DRAFT;
    course.location = body.location;
    course.key_password = body.key_password ?? body.keyPassword;
    course.owner_id = ownerId;
    course.created_by = actorId ?? ownerId?.toString();
    course.updated_by = actorId ?? ownerId?.toString();

    const savedCourse = await this.coursesRepository.save(course);

    if (ownerId !== undefined) {
      const existingEnrollment = await this.findCourseEnrollment(
        savedCourse.id,
        ownerId,
      );

      if (!existingEnrollment) {
        const enrollment = new Enrollment();
        enrollment.courseId = savedCourse.id;
        enrollment.course = savedCourse;
        enrollment.userId = this.toUserId(ownerId);
        enrollment.role = CourseMemberRole.TEACHER;
        enrollment.createdBy = actorId ?? this.toUserId(ownerId);
        enrollment.updatedBy = actorId ?? this.toUserId(ownerId);

        await this.enrollmentRepository.save(enrollment);
      }
    }

    return mapCourseToDto(savedCourse);
  }

  async joinCourse(
    courseId: string | number,
    userId: string | number,
    key?: string,
  ): Promise<EnrollmentResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const course = await this.coursesRepository.findOne({
      where: { id: normalizedCourseId },
    });

    if (!course) {
      throw new ApiNotFoundError('Course not found');
    }

    if (course.key_password && course.key_password !== key) {
      throw new ApiForbiddenError('Invalid course key', 'COURSE_ACCESS_DENIED');
    }

    const existingEnrollment = await this.findCourseEnrollment(
      normalizedCourseId,
      userId,
    );

    if (existingEnrollment) {
      return mapEnrollmentToDto(existingEnrollment);
    }

    const enrollment = new Enrollment();
    enrollment.courseId = normalizedCourseId;
    enrollment.course = course;
    enrollment.userId = this.toUserId(userId);
    enrollment.role = CourseMemberRole.STUDENT;
    enrollment.createdBy = this.toUserId(userId);
    enrollment.updatedBy = this.toUserId(userId);

    return mapEnrollmentToDto(await this.enrollmentRepository.save(enrollment));
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

    await this.enrollmentRepository.delete({
      courseId: this.toCourseId(courseId),
      userId: normalizedUserId,
    });
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

    return mapCourseToDto(await this.coursesRepository.save(course));
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

  /**
   * Create a new learning material for a course
   * 
   * @param {string} courseId - ID of the course to add the material to
   * @param {string} title - Title of the learning material
   * @param {string} description - Description of the material
   * @param {string} type - Type of material (e.g., 'PRESENTATION', 'DOCUMENT')
   * @param {string} url - URL to access the material
   * @param {string} filePath - File path for uploaded materials
   * @param {string} createdBy - User ID of the creator
   * @returns {Promise<LearningMaterial>} The created learning material
   */
  async createLearningMaterial(
    courseId: string,
    title: string,
    description: string,
    type: string,
    url: string,
    filePath: string,
    createdBy: string,
  ): Promise<LearningMaterial> {
    const material = new LearningMaterial();
    material.title = this.requireMaterialTitle(title);
    material.description = description;
    material.type = this.normalizeMaterialType(type);
    material.url = url;
    material.filePath = filePath;
    material.createdBy = createdBy;
    material.updatedBy = createdBy;
    material.courseId = this.toCourseId(courseId);
    material.isPublished = false;
    material.publicationStatus = LearningMaterialPublicationStatus.DRAFT;
    material.tags = [];
    material.sortOrder = 0;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    material.course = course;

    return this.learningMaterialRepository.save(material);
  }

  async createLearningMaterialFile(
    courseId: string,
    body: CreateExternalLearningMaterialDto,
    file: UploadedLearningMaterialFile | undefined,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );
    this.validateUploadedMaterialFile(file);

    const materialType = this.normalizeMaterialType(
      body.type ?? LearningMaterialType.OTHER_FILE,
    );

    if (materialType === LearningMaterialType.EXTERNAL_LINK) {
      throw new ApiValidationError('Uploaded files cannot use EXTERNAL_LINK type');
    }

    const storedFile = await this.materialStorage.saveFile(
      this.toCourseId(courseId),
      file.originalname,
      file.buffer,
    );
    const material = new LearningMaterial();
    material.courseId = this.toCourseId(courseId);
    material.title = this.requireMaterialTitle(body.title);
    material.description = body.description;
    material.type = materialType;
    material.originalFileName = storedFile.safeFileName;
    material.storageKey = storedFile.storageKey;
    material.filePath = storedFile.storageKey;
    material.mimeType = file.mimetype;
    material.fileSize = file.size;
    material.previewMetadata = this.parsePreviewMetadata(body.previewMetadata);
    material.tags = this.parseTags(body.tags);
    material.sortOrder = this.parseSortOrder(body.sortOrder);
    material.publicationStatus = LearningMaterialPublicationStatus.DRAFT;
    material.isPublished = false;
    material.createdBy = actorId;
    material.updatedBy = actorId;

    return mapLearningMaterialToDto(
      await this.learningMaterialRepository.save(material),
    );
  }

  async createExternalLearningMaterial(
    courseId: string,
    body: CreateExternalLearningMaterialDto,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );

    const material = new LearningMaterial();
    material.courseId = this.toCourseId(courseId);
    material.title = this.requireMaterialTitle(body.title);
    material.description = body.description;
    material.type = LearningMaterialType.EXTERNAL_LINK;
    material.url = this.validateExternalUrl(body.url);
    material.previewMetadata = this.parsePreviewMetadata(body.previewMetadata);
    material.tags = this.parseTags(body.tags);
    material.sortOrder = this.parseSortOrder(body.sortOrder);
    material.publicationStatus = LearningMaterialPublicationStatus.DRAFT;
    material.isPublished = false;
    material.createdBy = actorId;
    material.updatedBy = actorId;

    return mapLearningMaterialToDto(
      await this.learningMaterialRepository.save(material),
    );
  }

  async getLearningMaterialsByCourse(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto[]> {
    const role = await this.assertCoursePermission(
      courseId,
      actorUserId,
      CoursePermission.ReadCourseContent,
    );
    const canManage = hasCoursePermission(role, CoursePermission.ManageCourseContent);
    const materials = await this.learningMaterialRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        publicationStatus: canManage
          ? Not(LearningMaterialPublicationStatus.ARCHIVED)
          : LearningMaterialPublicationStatus.PUBLISHED,
      },
      order: {
        sortOrder: 'ASC',
        createdAt: 'DESC',
      },
    });

    return materials.map(mapLearningMaterialToDto);
  }

  async getLearningMaterialById(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const material = await this.findLearningMaterialOrThrow(id);

    await this.assertLearningMaterialReadable(material, actorUserId);

    return mapLearningMaterialToDto(material);
  }

  async updateLearningMaterialMetadata(
    id: string,
    body: UpdateLearningMaterialDto,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const material = await this.findLearningMaterialOrThrow(id);

    await this.assertLearningMaterialManageable(material, actorId);

    if (body.title !== undefined) {
      material.title = this.requireMaterialTitle(body.title);
    }

    if (body.description !== undefined) {
      material.description = body.description;
    }

    if (body.type !== undefined) {
      const materialType = this.normalizeMaterialType(body.type);

      if (
        material.storageKey &&
        materialType === LearningMaterialType.EXTERNAL_LINK
      ) {
        throw new ApiValidationError('Uploaded files cannot be converted to external links');
      }

      if (
        !material.storageKey &&
        materialType !== LearningMaterialType.EXTERNAL_LINK
      ) {
        throw new ApiValidationError('External links cannot be converted to uploaded files');
      }

      material.type = materialType;
    }

    if (body.url !== undefined) {
      if (material.type !== LearningMaterialType.EXTERNAL_LINK) {
        throw new ApiValidationError('Only external links can have a URL');
      }

      material.url = this.validateExternalUrl(body.url);
    }

    if (body.previewMetadata !== undefined) {
      material.previewMetadata = this.parsePreviewMetadata(body.previewMetadata);
    }

    if (body.tags !== undefined) {
      material.tags = this.parseTags(body.tags);
    }

    if (body.sortOrder !== undefined) {
      material.sortOrder = this.parseSortOrder(body.sortOrder);
    }

    material.updatedBy = actorId;

    return mapLearningMaterialToDto(
      await this.learningMaterialRepository.save(material),
    );
  }

  async updateLearningMaterialSortOrder(
    courseId: string,
    body: UpdateLearningMaterialSortDto,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto[]> {
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );

    if (!Array.isArray(body.items)) {
      throw new ApiValidationError('Sort items are required');
    }

    const materialIds = body.items
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const materials = await this.learningMaterialRepository.find({
      where: {
        id: In(materialIds),
        courseId: this.toCourseId(courseId),
        publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
      },
    });
    const materialById = new Map(materials.map((material) => [material.id, material]));

    for (const item of body.items) {
      if (!item.id || !materialById.has(item.id)) {
        throw new ApiValidationError('Sort list contains an unknown material');
      }

      const material = materialById.get(item.id);
      material.sortOrder = this.parseSortOrder(item.sortOrder);
      material.updatedBy = actorId;
    }

    return (await this.learningMaterialRepository.save(materials))
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(mapLearningMaterialToDto);
  }

  async deleteLearningMaterial(
    id: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const actorId = this.requireActorUserId(actorUserId);
    const material = await this.findLearningMaterialOrThrow(id);

    await this.assertLearningMaterialManageable(material, actorId);

    material.publicationStatus = LearningMaterialPublicationStatus.ARCHIVED;
    material.isPublished = false;
    material.archivedAt = new Date();
    material.updatedBy = actorId;

    await this.learningMaterialRepository.save(material);
  }

  async publishLearningMaterial(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const material = await this.findLearningMaterialOrThrow(id);

    await this.assertLearningMaterialManageable(material, actorId);

    material.isPublished = true;
    material.publicationStatus = LearningMaterialPublicationStatus.PUBLISHED;
    material.publishedAt = new Date();
    material.updatedBy = actorId;

    return mapLearningMaterialToDto(
      await this.learningMaterialRepository.save(material),
    );
  }

  async unpublishLearningMaterial(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const material = await this.findLearningMaterialOrThrow(id);

    await this.assertLearningMaterialManageable(material, actorId);

    material.isPublished = false;
    material.publicationStatus = LearningMaterialPublicationStatus.DRAFT;
    material.updatedBy = actorId;

    return mapLearningMaterialToDto(
      await this.learningMaterialRepository.save(material),
    );
  }

  async downloadLearningMaterial(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialDownload> {
    const material = await this.findLearningMaterialOrThrow(id);

    await this.assertLearningMaterialReadable(material, actorUserId);

    if (!material.storageKey) {
      throw new ApiValidationError('External links do not have downloadable files');
    }

    const file = this.materialStorage.openFile(material.courseId, material.storageKey);

    return {
      stream: file.stream,
      fileName: material.originalFileName ?? 'learning-material',
      mimeType: material.mimeType ?? 'application/octet-stream',
      fileSize:
        material.fileSize === undefined || material.fileSize === null
          ? undefined
          : Number(material.fileSize),
    };
  }

  // Assignment methods
  async createAssignment(
    courseId: string,
    title: string,
    description: string,
    type: string,
    maxPoints: number,
    weight: number,
    dueDate: Date,
    createdBy: string,
  ): Promise<Assignment> {
    const assignment = new Assignment();
    assignment.title = title;
    assignment.description = description;
    assignment.type = type;
    assignment.maxPoints = maxPoints;
    assignment.weight = weight;
    assignment.dueDate = dueDate;
    assignment.createdBy = createdBy;
    assignment.updatedBy = createdBy;
    assignment.isPublished = false;
    assignment.isGraded = false;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    assignment.course = course;

    return this.assignmentRepository.save(assignment);
  }

  async getAssignmentsByCourse(courseId: string): Promise<Assignment[]> {
    return this.assignmentRepository.find({
      where: { course: { id: courseId } },
      relations: ['grades'],
    });
  }

  async getAssignmentById(id: string): Promise<Assignment> {
    return this.assignmentRepository.findOne({
      where: { id },
      relations: ['grades'],
    });
  }

  async updateAssignment(
    id: string,
    title: string,
    description: string,
    type: string,
    maxPoints: number,
    weight: number,
    dueDate: Date,
    isPublished: boolean,
    isGraded: boolean,
    updatedBy: string,
  ): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    assignment.title = title;
    assignment.description = description;
    assignment.type = type;
    assignment.maxPoints = maxPoints;
    assignment.weight = weight;
    assignment.dueDate = dueDate;
    assignment.isPublished = isPublished;
    assignment.isGraded = isGraded;
    assignment.updatedBy = updatedBy;

    return this.assignmentRepository.save(assignment);
  }

  async deleteAssignment(id: string): Promise<void> {
    await this.assignmentRepository.delete(id);
  }

  async publishAssignment(id: string, updatedBy: string): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    assignment.isPublished = true;
    assignment.updatedBy = updatedBy;

    return this.assignmentRepository.save(assignment);
  }

  async unpublishAssignment(id: string, updatedBy: string): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    assignment.isPublished = false;
    assignment.updatedBy = updatedBy;

    return this.assignmentRepository.save(assignment);
  }

  // Grade methods
  async createGrade(
    assignmentId: string,
    enrollmentId: string,
    pointsAchieved: number,
    feedback: string,
    gradedBy: string,
    isFinal: boolean,
  ): Promise<Grade> {
    const grade = new Grade();
    grade.pointsAchieved = pointsAchieved;
    grade.feedback = feedback;
    grade.gradedBy = gradedBy;
    grade.gradedAt = new Date();
    grade.isFinal = isFinal;
    grade.updatedBy = gradedBy;

    // Set the assignment relation
    const assignment = new Assignment();
    assignment.id = assignmentId;
    grade.assignment = assignment;

    // Set the enrollment relation
    const enrollment = new Enrollment();
    enrollment.id = enrollmentId;
    grade.enrollment = enrollment;

    return this.gradeRepository.save(grade);
  }

  async getGradesByAssignment(assignmentId: string): Promise<Grade[]> {
    return this.gradeRepository.find({
      where: { assignment: { id: assignmentId } },
      relations: ['enrollment', 'assignment'],
    });
  }

  async getGradesByEnrollment(enrollmentId: string): Promise<Grade[]> {
    return this.gradeRepository.find({
      where: { enrollment: { id: enrollmentId } },
      relations: ['assignment'],
    });
  }

  async getGradeById(id: string): Promise<Grade> {
    return this.gradeRepository.findOne({
      where: { id },
      relations: ['enrollment', 'assignment'],
    });
  }

  async updateGrade(
    id: string,
    pointsAchieved: number,
    feedback: string,
    gradedBy: string,
    isFinal: boolean,
    updatedBy: string,
  ): Promise<Grade> {
    const grade = await this.gradeRepository.findOne({
      where: { id },
    });

    if (!grade) {
      throw new Error('Grade not found');
    }

    grade.pointsAchieved = pointsAchieved;
    grade.feedback = feedback;
    grade.gradedBy = gradedBy;
    grade.gradedAt = new Date();
    grade.isFinal = isFinal;
    grade.updatedBy = updatedBy;

    return this.gradeRepository.save(grade);
  }

  async deleteGrade(id: string): Promise<void> {
    await this.gradeRepository.delete(id);
  }

  async calculateCourseGrade(courseId: string, enrollmentId: string): Promise<{ grade: number; passed: boolean }> {
    // Get all assignments for the course
    const assignments = await this.assignmentRepository.find({
      where: { course: { id: courseId }, isGraded: true },
    });

    if (assignments.length === 0) {
      throw new Error('No graded assignments found for this course');
    }

    // Get all grades for the enrollment
    const grades = await this.gradeRepository.find({
      where: { enrollment: { id: enrollmentId } },
      relations: ['assignment'],
    });

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const assignment of assignments) {
      const grade = grades.find(g => g.assignment.id === assignment.id);
      
      if (grade && grade.isFinal) {
        const percentage = grade.pointsAchieved / assignment.maxPoints;
        totalWeightedScore += percentage * assignment.weight;
        totalWeight += assignment.weight;
      }
    }

    if (totalWeight === 0) {
      throw new Error('No valid grades found for calculation');
    }

    const finalGrade = totalWeightedScore / totalWeight;
    const passed = finalGrade >= 0.5; // 50% or more is passing

    return { grade: finalGrade, passed };
  }

  async getCoursePerformance(courseId: string): Promise<any> {
    // Get all enrollments for the course
    const enrollments = await this.enrollmentRepository.find({
      where: { courseId: courseId },
    });

    const performanceData = [];

    for (const enrollment of enrollments) {
      try {
        const result = await this.calculateCourseGrade(courseId, enrollment.id);
        performanceData.push({
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          grade: result.grade,
          passed: result.passed,
        });
      } catch (error) {
        performanceData.push({
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          grade: null,
          passed: false,
          error: error.message,
        });
      }
    }

    return performanceData;
  }

  // Task and learning process methods
  private normalizeTaskUnlockMode(
    unlockMode: unknown,
    defaultMode = TaskUnlockMode.IMMEDIATE,
  ): TaskUnlockMode {
    if (unlockMode === undefined || unlockMode === null || unlockMode === '') {
      return defaultMode;
    }

    const normalizedMode = String(unlockMode).toUpperCase() as TaskUnlockMode;

    if (!Object.values(TaskUnlockMode).includes(normalizedMode)) {
      throw new ApiValidationError('Invalid task unlock mode');
    }

    return normalizedMode;
  }

  private parseTaskOrder(order: unknown): number {
    if (order === undefined || order === null || order === '') {
      return 0;
    }

    const parsedOrder = Number(order);

    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      throw new ApiValidationError('Task order must be a non-negative integer');
    }

    return parsedOrder;
  }

  private requireTaskTitle(title: unknown): string {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new ApiValidationError('Task title is required', [
        'title must not be empty',
      ]);
    }

    return title.trim();
  }

  private normalizeTaskPrerequisite(
    prerequisiteTaskId: unknown,
  ): string | undefined {
    if (
      prerequisiteTaskId === undefined ||
      prerequisiteTaskId === null ||
      prerequisiteTaskId === ''
    ) {
      return undefined;
    }

    return String(prerequisiteTaskId);
  }

  private async findLearningTaskOrThrow(taskId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new ApiNotFoundError('Task not found', 'TASK_NOT_FOUND');
    }

    return task;
  }

  private async assertTaskReadable(
    task: Task,
    actorUserId?: string | number,
  ): Promise<CourseMemberRole> {
    const role = await this.assertCoursePermission(
      task.courseId,
      actorUserId,
      CoursePermission.ReadCourseContent,
    );

    if (
      !hasCoursePermission(role, CoursePermission.ManageCourseContent) &&
      !task.isPublished
    ) {
      throw new ApiForbiddenError('Task is not published', 'TASK_ACCESS_DENIED');
    }

    return role;
  }

  private async assertTaskManageable(
    task: Task,
    actorUserId?: string | number,
  ): Promise<void> {
    await this.assertCoursePermission(
      task.courseId,
      actorUserId,
      CoursePermission.ManageCourseContent,
    );
  }

  private async findStudentEnrollmentOrThrow(
    courseId: string,
    studentId: string | number,
  ): Promise<Enrollment> {
    const enrollment = await this.findCourseEnrollment(courseId, studentId);

    if (!enrollment || enrollment.role !== CourseMemberRole.STUDENT) {
      throw new ApiForbiddenError(
        'Student is not enrolled in this course',
        'COURSE_ACCESS_DENIED',
      );
    }

    return enrollment;
  }

  private async assertCurrentStudentEnrollment(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<Enrollment> {
    const actorId = this.requireActorUserId(actorUserId);
    const enrollment = await this.findStudentEnrollmentOrThrow(courseId, actorId);

    return enrollment;
  }

  private async validateTaskConfiguration(
    courseId: string,
    taskId: string | undefined,
    unlockMode: TaskUnlockMode,
    prerequisiteTaskId?: string,
  ): Promise<void> {
    if (unlockMode === TaskUnlockMode.IMMEDIATE && prerequisiteTaskId) {
      throw new ApiValidationError('Immediately available tasks cannot define a prerequisite');
    }

    if (unlockMode === TaskUnlockMode.AUTOMATIC && !prerequisiteTaskId) {
      throw new ApiValidationError('Automatically unlocked tasks require a prerequisite');
    }

    if (!prerequisiteTaskId) {
      return;
    }

    if (taskId && prerequisiteTaskId === taskId) {
      throw new ApiValidationError('A task cannot depend on itself');
    }

    const prerequisite = await this.taskRepository.findOne({
      where: { id: prerequisiteTaskId },
    });

    if (!prerequisite || prerequisite.courseId !== courseId) {
      throw new ApiValidationError('Prerequisite task must belong to the same course');
    }

    const visitedTaskIds = new Set<string>();
    let currentTaskId: string | undefined = prerequisiteTaskId;

    while (currentTaskId) {
      if (taskId && currentTaskId === taskId) {
        throw new ApiValidationError('Cyclic task prerequisites are not allowed');
      }

      if (visitedTaskIds.has(currentTaskId)) {
        throw new ApiValidationError('Cyclic task prerequisites are not allowed');
      }

      visitedTaskIds.add(currentTaskId);

      const currentTask = await this.taskRepository.findOne({
        where: { id: currentTaskId },
      });

      if (!currentTask) {
        return;
      }

      if (currentTask.courseId !== courseId) {
        throw new ApiValidationError('Prerequisite task must belong to the same course');
      }

      currentTaskId = currentTask.prerequisiteTaskId;
    }
  }

  private async isTaskPrerequisiteCompleted(
    task: Task,
    enrollmentId: string,
  ): Promise<boolean> {
    if (!task.prerequisiteTaskId) {
      return false;
    }

    const prerequisiteProgress = await this.taskProgressRepository.findOne({
      where: {
        taskId: task.prerequisiteTaskId,
        enrollmentId,
      },
    });

    return prerequisiteProgress?.status === TaskProgressStatus.COMPLETED;
  }

  private async isTaskEligibleByRules(
    task: Task,
    enrollmentId: string,
  ): Promise<boolean> {
    if (task.unlockMode === TaskUnlockMode.IMMEDIATE) {
      return true;
    }

    if (task.unlockMode === TaskUnlockMode.AUTOMATIC) {
      return this.isTaskPrerequisiteCompleted(task, enrollmentId);
    }

    return false;
  }

  private isMutableAvailableProgress(progress: TaskProgress): boolean {
    return progress.status === TaskProgressStatus.AVAILABLE;
  }

  private assignTaskProgressRelations(
    progress: TaskProgress,
    task: Task,
    enrollment: Enrollment,
  ): void {
    progress.task = task;
    progress.taskId = task.id;
    progress.enrollment = enrollment;
    progress.enrollmentId = enrollment.id;
  }

  private async findTaskProgress(
    taskId: string,
    enrollmentId: string,
  ): Promise<TaskProgress | null> {
    return this.taskProgressRepository.findOne({
      where: {
        taskId,
        enrollmentId,
      },
    });
  }

  private async createLockedTaskProgress(
    task: Task,
    enrollment: Enrollment,
    createdBy: string,
  ): Promise<TaskProgress> {
    const progress = new TaskProgress();
    progress.status = TaskProgressStatus.LOCKED;
    progress.completionPercentage = 0;
    progress.progressData = {};
    progress.createdBy = createdBy;
    progress.updatedBy = createdBy;
    this.assignTaskProgressRelations(progress, task, enrollment);

    return this.taskProgressRepository.save(progress);
  }

  private async ensureTaskProgress(
    task: Task,
    enrollment: Enrollment,
    updatedBy = 'system',
  ): Promise<TaskProgress> {
    let progress = await this.findTaskProgress(task.id, enrollment.id);

    if (!progress) {
      progress = await this.createLockedTaskProgress(task, enrollment, updatedBy);
    } else {
      this.assignTaskProgressRelations(progress, task, enrollment);
    }

    const eligibleByRules = await this.isTaskEligibleByRules(task, enrollment.id);

    if (progress.status === TaskProgressStatus.LOCKED && eligibleByRules) {
      progress.status = TaskProgressStatus.AVAILABLE;
      progress.completionPercentage = 0;
      progress.unlockedAt = progress.unlockedAt ?? new Date();
      progress.unlockSource =
        task.unlockMode === TaskUnlockMode.AUTOMATIC
          ? TaskUnlockSource.AUTOMATIC
          : TaskUnlockSource.IMMEDIATE;
      progress.updatedBy = updatedBy;

      return this.taskProgressRepository.save(progress);
    }

    if (
      this.isMutableAvailableProgress(progress) &&
      task.unlockMode === TaskUnlockMode.MANUAL &&
      progress.unlockSource !== TaskUnlockSource.MANUAL
    ) {
      progress.status = TaskProgressStatus.LOCKED;
      progress.completionPercentage = 0;
      progress.unlockedAt = undefined;
      progress.unlockSource = undefined;
      progress.updatedBy = updatedBy;

      return this.taskProgressRepository.save(progress);
    }

    if (
      this.isMutableAvailableProgress(progress) &&
      task.unlockMode !== TaskUnlockMode.MANUAL &&
      !eligibleByRules
    ) {
      progress.status = TaskProgressStatus.LOCKED;
      progress.completionPercentage = 0;
      progress.unlockedAt = undefined;
      progress.unlockSource = undefined;
      progress.updatedBy = updatedBy;

      return this.taskProgressRepository.save(progress);
    }

    return progress;
  }

  private async getTaskLockedReason(
    task: Task,
    progress: TaskProgress | null,
    tasksById: Map<string, Task>,
  ): Promise<string | undefined> {
    if (progress && progress.status !== TaskProgressStatus.LOCKED) {
      return undefined;
    }

    if (task.unlockMode === TaskUnlockMode.MANUAL) {
      return 'Diese Aufgabe muss durch eine Lehrperson freigeschaltet werden.';
    }

    if (task.unlockMode === TaskUnlockMode.AUTOMATIC && task.prerequisiteTaskId) {
      const prerequisite =
        tasksById.get(task.prerequisiteTaskId) ??
        (await this.taskRepository.findOne({
          where: { id: task.prerequisiteTaskId },
        }));
      const title = prerequisite?.title ?? 'die vorherige Aufgabe';

      return `Diese Aufgabe wird freigeschaltet, sobald "${title}" erfolgreich abgeschlossen wurde.`;
    }

    return undefined;
  }

  private countTaskProgress(
    tasks: StudentLearningTaskResponseDto[],
  ): Omit<LearningPathResponseDto, 'courseId' | 'studentId' | 'tasks'> {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (task) => task.status === TaskProgressStatus.COMPLETED,
    ).length;
    const inProgressTasks = tasks.filter(
      (task) => task.status === TaskProgressStatus.IN_PROGRESS,
    ).length;
    const availableTasks = tasks.filter(
      (task) => task.status === TaskProgressStatus.AVAILABLE,
    ).length;
    const failedTasks = tasks.filter(
      (task) => task.status === TaskProgressStatus.FAILED,
    ).length;
    const lockedTasks = tasks.filter(
      (task) => task.status === TaskProgressStatus.LOCKED,
    ).length;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      availableTasks,
      failedTasks,
      lockedTasks,
      progressPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }

  private async buildLearningPathForEnrollment(
    courseId: string,
    enrollment: Enrollment,
    includeUnpublished = false,
  ): Promise<LearningPathResponseDto> {
    const tasks = await this.taskRepository.find({
      where: { courseId },
      order: { order: 'ASC' },
    });
    const visibleTasks = includeUnpublished
      ? tasks
      : tasks.filter((task) => task.isPublished);
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const taskDtos: StudentLearningTaskResponseDto[] = [];

    for (const task of visibleTasks) {
      const progress = await this.ensureTaskProgress(task, enrollment);
      const lockedReason = await this.getTaskLockedReason(
        task,
        progress,
        tasksById,
      );

      taskDtos.push(mapLearningTaskWithProgressToDto(task, progress, lockedReason));
    }

    return {
      courseId,
      studentId: enrollment.userId,
      ...this.countTaskProgress(taskDtos),
      tasks: taskDtos,
    };
  }

  private async buildStudentProgressOverview(
    courseId: string,
    enrollment: Enrollment,
  ): Promise<StudentProgressOverviewDto> {
    const learningPath = await this.buildLearningPathForEnrollment(
      courseId,
      enrollment,
      true,
    );
    const tasks: LearningTaskProgressDto[] = learningPath.tasks.map((task) =>
      mapTaskProgressToDto(task as unknown as Task, {
        status: task.status,
        completionPercentage: task.completionPercentage,
        unlockedAt: task.unlockedAt ? new Date(task.unlockedAt) : undefined,
        startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        resultPassed: task.resultPassed,
        unlockSource: task.unlockSource,
      } as TaskProgress),
    );

    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.userId,
      totalTasks: learningPath.totalTasks,
      completedTasks: learningPath.completedTasks,
      inProgressTasks: learningPath.inProgressTasks,
      availableTasks: learningPath.availableTasks,
      failedTasks: learningPath.failedTasks,
      lockedTasks: learningPath.lockedTasks,
      progressPercentage: learningPath.progressPercentage,
      tasks,
    };
  }

  private async reconcileTaskProgressAfterConfigurationChange(
    task: Task,
  ): Promise<void> {
    const progressList = await this.taskProgressRepository.find({
      where: { taskId: task.id },
      relations: ['enrollment'],
    });

    for (const progress of progressList) {
      const enrollment = progress.enrollment;

      if (!enrollment) {
        continue;
      }

      await this.ensureTaskProgress(task, enrollment);
    }
  }

  private async unlockEligibleNextTasks(
    completedTask: Task,
    enrollment: Enrollment,
  ): Promise<void> {
    const nextTasks = await this.taskRepository.find({
      where: {
        courseId: completedTask.courseId,
        prerequisiteTaskId: completedTask.id,
        unlockMode: TaskUnlockMode.AUTOMATIC,
      },
      order: { order: 'ASC' },
    });

    for (const nextTask of nextTasks) {
      if (!nextTask.isPublished) {
        continue;
      }

      await this.ensureTaskProgress(nextTask, enrollment);
    }
  }

  async createLearningTask(
    courseId: string | number,
    body: CreateLearningTaskDto,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );
    await this.findCourseOrThrow(normalizedCourseId);

    const unlockMode = this.normalizeTaskUnlockMode(body?.unlockMode);
    const prerequisiteTaskId = this.normalizeTaskPrerequisite(
      body?.prerequisiteTaskId,
    );

    await this.validateTaskConfiguration(
      normalizedCourseId,
      undefined,
      unlockMode,
      prerequisiteTaskId,
    );

    const task = new Task();
    task.courseId = normalizedCourseId;
    task.course = { id: normalizedCourseId } as Course;
    task.title = this.requireTaskTitle(body?.title);
    task.description = String(body?.description ?? '').trim();
    task.type = String(body?.type ?? 'DEMO_TASK').trim() || 'DEMO_TASK';
    task.order = this.parseTaskOrder(body?.order);
    task.unlockMode = unlockMode;
    task.prerequisiteTaskId = prerequisiteTaskId;
    task.completionCriteria = body?.completionCriteria ?? {};
    task.isPublished = body?.isPublished === true;
    task.createdBy = actorId;
    task.updatedBy = actorId;

    return mapLearningTaskToDto(await this.taskRepository.save(task));
  }

  async getTasksByCourse(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const role = await this.assertCoursePermission(
      normalizedCourseId,
      actorUserId,
      CoursePermission.ReadCourseContent,
    );
    const canManage = hasCoursePermission(role, CoursePermission.ManageCourseContent);
    const tasks = await this.taskRepository.find({
      where: { courseId: normalizedCourseId },
      order: { order: 'ASC' },
    });

    return tasks
      .filter((task) => canManage || task.isPublished)
      .map(mapLearningTaskToDto);
  }

  async getTaskById(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    const task = await this.findLearningTaskOrThrow(id);
    await this.assertTaskReadable(task, actorUserId);

    return mapLearningTaskToDto(task);
  }

  async updateLearningTask(
    id: string,
    body: UpdateLearningTaskDto,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const task = await this.findLearningTaskOrThrow(id);
    await this.assertTaskManageable(task, actorId);

    const unlockMode =
      body.unlockMode !== undefined
        ? this.normalizeTaskUnlockMode(body.unlockMode, task.unlockMode)
        : task.unlockMode;
    const prerequisiteTaskId =
      body.prerequisiteTaskId !== undefined
        ? this.normalizeTaskPrerequisite(body.prerequisiteTaskId)
        : task.prerequisiteTaskId;

    await this.validateTaskConfiguration(
      task.courseId,
      task.id,
      unlockMode,
      prerequisiteTaskId,
    );

    if (body.title !== undefined) {
      task.title = this.requireTaskTitle(body.title);
    }

    if (body.description !== undefined) {
      task.description = String(body.description ?? '').trim();
    }

    if (body.type !== undefined) {
      task.type = String(body.type ?? '').trim() || task.type;
    }

    if (body.order !== undefined) {
      task.order = this.parseTaskOrder(body.order);
    }

    if (body.completionCriteria !== undefined) {
      task.completionCriteria = body.completionCriteria ?? {};
    }

    if (body.isPublished !== undefined) {
      task.isPublished = body.isPublished === true;
    }

    task.unlockMode = unlockMode;
    task.prerequisiteTaskId = prerequisiteTaskId;
    task.updatedBy = actorId;

    const savedTask = await this.taskRepository.save(task);
    await this.reconcileTaskProgressAfterConfigurationChange(savedTask);

    return mapLearningTaskToDto(savedTask);
  }

  async updateLearningTaskReleaseConfig(
    id: string,
    body: UpdateLearningTaskReleaseConfigDto,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    return this.updateLearningTask(
      id,
      {
        unlockMode: body.unlockMode,
        prerequisiteTaskId: body.prerequisiteTaskId,
      },
      actorUserId,
    );
  }

  async updateLearningTaskSortOrder(
    courseId: string | number,
    body: UpdateLearningTaskSortDto,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorId,
      CoursePermission.ManageCourseContent,
    );

    if (!Array.isArray(body?.items)) {
      throw new ApiValidationError('Sort order items are required');
    }

    const tasks = await this.taskRepository.find({
      where: {
        courseId: normalizedCourseId,
        id: In(body.items.map((item) => String(item.id ?? ''))),
      },
    });
    const tasksById = new Map(tasks.map((task) => [task.id, task]));

    for (const item of body.items) {
      if (!item.id || !tasksById.has(item.id)) {
        throw new ApiValidationError('All tasks must belong to the course');
      }

      const task = tasksById.get(item.id);
      task.order = this.parseTaskOrder(item.order);
      task.updatedBy = actorId;
    }

    const savedTasks = await this.taskRepository.save(tasks);

    return savedTasks.sort((a, b) => a.order - b.order).map(mapLearningTaskToDto);
  }

  async deleteTask(
    id: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const task = await this.findLearningTaskOrThrow(id);
    await this.assertTaskManageable(task, actorUserId);

    const dependentTask = await this.taskRepository.findOne({
      where: { prerequisiteTaskId: task.id },
    });

    if (dependentTask) {
      throw new ApiValidationError(
        'Task cannot be deleted while another task depends on it',
      );
    }

    await this.taskRepository.delete(id);
  }

  async publishTask(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    return this.updateLearningTask(id, { isPublished: true }, actorUserId);
  }

  async unpublishTask(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto> {
    return this.updateLearningTask(id, { isPublished: false }, actorUserId);
  }

  async getLearningPathProgress(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const enrollment = await this.assertCurrentStudentEnrollment(
      normalizedCourseId,
      actorUserId,
    );

    return this.buildLearningPathForEnrollment(normalizedCourseId, enrollment);
  }

  async startLearningTask(
    taskId: string,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const task = await this.findLearningTaskOrThrow(taskId);
    await this.assertTaskReadable(task, actorUserId);
    const actorId = this.requireActorUserId(actorUserId);
    const enrollment = await this.assertCurrentStudentEnrollment(
      task.courseId,
      actorId,
    );
    const progress = await this.ensureTaskProgress(task, enrollment, actorId);

    if (progress.status === TaskProgressStatus.LOCKED) {
      throw new ApiForbiddenError('Task is locked', 'TASK_LOCKED');
    }

    if (
      progress.status !== TaskProgressStatus.COMPLETED &&
      progress.status !== TaskProgressStatus.IN_PROGRESS
    ) {
      progress.status = TaskProgressStatus.IN_PROGRESS;
      progress.completionPercentage = 25;
      progress.startedAt = progress.startedAt ?? new Date();
      progress.updatedBy = actorId;
      await this.taskProgressRepository.save(progress);
    }

    return this.buildLearningPathForEnrollment(task.courseId, enrollment);
  }

  async recordTaskResult(
    studentId: string | number,
    taskId: string,
    passed: boolean,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const task = await this.findLearningTaskOrThrow(taskId);
    const normalizedStudentId = this.toUserId(studentId);

    if (actorUserId !== undefined && actorUserId !== null) {
      const actorId = this.requireActorUserId(actorUserId);

      if (actorId !== normalizedStudentId) {
        await this.assertTaskManageable(task, actorId);
      } else {
        await this.assertTaskReadable(task, actorId);
      }
    }

    const enrollment = await this.findStudentEnrollmentOrThrow(
      task.courseId,
      normalizedStudentId,
    );
    const progress = await this.ensureTaskProgress(
      task,
      enrollment,
      actorUserId ? this.toUserId(actorUserId) : 'system',
    );

    if (progress.status === TaskProgressStatus.LOCKED) {
      throw new ApiForbiddenError('Task is locked', 'TASK_LOCKED');
    }

    if (
      passed &&
      progress.status === TaskProgressStatus.COMPLETED &&
      progress.resultPassed === true
    ) {
      await this.unlockEligibleNextTasks(task, enrollment);
      return this.buildLearningPathForEnrollment(task.courseId, enrollment);
    }

    if (
      !passed &&
      progress.status === TaskProgressStatus.FAILED &&
      progress.resultPassed === false
    ) {
      return this.buildLearningPathForEnrollment(task.courseId, enrollment);
    }

    const now = new Date();

    progress.status = passed ? TaskProgressStatus.COMPLETED : TaskProgressStatus.FAILED;
    progress.completionPercentage = passed ? 100 : 0;
    progress.startedAt = progress.startedAt ?? now;
    progress.completedAt = now;
    progress.resultPassed = passed;
    progress.resultRecordedAt = now;
    progress.updatedBy = actorUserId ? this.toUserId(actorUserId) : 'system';

    await this.taskProgressRepository.save(progress);

    if (passed) {
      await this.unlockEligibleNextTasks(task, enrollment);
    }

    return this.buildLearningPathForEnrollment(task.courseId, enrollment);
  }

  async completeLearningTask(
    taskId: string,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    return this.recordTaskResult(actorId, taskId, true, actorId);
  }

  async failLearningTask(
    taskId: string,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    return this.recordTaskResult(actorId, taskId, false, actorId);
  }

  async manuallyUnlockLearningTask(
    taskId: string,
    body: ManualUnlockLearningTaskDto,
    actorUserId?: string | number,
  ): Promise<StudentProgressOverviewDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const studentId = body?.studentId;

    if (studentId === undefined || studentId === null || studentId === '') {
      throw new ApiValidationError('Student ID is required');
    }

    const task = await this.findLearningTaskOrThrow(taskId);
    await this.assertTaskManageable(task, actorId);
    const enrollment = await this.findStudentEnrollmentOrThrow(
      task.courseId,
      studentId,
    );
    const progress = await this.ensureTaskProgress(task, enrollment, actorId);

    if (
      progress.status === TaskProgressStatus.LOCKED ||
      progress.status === TaskProgressStatus.AVAILABLE
    ) {
      progress.status = TaskProgressStatus.AVAILABLE;
      progress.completionPercentage = 0;
      progress.unlockedAt = progress.unlockedAt ?? new Date();
      progress.unlockSource = TaskUnlockSource.MANUAL;
      progress.updatedBy = actorId;
      await this.taskProgressRepository.save(progress);
    }

    return this.buildStudentProgressOverview(task.courseId, enrollment);
  }

  async getLearningTaskProgressForStudent(
    courseId: string | number,
    studentId: string | number,
    actorUserId?: string | number,
  ): Promise<StudentProgressOverviewDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorUserId,
      CoursePermission.ReadAllResults,
    );
    const enrollment = await this.findStudentEnrollmentOrThrow(
      normalizedCourseId,
      studentId,
    );

    return this.buildStudentProgressOverview(normalizedCourseId, enrollment);
  }

  async getLearningTaskProgressOverview(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<StudentProgressOverviewDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    await this.assertCoursePermission(
      normalizedCourseId,
      actorUserId,
      CoursePermission.ReadAllResults,
    );
    const enrollments = await this.enrollmentRepository.find({
      where: {
        courseId: normalizedCourseId,
        role: CourseMemberRole.STUDENT,
      },
      order: { userId: 'ASC' },
    });
    const overview: StudentProgressOverviewDto[] = [];

    for (const enrollment of enrollments) {
      overview.push(await this.buildStudentProgressOverview(normalizedCourseId, enrollment));
    }

    return overview;
  }

  // Content Release methods
  async createContentRelease(
    courseId: string,
    contentType: string,
    contentId: string,
    releaseType: string,
    releaseDate: Date,
    releaseConditions: any,
    createdBy: string,
  ): Promise<ContentRelease> {
    const release = new ContentRelease();
    release.contentType = contentType;
    release.contentId = contentId;
    release.releaseType = releaseType as ReleaseType;
    release.releaseDate = releaseDate;
    release.releaseConditions = releaseConditions;
    release.isActive = true;
    release.isReleased = false;
    release.createdBy = createdBy;
    release.updatedBy = createdBy;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    release.course = course;

    return this.contentReleaseRepository.save(release);
  }

  async getContentReleasesByCourse(courseId: string): Promise<ContentRelease[]> {
    return this.contentReleaseRepository.find({
      where: { course: { id: courseId } },
      order: { releaseDate: 'ASC' },
    });
  }

  async getContentReleaseById(id: string): Promise<ContentRelease> {
    return this.contentReleaseRepository.findOne({
      where: { id },
    });
  }

  async updateContentRelease(
    id: string,
    contentType: string,
    contentId: string,
    releaseType: string,
    releaseDate: Date,
    releaseConditions: any,
    isActive: boolean,
    updatedBy: string,
  ): Promise<ContentRelease> {
    const release = await this.contentReleaseRepository.findOne({
      where: { id },
    });

    if (!release) {
      throw new Error('Content release not found');
    }

    release.contentType = contentType;
    release.contentId = contentId;
    release.releaseType = releaseType as ReleaseType;
    release.releaseDate = releaseDate;
    release.releaseConditions = releaseConditions;
    release.isActive = isActive;
    release.updatedBy = updatedBy;

    return this.contentReleaseRepository.save(release);
  }

  async deleteContentRelease(id: string): Promise<void> {
    await this.contentReleaseRepository.delete(id);
  }

  async releaseContentManually(
    id: string,
    releasedBy: string,
  ): Promise<ContentRelease> {
    const release = await this.contentReleaseRepository.findOne({
      where: { id },
    });

    if (!release) {
      throw new Error('Content release not found');
    }

    if (release.isReleased) {
      throw new Error('Content already released');
    }

    release.isReleased = true;
    release.releasedAt = new Date();
    release.releasedBy = releasedBy;

    return this.contentReleaseRepository.save(release);
  }

  async checkAutomaticReleases(courseId: string): Promise<ContentRelease[]> {
    const now = new Date();
    const releases = await this.contentReleaseRepository.find({
      where: {
        course: { id: courseId },
        releaseType: ReleaseType.TIME_BASED,
        isReleased: false,
        isActive: true,
        releaseDate: LessThanOrEqual(now),
      },
    });

    const releasedContent = [];

    for (const release of releases) {
      release.isReleased = true;
      release.releasedAt = now;
      release.releasedBy = 'system';
      const updatedRelease = await this.contentReleaseRepository.save(release);
      releasedContent.push(updatedRelease);
    }

    return releasedContent;
  }

  async checkProgressBasedReleases(
    courseId: string,
    enrollmentId: string,
  ): Promise<ContentRelease[]> {
    const releases = await this.contentReleaseRepository.find({
      where: {
        course: { id: courseId },
        releaseType: ReleaseType.PROGRESS_BASED,
        isReleased: false,
        isActive: true,
      },
    });

    const releasedContent = [];

    for (const release of releases) {
      const conditions = release.releaseConditions;
      
      // Check if conditions are met based on learning path progress
      const learningPath = await this.getLearningPathProgress(
        courseId,
        enrollmentId,
      );

      let conditionsMet = true;

      if (conditions.minCompletionPercentage) {
        if (
          learningPath.progressPercentage <
          conditions.minCompletionPercentage
        ) {
          conditionsMet = false;
        }
      }

      if (conditions.requiredTaskIds) {
        for (const requiredTaskId of conditions.requiredTaskIds) {
          const taskProgress = await this.taskProgressRepository.findOne({
            where: {
              task: { id: requiredTaskId },
              enrollment: { id: enrollmentId },
            },
          });

          if (!taskProgress || taskProgress.status !== 'COMPLETED') {
            conditionsMet = false;
            break;
          }
        }
      }

      if (conditionsMet) {
        release.isReleased = true;
        release.releasedAt = new Date();
        release.releasedBy = 'system';
        const updatedRelease = await this.contentReleaseRepository.save(
          release,
        );
        releasedContent.push(updatedRelease);
      }
    }

    return releasedContent;
  }

  async getReleasedContentForEnrollment(
    courseId: string,
    enrollmentId: string,
  ): Promise<any[]> {
    // Check and process automatic releases
    await this.checkAutomaticReleases(courseId);
    await this.checkProgressBasedReleases(courseId, enrollmentId);

    // Get all released content for the course
    const releases = await this.contentReleaseRepository.find({
      where: {
        course: { id: courseId },
        isReleased: true,
        isActive: true,
      },
      relations: ['course'],
    });

    const releasedContent = [];

    for (const release of releases) {
      let contentDetails = null;

      switch (release.contentType) {
        case 'LEARNING_MATERIAL':
          contentDetails = await this.learningMaterialRepository.findOne({
            where: { id: release.contentId },
          });
          break;
        case 'ASSIGNMENT':
          contentDetails = await this.assignmentRepository.findOne({
            where: { id: release.contentId },
          });
          break;
        case 'TASK':
          contentDetails = await this.taskRepository.findOne({
            where: { id: release.contentId },
          });
          break;
        // Add other content types as needed
      }

      if (contentDetails) {
        releasedContent.push({
          releaseId: release.id,
          contentType: release.contentType,
          contentId: release.contentId,
          contentDetails,
          releasedAt: release.releasedAt,
          releasedBy: release.releasedBy,
        });
      }
    }

    return releasedContent;
  }

  async getContentReleaseStatus(
    courseId: string,
    enrollmentId: string,
  ): Promise<any> {
    // Get all content releases for the course
    const allReleases = await this.contentReleaseRepository.find({
      where: { course: { id: courseId }, isActive: true },
    });

    // Check automatic releases
    const autoReleased = await this.checkAutomaticReleases(courseId);
    
    // Check progress-based releases
    const progressReleased = await this.checkProgressBasedReleases(
      courseId,
      enrollmentId,
    );

    // Get final status
    const finalReleases = await this.contentReleaseRepository.find({
      where: { course: { id: courseId }, isActive: true },
    });

    const releasedCount = finalReleases.filter(r => r.isReleased).length;
    const pendingCount = finalReleases.filter(r => !r.isReleased).length;

    return {
      totalReleases: finalReleases.length,
      releasedCount,
      pendingCount,
      autoReleasedCount: autoReleased.length,
      progressReleasedCount: progressReleased.length,
      releaseDetails: finalReleases.map(r => ({
        id: r.id,
        contentType: r.contentType,
        contentId: r.contentId,
        releaseType: r.releaseType,
        isReleased: r.isReleased,
        releaseDate: r.releaseDate,
        releasedAt: r.releasedAt,
      })),
    };
  }

  // Content Template methods
  async createContentTemplate(
    courseId: string,
    name: string,
    description: string,
    templateType: string,
    templateData: any,
    placeholders: any,
    isGlobal: boolean,
    createdBy: string,
  ): Promise<ContentTemplate> {
    const template = new ContentTemplate();
    template.name = name;
    template.description = description;
    template.templateType = templateType;
    template.templateData = templateData;
    template.placeholders = placeholders;
    template.isGlobal = isGlobal;
    template.createdBy = createdBy;
    template.updatedBy = createdBy;
    template.isActive = true;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    template.course = course;

    return this.contentTemplateRepository.save(template);
  }

  async getContentTemplatesByCourse(courseId: string): Promise<ContentTemplate[]> {
    return this.contentTemplateRepository.find({
      where: { course: { id: courseId } },
      order: { name: 'ASC' },
    });
  }

  async getGlobalContentTemplates(): Promise<ContentTemplate[]> {
    return this.contentTemplateRepository.find({
      where: { isGlobal: true },
      order: { name: 'ASC' },
    });
  }

  async getContentTemplateById(id: string): Promise<ContentTemplate> {
    return this.contentTemplateRepository.findOne({
      where: { id },
    });
  }

  async updateContentTemplate(
    id: string,
    name: string,
    description: string,
    templateType: string,
    templateData: any,
    placeholders: any,
    isActive: boolean,
    isGlobal: boolean,
    updatedBy: string,
  ): Promise<ContentTemplate> {
    const template = await this.contentTemplateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new Error('Content template not found');
    }

    template.name = name;
    template.description = description;
    template.templateType = templateType;
    template.templateData = templateData;
    template.placeholders = placeholders;
    template.isActive = isActive;
    template.isGlobal = isGlobal;
    template.updatedBy = updatedBy;

    return this.contentTemplateRepository.save(template);
  }

  async deleteContentTemplate(id: string): Promise<void> {
    await this.contentTemplateRepository.delete(id);
  }

  async applyTemplateToCourse(
    templateId: string,
    courseId: string,
    appliedBy: string,
  ): Promise<any> {
    const template = await this.contentTemplateRepository.findOne({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    const result = {
      templateId: template.id,
      templateName: template.name,
      templateType: template.templateType,
      createdContent: [],
      errors: [],
    };

    try {
      switch (template.templateType) {
        case 'COURSE_STRUCTURE':
          // Apply course structure template
          const structureData = template.templateData;
          
          if (structureData.learningMaterials) {
            for (const materialData of structureData.learningMaterials) {
              try {
                const material = await this.createLearningMaterial(
                  courseId,
                  materialData.title,
                  materialData.description || '',
                  materialData.type || 'OTHER',
                  materialData.url || '',
                  materialData.filePath || '',
                  appliedBy,
                );
                result.createdContent.push({
                  type: 'LEARNING_MATERIAL',
                  id: material.id,
                  title: material.title,
                });
              } catch (error) {
                result.errors.push({
                  type: 'LEARNING_MATERIAL',
                  error: error.message,
                  data: materialData,
                });
              }
            }
          }

          if (structureData.assignments) {
            for (const assignmentData of structureData.assignments) {
              try {
                const assignment = await this.createAssignment(
                  courseId,
                  assignmentData.title,
                  assignmentData.description || '',
                  assignmentData.type || 'OTHER',
                  assignmentData.maxPoints || 100,
                  assignmentData.weight || 1,
                  assignmentData.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
                  appliedBy,
                );
                result.createdContent.push({
                  type: 'ASSIGNMENT',
                  id: assignment.id,
                  title: assignment.title,
                });
              } catch (error) {
                result.errors.push({
                  type: 'ASSIGNMENT',
                  error: error.message,
                  data: assignmentData,
                });
              }
            }
          }

          if (structureData.tasks) {
            for (const taskData of structureData.tasks) {
              try {
                const task = await this.createLearningTask(
                  courseId,
                  {
                    title: taskData.title,
                    description: taskData.description || '',
                    type: taskData.type || 'OTHER',
                    order: taskData.order || 1,
                    unlockMode: taskData.prerequisiteTaskId
                      ? TaskUnlockMode.AUTOMATIC
                      : TaskUnlockMode.IMMEDIATE,
                    prerequisiteTaskId: taskData.prerequisiteTaskId || null,
                    completionCriteria: taskData.completionCriteria || {},
                    isPublished: false,
                  },
                  appliedBy,
                );
                result.createdContent.push({
                  type: 'TASK',
                  id: task.id,
                  title: task.title,
                });
              } catch (error) {
                result.errors.push({
                  type: 'TASK',
                  error: error.message,
                  data: taskData,
                });
              }
            }
          }

          break;

        case 'ASSIGNMENT':
          // Apply assignment template
          const assignmentData = template.templateData;
          const assignment = await this.createAssignment(
            courseId,
            assignmentData.title,
            assignmentData.description || '',
            assignmentData.type || 'OTHER',
            assignmentData.maxPoints || 100,
            assignmentData.weight || 1,
            assignmentData.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            appliedBy,
          );
          result.createdContent.push({
            type: 'ASSIGNMENT',
            id: assignment.id,
            title: assignment.title,
          });
          break;

        case 'LEARNING_MATERIAL':
          // Apply learning material template
          const materialData = template.templateData;
          const material = await this.createLearningMaterial(
            courseId,
            materialData.title,
            materialData.description || '',
            materialData.type || 'OTHER',
            materialData.url || '',
            materialData.filePath || '',
            appliedBy,
          );
          result.createdContent.push({
            type: 'LEARNING_MATERIAL',
            id: material.id,
            title: material.title,
          });
          break;

        case 'SYLLABUS':
          // Apply syllabus template - could create a learning material with syllabus content
          const syllabusData = template.templateData;
          const syllabusMaterial = await this.createLearningMaterial(
            courseId,
            'Course Syllabus',
            syllabusData.description || 'Course syllabus',
            'DOCUMENT',
            '',
            '',
            appliedBy,
          );
          result.createdContent.push({
            type: 'SYLLABUS',
            id: syllabusMaterial.id,
            title: syllabusMaterial.title,
          });
          break;

        default:
          throw new Error(`Unsupported template type: ${template.templateType}`);
      }

      return result;
    } catch (error) {
      result.errors.push({
        type: 'GENERAL',
        error: error.message,
      });
      return result;
    }
  }

  async getAvailableTemplatesForCourse(courseId: string): Promise<ContentTemplate[]> {
    // Get course-specific templates
    const courseTemplates = await this.getContentTemplatesByCourse(courseId);

    // Get global templates
    const globalTemplates = await this.getGlobalContentTemplates();

    // Combine and remove duplicates
    const allTemplates = [...courseTemplates, ...globalTemplates];
    
    return allTemplates.filter(
      (template, index, self) =>
        index === self.findIndex(t => t.id === template.id),
    );
  }

  // Search methods
  async searchCourses(
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<Course[]> {
    return this.coursesRepository.find({
      where: [
        { title: ILike(`%${query}%`) },
        { description: ILike(`%${query}%`) },
        { external_id: ILike(`%${query}%`) },
      ],
      take: limit,
      skip: offset,
    });
  }

  async searchLearningMaterials(
    courseId: string,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<LearningMaterial[]> {
    return this.learningMaterialRepository.find({
      where: {
        course: { id: courseId },
        title: ILike(`%${query}%`),
      },
      take: limit,
      skip: offset,
    });
  }

  async searchAssignments(
    courseId: string,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<Assignment[]> {
    return this.assignmentRepository.find({
      where: {
        course: { id: courseId },
        title: ILike(`%${query}%`),
      },
      take: limit,
      skip: offset,
    });
  }

  async searchTasks(
    courseId: string,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<Task[]> {
    return this.taskRepository.find({
      where: {
        course: { id: courseId },
        title: ILike(`%${query}%`),
      },
      take: limit,
      skip: offset,
    });
  }

  async searchContentTemplates(
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<ContentTemplate[]> {
    return this.contentTemplateRepository.find({
      where: [
        { name: ILike(`%${query}%`) },
        { description: ILike(`%${query}%`) },
      ],
      take: limit,
      skip: offset,
    });
  }

  async advancedSearch(
    query: string,
    contentTypes: string[] = ['COURSE', 'LEARNING_MATERIAL', 'ASSIGNMENT', 'TASK'],
    limit: number = 10,
    offset: number = 0,
  ): Promise<any> {
    const results: any = {
      courses: [],
      learningMaterials: [],
      assignments: [],
      tasks: [],
      templates: [],
    };

    if (contentTypes.includes('COURSE')) {
      results.courses = await this.searchCourses(query, limit, offset);
    }

    if (contentTypes.includes('LEARNING_MATERIAL')) {
      // Search across all courses for learning materials
      results.learningMaterials = await this.learningMaterialRepository.find({
        where: {
          title: ILike(`%${query}%`),
        },
        take: limit,
        skip: offset,
        relations: ['course'],
      });
    }

    if (contentTypes.includes('ASSIGNMENT')) {
      // Search across all courses for assignments
      results.assignments = await this.assignmentRepository.find({
        where: {
          title: ILike(`%${query}%`),
        },
        take: limit,
        skip: offset,
        relations: ['course'],
      });
    }

    if (contentTypes.includes('TASK')) {
      // Search across all courses for tasks
      results.tasks = await this.taskRepository.find({
        where: {
          title: ILike(`%${query}%`),
        },
        take: limit,
        skip: offset,
        relations: ['course'],
      });
    }

    if (contentTypes.includes('TEMPLATE')) {
      results.templates = await this.searchContentTemplates(query, limit, offset);
    }

    return results;
  }

  async searchWithinCourse(
    courseId: string,
    query: string,
    contentTypes: string[] = ['LEARNING_MATERIAL', 'ASSIGNMENT', 'TASK'],
    limit: number = 10,
    offset: number = 0,
  ): Promise<any> {
    const results: any = {
      learningMaterials: [],
      assignments: [],
      tasks: [],
    };

    if (contentTypes.includes('LEARNING_MATERIAL')) {
      results.learningMaterials = await this.searchLearningMaterials(
        courseId,
        query,
        limit,
        offset,
      );
    }

    if (contentTypes.includes('ASSIGNMENT')) {
      results.assignments = await this.searchAssignments(
        courseId,
        query,
        limit,
        offset,
      );
    }

    if (contentTypes.includes('TASK')) {
      results.tasks = await this.searchTasks(courseId, query, limit, offset);
    }

    return results;
  }

  // Workgroup methods
  async createCourseGroup(
    courseId: string,
    name: string,
    description: string,
    groupType: string,
    createdBy: string,
  ): Promise<CourseGroup> {
    const group = new CourseGroup();
    group.course_id = courseId;
    group.name = name;
    group.description = description;
    group.group_type = groupType as any;
    group.created_by = createdBy;
    group.updated_by = createdBy;

    return this.courseGroupRepository.save(group);
  }

  async getCourseGroupsByCourse(courseId: string): Promise<CourseGroup[]> {
    return this.courseGroupRepository.find({
      where: { course_id: courseId },
      relations: ['memberships'],
    });
  }

  async getCourseGroupById(id: string): Promise<CourseGroup> {
    return this.courseGroupRepository.findOne({
      where: { id },
      relations: ['memberships'],
    });
  }

  async updateCourseGroup(
    id: string,
    name: string,
    description: string,
    groupType: string,
    isActive: boolean,
    groupGrade: number,
    groupFeedback: string,
    updatedBy: string,
  ): Promise<CourseGroup> {
    const group = await this.courseGroupRepository.findOne({
      where: { id },
    });

    if (!group) {
      throw new Error('Course group not found');
    }

    group.name = name;
    group.description = description;
    group.group_type = groupType as any;
    group.is_active = isActive;
    group.group_grade = groupGrade;
    group.group_feedback = groupFeedback;
    group.updated_by = updatedBy;

    return this.courseGroupRepository.save(group);
  }

  async deleteCourseGroup(id: string): Promise<void> {
    await this.courseGroupRepository.delete(id);
  }

  async addMemberToGroup(
    groupId: string,
    userId: string,
    role: string,
    addedBy: string,
  ): Promise<GroupMembership> {
    const membership = new GroupMembership();
    membership.group_id = groupId;
    membership.user_id = userId;
    membership.role = role as any;
    membership.joined_at = new Date();
    membership.added_by = addedBy;

    return this.groupMembershipRepository.save(membership);
  }

  async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    await this.groupMembershipRepository.delete({
      group_id: groupId,
      user_id: userId,
    });
  }

  async updateGroupMembershipRole(
    groupId: string,
    userId: string,
    role: string,
  ): Promise<GroupMembership> {
    const membership = await this.groupMembershipRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });

    if (!membership) {
      throw new Error('Group membership not found');
    }

    membership.role = role as any;

    return this.groupMembershipRepository.save(membership);
  }

  async getGroupMembers(groupId: string): Promise<GroupMembership[]> {
    return this.groupMembershipRepository.find({
      where: { group_id: groupId },
    });
  }

  async getGroupsForUser(courseId: string, userId: string): Promise<CourseGroup[]> {
    const memberships = await this.groupMembershipRepository.find({
      where: { user_id: userId },
      relations: ['group'],
    });

    return memberships
      .map(m => m.group)
      .filter(group => group.course_id === courseId);
  }

  async getGroupMembership(
    groupId: string,
    userId: string,
  ): Promise<GroupMembership> {
    return this.groupMembershipRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });
  }

  async assignGroupGrade(
    groupId: string,
    grade: number,
    feedback: string,
    updatedBy: string,
  ): Promise<CourseGroup> {
    const group = await this.courseGroupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    group.group_grade = grade;
    group.group_feedback = feedback;
    group.updated_by = updatedBy;

    return this.courseGroupRepository.save(group);
  }

  async assignIndividualGrade(
    groupId: string,
    userId: string,
    grade: number,
    feedback: string,
  ): Promise<GroupMembership> {
    const membership = await this.groupMembershipRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });

    if (!membership) {
      throw new Error('Group membership not found');
    }

    membership.individual_grade = grade;
    membership.individual_feedback = feedback;

    return this.groupMembershipRepository.save(membership);
  }

  async getGroupPerformance(groupId: string): Promise<any> {
    const group = await this.courseGroupRepository.findOne({
      where: { id: groupId },
      relations: ['memberships'],
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const members = group.memberships || [];
    
    const individualGrades = members
      .filter(m => m.individual_grade !== null && m.individual_grade !== undefined)
      .map(m => m.individual_grade);

    const averageGrade =
      individualGrades.length > 0
        ? individualGrades.reduce((sum, grade) => sum + grade, 0) /
          individualGrades.length
        : 0;

    return {
      groupId: group.id,
      groupName: group.name,
      groupGrade: group.group_grade,
      groupFeedback: group.group_feedback,
      averageIndividualGrade: averageGrade,
      memberCount: members.length,
      membersWithGrades: individualGrades.length,
      memberPerformance: members.map(m => ({
        userId: m.user_id,
        role: m.role,
        individualGrade: m.individual_grade,
        individualFeedback: m.individual_feedback,
      })),
    };
  }

  async autoCreateWorkgroups(
    courseId: string,
    groupSize: number,
    groupPrefix: string,
    createdBy: string,
  ): Promise<CourseGroup[]> {
    // Get all enrollments for the course
    const enrollments = await this.enrollmentRepository.find({
      where: { courseId: courseId },
    });

    const studentEnrollments = enrollments.filter(
      e => e.role === CourseMemberRole.STUDENT,
    );

    const createdGroups = [];

    // Create groups with the specified size
    for (let i = 0; i < studentEnrollments.length; i += groupSize) {
      const groupNumber = Math.floor(i / groupSize) + 1;
      const groupName = `${groupPrefix} ${groupNumber}`;

      const group = await this.createCourseGroup(
        courseId,
        groupName,
        `Auto-created workgroup ${groupNumber}`,
        'WORKGROUP',
        createdBy,
      );

      // Add members to the group
      const groupMembers = studentEnrollments.slice(i, i + groupSize);
      for (const member of groupMembers) {
        await this.addMemberToGroup(
          group.id,
          member.userId,
          'MEMBER',
          createdBy,
        );
      }

      // Assign the first member as leader
      if (groupMembers.length > 0) {
        await this.updateGroupMembershipRole(
          group.id,
          groupMembers[0].userId,
          'LEADER',
        );
      }

      createdGroups.push(group);
    }

    return createdGroups;
  }

  async getGroupLearningProgress(
    groupId: string,
    courseId: string,
  ): Promise<any> {
    const group = await this.courseGroupRepository.findOne({
      where: { id: groupId },
      relations: ['memberships'],
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const memberProgress = [];

    for (const membership of group.memberships) {
      try {
        const progress = await this.getLearningPathProgress(
          courseId,
          membership.user_id,
        );
        
        memberProgress.push({
          userId: membership.user_id,
          role: membership.role,
          ...progress,
        });
      } catch (error) {
        memberProgress.push({
          userId: membership.user_id,
          role: membership.role,
          error: error.message,
        });
      }
    }

    // Calculate average progress
    const validProgresses = memberProgress.filter(
      p => p.progressPercentage !== undefined,
    );
    const averageProgress =
      validProgresses.length > 0
        ? validProgresses.reduce(
            (sum, p) => sum + p.progressPercentage,
            0,
          ) / validProgresses.length
        : 0;

    return {
      groupId: group.id,
      groupName: group.name,
      averageProgress,
      memberCount: group.memberships.length,
      membersWithProgress: validProgresses.length,
      memberProgress,
    };
  }

  // Calendar Event methods
  async createCalendarEvent(
    courseId: string,
    title: string,
    description: string,
    eventType: string,
    startTime: Date,
    endTime: Date,
    location: string,
    onlineLink: string,
    isAllDay: boolean,
    isRecurring: boolean,
    recurrencePattern: any,
    relatedContentId: string,
    relatedContentType: string,
    createdBy: string,
  ): Promise<CalendarEvent> {
    const event = new CalendarEvent();
    event.title = title;
    event.description = description;
    event.eventType = eventType;
    event.startTime = startTime;
    event.endTime = endTime;
    event.location = location;
    event.onlineLink = onlineLink;
    event.isAllDay = isAllDay;
    event.isRecurring = isRecurring;
    event.recurrencePattern = recurrencePattern;
    event.relatedContentId = relatedContentId;
    event.relatedContentType = relatedContentType;
    event.createdBy = createdBy;
    event.updatedBy = createdBy;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    event.course = course;

    return this.calendarEventRepository.save(event);
  }

  async getCalendarEventsByCourse(
    courseId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CalendarEvent[]> {
    return this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        startTime: LessThanOrEqual(endDate),
        endTime: MoreThanOrEqual(startDate),
      },
      order: { startTime: 'ASC' },
    });
  }

  async getCalendarEventById(id: string): Promise<CalendarEvent> {
    return this.calendarEventRepository.findOne({
      where: { id },
    });
  }

  async updateCalendarEvent(
    id: string,
    title: string,
    description: string,
    eventType: string,
    startTime: Date,
    endTime: Date,
    location: string,
    onlineLink: string,
    isAllDay: boolean,
    isRecurring: boolean,
    recurrencePattern: any,
    relatedContentId: string,
    relatedContentType: string,
    updatedBy: string,
  ): Promise<CalendarEvent> {
    const event = await this.calendarEventRepository.findOne({
      where: { id },
    });

    if (!event) {
      throw new Error('Calendar event not found');
    }

    event.title = title;
    event.description = description;
    event.eventType = eventType;
    event.startTime = startTime;
    event.endTime = endTime;
    event.location = location;
    event.onlineLink = onlineLink;
    event.isAllDay = isAllDay;
    event.isRecurring = isRecurring;
    event.recurrencePattern = recurrencePattern;
    event.relatedContentId = relatedContentId;
    event.relatedContentType = relatedContentType;
    event.updatedBy = updatedBy;

    return this.calendarEventRepository.save(event);
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    await this.calendarEventRepository.delete(id);
  }

  async createAssignmentDueDateEvents(
    courseId: string,
    createdBy: string,
  ): Promise<CalendarEvent[]> {
    const assignments = await this.assignmentRepository.find({
      where: {
        course: { id: courseId },
        dueDate: Not(IsNull()),
      },
    });

    const createdEvents = [];

    for (const assignment of assignments) {
      // Check if event already exists for this assignment
      const existingEvent = await this.calendarEventRepository.findOne({
        where: {
          relatedContentId: assignment.id,
          relatedContentType: 'ASSIGNMENT',
        },
      });

      if (!existingEvent) {
        const event = await this.createCalendarEvent(
          courseId,
          `Due: ${assignment.title}`,
          assignment.description || 'Assignment due date',
          'ASSIGNMENT_DUE',
          assignment.dueDate,
          assignment.dueDate,
          '',
          '',
          false,
          false,
          null,
          assignment.id,
          'ASSIGNMENT',
          createdBy,
        );
        createdEvents.push(event);
      }
    }

    return createdEvents;
  }

  async getUpcomingEvents(
    courseId: string,
    limit: number = 5,
  ): Promise<CalendarEvent[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30); // Next 30 days

    return this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        startTime: MoreThanOrEqual(now),
        endTime: LessThanOrEqual(futureDate),
      },
      order: { startTime: 'ASC' },
      take: limit,
    });
  }

  async getEventsByDateRange(
    courseId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CalendarEvent[]> {
    return this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        startTime: LessThanOrEqual(endDate),
        endTime: MoreThanOrEqual(startDate),
      },
      order: { startTime: 'ASC' },
    });
  }

  async getDailyEvents(
    courseId: string,
    date: Date,
  ): Promise<CalendarEvent[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.calendarEventRepository.find({
      where: [
        {
          course: { id: courseId },
          startTime: LessThanOrEqual(endOfDay),
          endTime: MoreThanOrEqual(startOfDay),
        },
        {
          course: { id: courseId },
          isAllDay: true,
          startTime: LessThanOrEqual(endOfDay),
          endTime: MoreThanOrEqual(startOfDay),
        },
      ],
      order: { startTime: 'ASC' },
    });
  }

  async getMonthlyEvents(
    courseId: string,
    year: number,
    month: number,
  ): Promise<CalendarEvent[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    return this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        startTime: LessThanOrEqual(endDate),
        endTime: MoreThanOrEqual(startDate),
      },
      order: { startTime: 'ASC' },
    });
  }

  async syncAssignmentDueDates(
    courseId: string,
    createdBy: string,
  ): Promise<{ created: CalendarEvent[]; deleted: number }> {
    // Get all assignments with due dates
    const assignments = await this.assignmentRepository.find({
      where: {
        course: { id: courseId },
        dueDate: Not(IsNull()),
      },
    });

    // Get all existing assignment-related events
    const existingEvents = await this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        relatedContentType: 'ASSIGNMENT',
      },
    });

    const assignmentIds = assignments.map(a => a.id);
    const existingEventAssignmentIds = existingEvents.map(e => e.relatedContentId);

    // Find events to delete (assignments that no longer exist or have no due date)
    const eventsToDelete = existingEvents.filter(
      event => !assignmentIds.includes(event.relatedContentId),
    );

    // Delete obsolete events
    const deleteResults = [];
    for (const event of eventsToDelete) {
      try {
        await this.deleteCalendarEvent(event.id);
        deleteResults.push(event.id);
      } catch (error) {
        // Continue with other deletions even if one fails
      }
    }

    // Create events for assignments that don't have events yet
    const createdEvents = [];
    for (const assignment of assignments) {
      const hasEvent = existingEventAssignmentIds.includes(assignment.id);

      if (!hasEvent) {
        try {
          const event = await this.createCalendarEvent(
            courseId,
            `Due: ${assignment.title}`,
            assignment.description || 'Assignment due date',
            'ASSIGNMENT_DUE',
            assignment.dueDate,
            assignment.dueDate,
            '',
            '',
            false,
            false,
            null,
            assignment.id,
            'ASSIGNMENT',
            createdBy,
          );
          createdEvents.push(event);
        } catch (error) {
          // Continue with other creations even if one fails
        }
      }
    }

    return {
      created: createdEvents,
      deleted: deleteResults.length,
    };
  }
}

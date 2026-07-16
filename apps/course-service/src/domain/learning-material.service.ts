import { Not, In } from 'typeorm';
import { CoursePermission, hasCoursePermission } from '../courses.permissions';
import { ApiForbiddenError, ApiNotFoundError, ApiValidationError } from '../common/api-errors';
import {
  CreateExternalLearningMaterialDto,
  LearningMaterialResponseDto,
  UpdateLearningMaterialDto,
  UpdateLearningMaterialSortDto,
  mapLearningMaterialToDto,
} from '../dto/learning-material.dto';
import { AuditEventType } from '../entities/audit-event.entity';
import { Course } from '../entities/course.entity';
import { CourseMemberRole } from '../entities/enrollment.entity';
import {
  LearningMaterial,
  LearningMaterialPublicationStatus,
  LearningMaterialReleaseMode,
  LearningMaterialType,
} from '../entities/learning-material.entity';

type CourseServiceFacade = any;

type UploadedLearningMaterialFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

type LearningMaterialDownload = {
  stream: NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
  fileSize?: number | string;
};

type LearningMaterialVisibility = {
  visible: boolean;
  locked: boolean;
  lockedReason?: string;
  releaseAfterTaskTitle?: string;
  visibleForStudents: boolean;
};

const maxMaterialFileSizeBytes = () =>
  Number(process.env.COURSE_MATERIAL_MAX_FILE_SIZE_BYTES ?? 50 * 1024 * 1024);

const ALLOWED_MATERIAL_MIME_TYPES = [
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

export class LearningMaterialService {
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

  private normalizeMaterialReleaseMode(mode: unknown): LearningMaterialReleaseMode {
    if (mode === undefined || mode === null || mode === '') {
      return LearningMaterialReleaseMode.IMMEDIATE;
    }

    const normalizedMode = String(mode).toUpperCase() as LearningMaterialReleaseMode;

    if (!Object.values(LearningMaterialReleaseMode).includes(normalizedMode)) {
      throw new ApiValidationError('Invalid material release mode');
    }

    return normalizedMode;
  }

  private hasProvidedValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
  }

  private hasOwnInputField(input: Record<string, unknown>, field: string): boolean {
    return Object.prototype.hasOwnProperty.call(input, field);
  }

  private parseReleaseDate(value: unknown): Date | null {
    if (!this.hasProvidedValue(value)) {
      return null;
    }

    const parsedDate = value instanceof Date ? value : new Date(String(value));

    if (Number.isNaN(parsedDate.getTime())) {
      throw new ApiValidationError('Release date must be a valid date-time');
    }

    return parsedDate;
  }

  private async applyLearningMaterialReleaseConfiguration(
    material: LearningMaterial,
    input: Record<string, unknown>,
    forceDefault = false,
  ): Promise<void> {
    const modeProvided = this.hasOwnInputField(input, 'releaseMode');
    const releaseAtProvided = this.hasOwnInputField(input, 'releaseAt');
    const releaseAfterTaskProvided = this.hasOwnInputField(input, 'releaseAfterTaskId');
    const hasReleaseChange =
      forceDefault || modeProvided || releaseAtProvided || releaseAfterTaskProvided;

    if (!hasReleaseChange) {
      return;
    }

    const mode = modeProvided
      ? this.normalizeMaterialReleaseMode(input.releaseMode)
      : material.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE;
    const releaseAt = releaseAtProvided
      ? this.parseReleaseDate(input.releaseAt)
      : material.releaseAt ?? null;
    const releaseAfterTaskId = releaseAfterTaskProvided
      ? this.hasProvidedValue(input.releaseAfterTaskId)
        ? String(input.releaseAfterTaskId)
        : null
      : material.releaseAfterTaskId ?? null;

    if (mode === LearningMaterialReleaseMode.IMMEDIATE) {
      if (
        (!modeProvided || releaseAtProvided) &&
        releaseAtProvided &&
        this.hasProvidedValue(input.releaseAt)
      ) {
        throw new ApiValidationError('Immediate materials cannot define a release date');
      }

      if (
        (!modeProvided || releaseAfterTaskProvided) &&
        releaseAfterTaskProvided &&
        this.hasProvidedValue(input.releaseAfterTaskId)
      ) {
        throw new ApiValidationError('Immediate materials cannot define a release task');
      }

      material.releaseMode = mode;
      material.releaseAt = null;
      material.releaseAfterTaskId = null;
      return;
    }

    if (mode === LearningMaterialReleaseMode.SCHEDULED) {
      if (releaseAfterTaskProvided && this.hasProvidedValue(input.releaseAfterTaskId)) {
        throw new ApiValidationError('Scheduled materials cannot define a release task');
      }

      if (!releaseAt) {
        throw new ApiValidationError('Scheduled materials require a release date');
      }

      material.releaseMode = mode;
      material.releaseAt = releaseAt;
      material.releaseAfterTaskId = null;
      return;
    }

    if (releaseAtProvided && this.hasProvidedValue(input.releaseAt)) {
      throw new ApiValidationError('Task-based materials cannot define a release date');
    }

    if (!releaseAfterTaskId) {
      throw new ApiValidationError('Task-based materials require a release task');
    }

    const releaseTask = await this.taskRepository.findOne({
      where: {
        id: releaseAfterTaskId,
        courseId: material.courseId,
        courseRunId: material.courseRunId,
        ...(material.courseVersionId ? { courseVersionId: material.courseVersionId } : {}),
      },
    });

    if (!releaseTask) {
      throw new ApiValidationError(
        'Release task must belong to the same content version as the material',
      );
    }

    material.releaseMode = mode;
    material.releaseAt = null;
    material.releaseAfterTaskId = releaseTask.id;
  }

  private async buildLearningMaterialVisibility(
    material: LearningMaterial,
    actorUserId?: string | number,
    role?: CourseMemberRole,
  ): Promise<LearningMaterialVisibility> {
    const releaseMode = material.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE;
    const releaseTask = material.releaseAfterTaskId
      ? await this.taskRepository.findOne({
        where: {
          id: material.releaseAfterTaskId,
        },
      })
      : null;
    const releaseAfterTaskTitle = releaseTask
      ? (await this.enrichTaskReference(releaseTask)).title
      : undefined;
    const isPublished =
      material.publicationStatus === LearningMaterialPublicationStatus.PUBLISHED;

    if (!isPublished) {
      return {
        visible: false,
        locked: false,
        releaseAfterTaskTitle,
        visibleForStudents: false,
      };
    }

    if (releaseMode === LearningMaterialReleaseMode.IMMEDIATE) {
      return {
        visible: true,
        locked: false,
        releaseAfterTaskTitle,
        visibleForStudents: true,
      };
    }

    if (releaseMode === LearningMaterialReleaseMode.SCHEDULED) {
      const releaseAt = material.releaseAt;
      const visible = Boolean(releaseAt && releaseAt.getTime() <= Date.now());

      return {
        visible,
        locked: !visible,
        lockedReason: visible
          ? undefined
          : `Wird sichtbar ab ${this.formatGermanDateTime(releaseAt)}`,
        releaseAfterTaskTitle,
        visibleForStudents: visible,
      };
    }

    const conditionalVisibility: LearningMaterialVisibility = {
      visible: false,
      locked: true,
      lockedReason: releaseAfterTaskTitle
        ? `Wird sichtbar, sobald Aufgabe "${releaseAfterTaskTitle}" erfolgreich abgeschlossen wurde.`
        : 'Wird sichtbar, sobald die vorausgesetzte Aufgabe erfolgreich abgeschlossen wurde.',
      releaseAfterTaskTitle,
      visibleForStudents: false,
    };

    if (
      !actorUserId ||
      !role ||
      hasCoursePermission(role, CoursePermission.ManageCourseContent)
    ) {
      return {
        ...conditionalVisibility,
        locked: false,
      };
    }

    const enrollment = await this.findCourseEnrollment(
      material.courseId,
      actorUserId,
      material.courseRunId,
    );

    if (!enrollment || enrollment.role !== CourseMemberRole.STUDENT) {
      return conditionalVisibility;
    }

    const progress = releaseTask
      ? await this.taskProgressRepository.findOne({
        where: {
          enrollmentId: enrollment.id,
          taskId: releaseTask.id,
        },
      })
      : null;
    const visible = releaseTask
      ? this.isTaskCompletionSuccessful(releaseTask, progress)
      : false;

    return {
      ...conditionalVisibility,
      visible,
      locked: !visible,
      lockedReason: visible ? undefined : conditionalVisibility.lockedReason,
      visibleForStudents: visible,
    };
  }

  private async mapLearningMaterialForActor(
    material: LearningMaterial,
    actorUserId?: string | number,
    role?: CourseMemberRole,
  ): Promise<LearningMaterialResponseDto> {
    const visibility = await this.buildLearningMaterialVisibility(
      material,
      actorUserId,
      role,
    );

    return mapLearningMaterialToDto(material, visibility);
  }

  private formatGermanDateTime(value?: Date | null): string {
    if (!value) {
      return 'dem geplanten Zeitpunkt';
    }

    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Berlin',
    }).format(value);
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

    if (!hasCoursePermission(role, CoursePermission.ManageCourseContent)) {
      const { run: currentRun, version } =
        await this.getActiveCourseVersionForCurrentRunOrThrow(material.courseId);

      if (
        material.courseRunId !== currentRun.id ||
        material.courseVersionId !== version.id
      ) {
        throw new ApiForbiddenError(
          'Learning material is not available in the active content version',
          'MATERIAL_ACCESS_DENIED',
        );
      }
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
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));
    const material = new LearningMaterial();
    material.title = this.requireMaterialTitle(title);
    material.description = description;
    material.type = this.normalizeMaterialType(type);
    material.url = url;
    material.filePath = filePath;
    material.createdBy = createdBy;
    material.updatedBy = createdBy;
    material.courseId = this.toCourseId(courseId);
    material.courseRunId = currentRun.id;
    material.courseRun = currentRun;
    material.courseVersionId = version.id;
    material.courseVersion = version;
    material.isPublished = false;
    material.publicationStatus = LearningMaterialPublicationStatus.DRAFT;
    material.tags = [];
    material.sortOrder = 0;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    material.course = course;

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);
    await this.recordAuditEvent({
      eventType: AuditEventType.MATERIAL_CREATED,
      actorUserId: createdBy,
      courseId: savedMaterial.courseId,
      courseRunId: savedMaterial.courseRunId,
      courseVersionId: savedMaterial.courseVersionId,
      entityType: 'learning_material',
      entityId: savedMaterial.id,
      summary: `Lernmaterial erstellt: ${savedMaterial.title}`,
      metadataJson: {
        type: savedMaterial.type,
        publicationStatus: savedMaterial.publicationStatus,
      },
    });

    return savedMaterial;
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
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));
    material.courseRunId = currentRun.id;
    material.courseRun = currentRun;
    material.courseVersionId = version.id;
    material.courseVersion = version;
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
    await this.applyLearningMaterialReleaseConfiguration(
      material,
      body as Record<string, unknown>,
      true,
    );

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);
    await this.recordAuditEvent({
      eventType: AuditEventType.MATERIAL_CREATED,
      actorUserId: actorId,
      courseId: savedMaterial.courseId,
      courseRunId: savedMaterial.courseRunId,
      courseVersionId: savedMaterial.courseVersionId,
      entityType: 'learning_material',
      entityId: savedMaterial.id,
      summary: `Datei-Material erstellt: ${savedMaterial.title}`,
      metadataJson: {
        type: savedMaterial.type,
        mimeType: savedMaterial.mimeType,
        fileSize: savedMaterial.fileSize,
        publicationStatus: savedMaterial.publicationStatus,
      },
    });

    return this.mapLearningMaterialForActor(
      savedMaterial,
      actorId,
      CourseMemberRole.TEACHER,
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
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));
    material.courseRunId = currentRun.id;
    material.courseRun = currentRun;
    material.courseVersionId = version.id;
    material.courseVersion = version;
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
    await this.applyLearningMaterialReleaseConfiguration(
      material,
      body as Record<string, unknown>,
      true,
    );

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);
    await this.recordAuditEvent({
      eventType: AuditEventType.MATERIAL_CREATED,
      actorUserId: actorId,
      courseId: savedMaterial.courseId,
      courseRunId: savedMaterial.courseRunId,
      courseVersionId: savedMaterial.courseVersionId,
      entityType: 'learning_material',
      entityId: savedMaterial.id,
      summary: `Externer Link erstellt: ${savedMaterial.title}`,
      metadataJson: {
        type: savedMaterial.type,
        publicationStatus: savedMaterial.publicationStatus,
      },
    });

    return this.mapLearningMaterialForActor(
      savedMaterial,
      actorId,
      CourseMemberRole.TEACHER,
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
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));
    const materials = await this.learningMaterialRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: currentRun.id,
        courseVersionId: version.id,
        publicationStatus: canManage
          ? Not(LearningMaterialPublicationStatus.ARCHIVED)
          : LearningMaterialPublicationStatus.PUBLISHED,
      },
      order: {
        sortOrder: 'ASC',
        createdAt: 'DESC',
      },
    });

    return Promise.all(
      materials.map((material) =>
        this.mapLearningMaterialForActor(material, actorUserId, role),
      ),
    );
  }

  async getLearningMaterialsByCourseRun(
    courseId: string,
    runId: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto[]> {
    const run = await this.assertCourseRunManageable(courseId, runId, actorUserId);
    const version = await this.getActiveCourseVersionForRunOrThrow(
      this.toCourseId(courseId),
      run.id,
    );
    const materials = await this.learningMaterialRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
        courseVersionId: version.id,
        publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
      },
      order: {
        sortOrder: 'ASC',
        createdAt: 'DESC',
      },
    });

    return Promise.all(
      materials.map((material) =>
        this.mapLearningMaterialForActor(
          material,
          actorUserId,
          CourseMemberRole.TEACHER,
        ),
      ),
    );
  }

  async getLearningMaterialsByCourseVersion(
    courseId: string,
    runId: string,
    versionId: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto[]> {
    const run = await this.assertCourseRunManageable(courseId, runId, actorUserId);
    const version = await this.findCourseVersionInRunOrThrow(
      this.toCourseId(courseId),
      run.id,
      versionId,
    );
    const materials = await this.learningMaterialRepository.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
        courseVersionId: version.id,
        publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
      },
      order: {
        sortOrder: 'ASC',
        createdAt: 'DESC',
      },
    });

    return Promise.all(
      materials.map((material) =>
        this.mapLearningMaterialForActor(
          material,
          actorUserId,
          CourseMemberRole.TEACHER,
        ),
      ),
    );
  }

  async getLearningMaterialById(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialResponseDto> {
    const material = await this.findLearningMaterialOrThrow(id);

    const role = await this.assertLearningMaterialReadable(material, actorUserId);

    return this.mapLearningMaterialForActor(material, actorUserId, role);
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

    await this.applyLearningMaterialReleaseConfiguration(
      material,
      body as Record<string, unknown>,
    );

    material.updatedBy = actorId;

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);
    await this.recordAuditEvent({
      eventType: AuditEventType.MATERIAL_UPDATED,
      actorUserId: actorId,
      courseId: savedMaterial.courseId,
      courseRunId: savedMaterial.courseRunId,
      courseVersionId: savedMaterial.courseVersionId,
      entityType: 'learning_material',
      entityId: savedMaterial.id,
      summary: `Lernmaterial aktualisiert: ${savedMaterial.title}`,
      metadataJson: {
        type: savedMaterial.type,
        publicationStatus: savedMaterial.publicationStatus,
      },
    });

    return this.mapLearningMaterialForActor(
      savedMaterial,
      actorId,
      CourseMemberRole.TEACHER,
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

    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));
    const materials = await this.learningMaterialRepository.find({
      where: {
        id: In(materialIds),
        courseId: this.toCourseId(courseId),
        courseRunId: currentRun.id,
        courseVersionId: version.id,
        publicationStatus: Not(LearningMaterialPublicationStatus.ARCHIVED),
      },
    });
    const materialById = new Map<string, LearningMaterial>(
      materials.map((material: LearningMaterial) => [material.id, material]),
    );

    for (const item of body.items) {
      const material = item.id ? materialById.get(item.id) : undefined;

      if (!material) {
        throw new ApiValidationError('Sort list contains an unknown material');
      }

      material.sortOrder = this.parseSortOrder(item.sortOrder);
      material.updatedBy = actorId;
    }

    const savedMaterials = (await this.learningMaterialRepository.save(materials))
      .sort((left, right) => left.sortOrder - right.sortOrder);
    await this.refreshCourseVersionContent(version.id);
    await this.recordAuditEvent({
      eventType: AuditEventType.MATERIAL_UPDATED,
      actorUserId: actorId,
      courseId,
      courseRunId: currentRun.id,
      courseVersionId: version.id,
      entityType: 'learning_material_sort_order',
      entityId: this.toCourseId(courseId),
      summary: 'Sortierung der Lernmaterialien aktualisiert',
      metadataJson: {
        materialIds: savedMaterials.map((material) => material.id),
      },
    });

    return Promise.all(
      savedMaterials.map((material) =>
        this.mapLearningMaterialForActor(
          material,
          actorId,
          CourseMemberRole.TEACHER,
        ),
      ),
    );
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
    await this.refreshCourseVersionContent(material.courseVersionId);
    await this.recordAuditEvent({
      eventType: AuditEventType.MATERIAL_DELETED,
      actorUserId: actorId,
      courseId: material.courseId,
      courseRunId: material.courseRunId,
      courseVersionId: material.courseVersionId,
      entityType: 'learning_material',
      entityId: material.id,
      summary: `Lernmaterial archiviert: ${material.title}`,
      metadataJson: {
        type: material.type,
      },
    });
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

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);
    await this.recordAuditEvent({
      eventType: AuditEventType.MATERIAL_UPDATED,
      actorUserId: actorId,
      courseId: savedMaterial.courseId,
      courseRunId: savedMaterial.courseRunId,
      courseVersionId: savedMaterial.courseVersionId,
      entityType: 'learning_material',
      entityId: savedMaterial.id,
      summary: `Lernmaterial veröffentlicht: ${savedMaterial.title}`,
      metadataJson: {
        publicationStatus: savedMaterial.publicationStatus,
      },
    });

    return this.mapLearningMaterialForActor(
      savedMaterial,
      actorId,
      CourseMemberRole.TEACHER,
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

    const savedMaterial = await this.learningMaterialRepository.save(material);
    await this.refreshCourseVersionContent(savedMaterial.courseVersionId);
    await this.recordAuditEvent({
      eventType: AuditEventType.MATERIAL_UPDATED,
      actorUserId: actorId,
      courseId: savedMaterial.courseId,
      courseRunId: savedMaterial.courseRunId,
      courseVersionId: savedMaterial.courseVersionId,
      entityType: 'learning_material',
      entityId: savedMaterial.id,
      summary: `Lernmaterial zurückgezogen: ${savedMaterial.title}`,
      metadataJson: {
        publicationStatus: savedMaterial.publicationStatus,
      },
    });

    return this.mapLearningMaterialForActor(
      savedMaterial,
      actorId,
      CourseMemberRole.TEACHER,
    );
  }

  async downloadLearningMaterial(
    id: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialDownload> {
    const material = await this.findLearningMaterialOrThrow(id);

    const role = await this.assertLearningMaterialReadable(material, actorUserId);
    const visibility = await this.buildLearningMaterialVisibility(
      material,
      actorUserId,
      role,
    );

    if (
      !hasCoursePermission(role, CoursePermission.ManageCourseContent) &&
      !visibility.visible
    ) {
      throw new ApiForbiddenError(
        visibility.lockedReason ?? 'Learning material is locked',
        'MATERIAL_ACCESS_DENIED',
      );
    }

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
}

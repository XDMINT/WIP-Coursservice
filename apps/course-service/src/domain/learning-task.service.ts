import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { CoursePermission, hasCoursePermission } from '../courses.permissions';
import { ApiForbiddenError, ApiNotFoundError, ApiValidationError } from '../common/api-errors';
import {
  CreateLearningTaskDto,
  LearningPathResponseDto,
  LearningTaskProgressDto,
  LearningTaskResponseDto,
  ManualTaskAssessmentDto,
  ManualUnlockLearningTaskDto,
  MockEvaluateLearningTaskDto,
  StudentLearningTaskResponseDto,
  StudentProgressOverviewDto,
  SubmitLearningTaskDto,
  TaskAssessmentResponseDto,
  UpdateLearningTaskDto,
  UpdateLearningTaskReleaseConfigDto,
  UpdateLearningTaskSortDto,
  mapLearningTaskToDto,
  mapLearningTaskWithProgressToDto,
  mapTaskAssessmentToDto,
  mapTaskProgressToDto,
} from '../dto/learning-process.dto';
import {
  AddStudyGroupMemberDto,
  CreateStudyGroupDto,
  ManualGroupTaskAssessmentDto,
  StudyGroupResponseDto,
  UpdateStudyGroupDto,
  mapGroupTaskProgressToDto,
  mapStudyGroupToDto,
} from '../dto/study-group.dto';
import { AuditEventType } from '../entities/audit-event.entity';
import { Course } from '../entities/course.entity';
import { CourseGroup } from '../entities/course-group.entity';
import { CourseMemberRole, Enrollment } from '../entities/enrollment.entity';
import { GroupMembership, MembershipRole } from '../entities/group-membership.entity';
import { GroupTaskProgress } from '../entities/group-task-progress.entity';
import { Task, TaskGradingMode, TaskUnlockMode, TaskWorkMode } from '../entities/task.entity';
import {
  TaskAssessment,
  TaskAssessmentStatus,
  TaskAssessmentTargetType,
} from '../entities/task-assessment.entity';
import {
  TaskProgress,
  TaskProgressStatus,
  TaskUnlockSource,
} from '../entities/task-progress.entity';
import {
  TASK_PASS_THRESHOLD_PERCENT,
  calculateTaskAssessmentPassed,
} from '../task-assessment.rules';

type CourseServiceFacade = any;

type UploadedLearningMaterialFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

type LearningMaterialDownload = {
  stream: Readable;
  fileName: string;
  mimeType: string;
  fileSize?: number | string;
};

type TaskSubmissionFileData = {
  originalFileName?: string;
  storageKey?: string;
  mimeType?: string;
  fileSize?: number;
  uploadedAt?: string;
};

export class LearningTaskService {
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

  private parseBooleanLike(value: unknown): boolean {
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  private parseTaskSubmissionDataField(value: unknown): Record<string, unknown> {
    if (value === undefined || value === null || value === '') {
      return {};
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        throw new ApiValidationError('Submission data must be valid JSON');
      }
    }

    throw new ApiValidationError('Submission data must be an object');
  }

  private normalizeTaskSubmissionData(
    submissionData?: Record<string, unknown>,
    options: { allowStorageKey?: boolean } = {},
  ): Record<string, unknown> {
    const source = submissionData && typeof submissionData === 'object'
      ? submissionData
      : {};
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
      if (['file', 'link', 'text'].includes(key) || value === undefined) {
        continue;
      }

      normalized[key] = value;
    }

    if (typeof source.text === 'string' && source.text.trim().length > 0) {
      normalized.text = source.text.trim();
    }

    if (typeof source.link === 'string' && source.link.trim().length > 0) {
      normalized.link = this.validateExternalUrl(source.link);
    }

    if (source.file && typeof source.file === 'object' && !Array.isArray(source.file)) {
      const fileSource = source.file as Record<string, unknown>;
      const fileData: TaskSubmissionFileData = {};

      if (
        typeof fileSource.originalFileName === 'string' &&
        fileSource.originalFileName.trim().length > 0
      ) {
        fileData.originalFileName = fileSource.originalFileName.trim();
      }

      if (
        typeof fileSource.mimeType === 'string' &&
        fileSource.mimeType.trim().length > 0
      ) {
        fileData.mimeType = fileSource.mimeType.trim();
      }

      const parsedFileSize = Number(fileSource.fileSize);

      if (Number.isFinite(parsedFileSize) && parsedFileSize >= 0) {
        fileData.fileSize = parsedFileSize;
      }

      if (
        typeof fileSource.uploadedAt === 'string' &&
        fileSource.uploadedAt.trim().length > 0
      ) {
        fileData.uploadedAt = fileSource.uploadedAt.trim();
      }

      if (
        options.allowStorageKey === true &&
        typeof fileSource.storageKey === 'string' &&
        fileSource.storageKey.trim().length > 0
      ) {
        fileData.storageKey = fileSource.storageKey.trim();
      }

      if (Object.keys(fileData).length > 0) {
        normalized.file = fileData;
      }
    }

    return normalized;
  }

  private extractTaskSubmissionFile(
    submissionData?: Record<string, unknown> | null,
  ): TaskSubmissionFileData | null {
    if (!submissionData || typeof submissionData !== 'object') {
      return null;
    }

    const fileData = submissionData.file;

    if (!fileData || typeof fileData !== 'object' || Array.isArray(fileData)) {
      return null;
    }

    return fileData as TaskSubmissionFileData;
  }

  private async deleteReplacedTaskSubmissionFile(
    courseId: string,
    previousFile: TaskSubmissionFileData | null,
    nextFile: TaskSubmissionFileData | null,
  ): Promise<void> {
    const previousStorageKey = previousFile?.storageKey;
    const nextStorageKey = nextFile?.storageKey;

    if (previousStorageKey && previousStorageKey !== nextStorageKey) {
      await this.materialStorage.deleteFile(courseId, previousStorageKey);
    }
  }

  private async buildTaskSubmissionDataFromUpload(
    courseId: string,
    body: SubmitLearningTaskDto & Record<string, unknown>,
    file?: UploadedLearningMaterialFile,
  ): Promise<{
    storageKey?: string;
    submissionData: Record<string, unknown>;
  }> {
    const rawSubmissionData = this.parseTaskSubmissionDataField(body.submissionData);

    if (typeof body.text === 'string') {
      rawSubmissionData.text = body.text;
    }

    if (typeof body.link === 'string') {
      rawSubmissionData.link = body.link;
    }

    const submissionData = this.normalizeTaskSubmissionData(rawSubmissionData);

    if (!file) {
      return { submissionData };
    }

    this.validateUploadedMaterialFile(file);
    const storedFile = await this.materialStorage.saveFile(
      this.toCourseId(courseId),
      file.originalname,
      file.buffer,
    );
    const fileData: TaskSubmissionFileData = {
      fileSize: file.size,
      mimeType: file.mimetype,
      originalFileName: storedFile.safeFileName,
      storageKey: storedFile.storageKey,
      uploadedAt: new Date().toISOString(),
    };

    submissionData.file = fileData;

    return {
      storageKey: storedFile.storageKey,
      submissionData,
    };
  }

  // Task and learning process methods
  private async initializeImmediateTaskProgressForEnrollment(
    courseId: string,
    enrollment: Enrollment,
    actorId: string,
  ): Promise<void> {
    const activeVersion = enrollment.courseRunId
      ? await this.getActiveCourseVersionForRunOrThrow(courseId, enrollment.courseRunId)
      : null;
    const immediateTasks = await this.taskRepository.find({
      where: {
        courseId,
        courseRunId: enrollment.courseRunId,
        ...(activeVersion ? { courseVersionId: activeVersion.id } : {}),
        isPublished: true,
        unlockMode: TaskUnlockMode.IMMEDIATE,
      },
      order: {
        order: 'ASC',
      },
    });

    for (const task of immediateTasks) {
      await this.ensureTaskProgress(task, enrollment, actorId);
    }
  }

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

  private normalizeTaskGradingMode(
    gradingMode: unknown,
    defaultMode = TaskGradingMode.NOT_GRADED,
  ): TaskGradingMode {
    if (gradingMode === undefined || gradingMode === null || gradingMode === '') {
      return defaultMode;
    }

    const normalizedMode = String(gradingMode).toUpperCase() as TaskGradingMode;

    if (!Object.values(TaskGradingMode).includes(normalizedMode)) {
      throw new ApiValidationError('Invalid task grading mode');
    }

    return normalizedMode;
  }

  private normalizeTaskWorkMode(
    workMode: unknown,
    defaultMode = TaskWorkMode.INDIVIDUAL,
  ): TaskWorkMode {
    if (workMode === undefined || workMode === null || workMode === '') {
      return defaultMode;
    }

    const normalizedMode = String(workMode).toUpperCase() as TaskWorkMode;

    if (!Object.values(TaskWorkMode).includes(normalizedMode)) {
      throw new ApiValidationError('Invalid task work mode');
    }

    return normalizedMode;
  }

  private parseTaskAssessmentNumber(
    value: unknown,
    fieldName: string,
    options: { required?: boolean; min?: number; max?: number } = {},
  ): number | null {
    if (value === undefined || value === null || value === '') {
      if (options.required) {
        throw new ApiValidationError(`${fieldName} is required`);
      }

      return null;
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue)) {
      throw new ApiValidationError(`${fieldName} must be a valid number`);
    }

    const min = options.min ?? 0;

    if (parsedValue < min) {
      throw new ApiValidationError(`${fieldName} cannot be below ${min}`);
    }

    if (options.max !== undefined && parsedValue > options.max) {
      throw new ApiValidationError(`${fieldName} cannot be above ${options.max}`);
    }

    return Math.round(parsedValue * 100) / 100;
  }

  private validateTaskGradingConfiguration(
    gradingMode: TaskGradingMode,
    maxPoints?: number | null,
    passThreshold?: number | null,
  ): void {
    if (
      (gradingMode === TaskGradingMode.MANUAL ||
        gradingMode === TaskGradingMode.AUTOMATIC_MOCK) &&
      (maxPoints === undefined || maxPoints === null || maxPoints <= 0)
    ) {
      throw new ApiValidationError('Bewertete Aufgaben benötigen eine maximale Punktzahl.');
    }

    if (
      passThreshold !== undefined &&
      passThreshold !== null &&
      (passThreshold < 0 || passThreshold > 100)
    ) {
      throw new ApiValidationError('Die Bestehensgrenze muss zwischen 0 und 100 Prozent liegen.');
    }
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

    return this.enrichTaskReference(task);
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

    if (!hasCoursePermission(role, CoursePermission.ManageCourseContent)) {
      const { run: currentRun, version } =
        await this.getActiveCourseVersionForCurrentRunOrThrow(task.courseId);

      if (task.courseRunId !== currentRun.id || task.courseVersionId !== version.id) {
        throw new ApiForbiddenError(
          'Task is not available in the active content version',
          'TASK_ACCESS_DENIED',
        );
      }
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
    courseVersionId?: string,
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

    if (
      !prerequisite ||
      prerequisite.courseId !== courseId ||
      (courseVersionId && prerequisite.courseVersionId !== courseVersionId)
    ) {
      throw new ApiValidationError(
        'Prerequisite task must belong to the same content version',
      );
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

      if (
        currentTask.courseId !== courseId ||
        (courseVersionId && currentTask.courseVersionId !== courseVersionId)
      ) {
        throw new ApiValidationError(
          'Prerequisite task must belong to the same content version',
        );
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

    const [prerequisite, prerequisiteProgress] = await Promise.all([
      this.taskRepository.findOne({
        where: {
          id: task.prerequisiteTaskId,
        },
      }),
      this.taskProgressRepository.findOne({
        where: {
          taskId: task.prerequisiteTaskId,
          enrollmentId,
        },
      }),
    ]);

    return prerequisite
      ? this.isTaskCompletionSuccessful(prerequisite, prerequisiteProgress)
      : false;
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

  private async findTaskAssessment(
    task: Task,
    studentId: string | number,
  ): Promise<TaskAssessment | null> {
    return this.taskAssessmentRepository.findOne({
      where: {
        courseRunId: task.courseRunId,
        taskId: task.id,
        assessmentTargetType: TaskAssessmentTargetType.INDIVIDUAL,
        studentId: this.toUserId(studentId),
      },
    });
  }

  private getGroupTaskProgressRepository(): Repository<GroupTaskProgress> {
    if (!this.groupTaskProgressRepository) {
      throw new Error('Group task progress repository is not configured');
    }

    return this.groupTaskProgressRepository;
  }

  private async findGroupTaskAssessment(
    task: Task,
    groupId: string,
  ): Promise<TaskAssessment | null> {
    return this.taskAssessmentRepository.findOne({
      where: {
        courseRunId: task.courseRunId,
        taskId: task.id,
        assessmentTargetType: TaskAssessmentTargetType.GROUP,
        groupId,
      },
    });
  }

  private async ensureTaskAssessment(
    task: Task,
    enrollment: Enrollment,
  ): Promise<TaskAssessment> {
    let assessment = await this.findTaskAssessment(task, enrollment.userId);

    if (!assessment) {
      assessment = new TaskAssessment();
      assessment.courseRunId = task.courseRunId;
      assessment.courseVersionId = task.courseVersionId;
      assessment.taskId = task.id;
      assessment.task = task;
      assessment.assessmentTargetType = TaskAssessmentTargetType.INDIVIDUAL;
      assessment.studentId = enrollment.userId;
      assessment.groupId = null;
      assessment.gradingMode = task.gradingMode ?? TaskGradingMode.NOT_GRADED;
      assessment.status = TaskAssessmentStatus.NOT_SUBMITTED;
      assessment.maxPoints = task.maxPoints ?? null;
      assessment.passThreshold = task.passThreshold ?? null;
    }

    assessment.courseRunId = task.courseRunId;
    assessment.courseVersionId = task.courseVersionId;
    assessment.taskId = task.id;
    assessment.assessmentTargetType = TaskAssessmentTargetType.INDIVIDUAL;
    assessment.studentId = enrollment.userId;
    assessment.groupId = null;
    assessment.gradingMode = task.gradingMode ?? TaskGradingMode.NOT_GRADED;
    assessment.maxPoints = task.maxPoints ?? assessment.maxPoints ?? null;
    assessment.passThreshold = task.passThreshold ?? assessment.passThreshold ?? null;

    return assessment;
  }

  private async ensureGroupTaskAssessment(
    task: Task,
    group: CourseGroup,
  ): Promise<TaskAssessment> {
    let assessment = await this.findGroupTaskAssessment(task, group.id);

    if (!assessment) {
      assessment = new TaskAssessment();
      assessment.courseRunId = task.courseRunId;
      assessment.courseVersionId = task.courseVersionId;
      assessment.taskId = task.id;
      assessment.task = task;
      assessment.status = TaskAssessmentStatus.NOT_SUBMITTED;
      assessment.maxPoints = task.maxPoints ?? null;
      assessment.passThreshold = task.passThreshold ?? null;
    }

    assessment.courseRunId = task.courseRunId;
    assessment.courseVersionId = task.courseVersionId;
    assessment.taskId = task.id;
    assessment.assessmentTargetType = TaskAssessmentTargetType.GROUP;
    assessment.studentId = null;
    assessment.groupId = group.id;
    assessment.group = group;
    assessment.gradingMode = task.gradingMode ?? TaskGradingMode.NOT_GRADED;
    assessment.maxPoints = task.maxPoints ?? assessment.maxPoints ?? null;
    assessment.passThreshold = task.passThreshold ?? assessment.passThreshold ?? null;

    return assessment;
  }

  private async saveTaskAssessment(
    assessment: TaskAssessment,
  ): Promise<TaskAssessment> {
    return this.taskAssessmentRepository.save(assessment);
  }

  private async findStudentEnrollmentForRunOrThrow(
    courseId: string,
    studentId: string | number,
    courseRunId: string,
  ): Promise<Enrollment> {
    const enrollment = await this.findCourseEnrollment(courseId, studentId, courseRunId);

    if (!enrollment || enrollment.role !== CourseMemberRole.STUDENT) {
      throw new ApiForbiddenError(
        'Student is not enrolled in this course run',
        'COURSE_ACCESS_DENIED',
      );
    }

    return enrollment;
  }

  private normalizeStudyGroupName(name: unknown): string {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new ApiValidationError('Group name is required');
    }

    return name.trim();
  }

  private normalizeStudyGroupDescription(description: unknown): string | null {
    if (description === undefined || description === null) {
      return null;
    }

    const normalized = String(description).trim();

    return normalized.length > 0 ? normalized : null;
  }

  private async findStudyGroupInRunOrThrow(
    courseId: string,
    runId: string,
    groupId: string,
    relations: string[] = ['memberships'],
  ): Promise<CourseGroup> {
    const group = await this.courseGroupRepository.findOne({
      where: {
        id: groupId,
        course_id: courseId,
        course_run_id: runId,
      },
      relations,
    });

    if (!group) {
      throw new ApiNotFoundError('Study group not found', 'COURSE_NOT_FOUND');
    }

    return group;
  }

  private async findStudentStudyGroupInRun(
    runId: string,
    studentId: string | number,
  ): Promise<CourseGroup | null> {
    const memberships = await this.groupMembershipRepository.find({
      where: {
        user_id: this.toUserId(studentId),
      },
      relations: ['group', 'group.memberships'],
    });

    const membership = memberships.find((entry) =>
      entry.left_at == null && entry.group?.course_run_id === runId,
    );

    return membership?.group ?? null;
  }

  private async assertStudentStudyGroupInRun(
    courseId: string,
    runId: string,
    studentId: string | number,
  ): Promise<CourseGroup> {
    const group = await this.findStudentStudyGroupInRun(runId, studentId);

    if (!group || group.course_id !== courseId) {
      throw new ApiForbiddenError(
        'Du bist noch keiner Gruppe zugeordnet. Bitte wende dich an die Lehrperson.',
        'COURSE_ACCESS_DENIED',
      );
    }

    return group;
  }

  private async ensureGroupTaskProgress(
    task: Task,
    group: CourseGroup,
    actorId = 'system',
  ): Promise<GroupTaskProgress> {
    const repository = this.getGroupTaskProgressRepository();
    let progress = await repository.findOne({
      where: {
        courseRunId: task.courseRunId,
        taskId: task.id,
        groupId: group.id,
      },
    });

    if (!progress) {
      progress = new GroupTaskProgress();
      progress.courseRunId = task.courseRunId;
      progress.courseVersionId = task.courseVersionId;
      progress.taskId = task.id;
      progress.task = task;
      progress.groupId = group.id;
      progress.group = group;
      progress.status = TaskProgressStatus.AVAILABLE;
      progress.progressData = {};
      progress.createdBy = actorId;
    }

    progress.courseRunId = task.courseRunId;
    progress.courseVersionId = task.courseVersionId;
    progress.taskId = task.id;
    progress.groupId = group.id;
    progress.updatedBy = actorId;

    return repository.save(progress);
  }

  private groupProgressCompletionPercentage(status: TaskProgressStatus): number {
    if (status === TaskProgressStatus.COMPLETED) {
      return 100;
    }

    if (status === TaskProgressStatus.SUBMITTED) {
      return 75;
    }

    if (status === TaskProgressStatus.IN_PROGRESS) {
      return 25;
    }

    return 0;
  }

  private async applyGroupProgressToMembers(
    task: Task,
    group: CourseGroup,
    groupProgress: GroupTaskProgress,
    assessment: TaskAssessment | null,
    actorId: string,
  ): Promise<void> {
    const members = group.memberships?.length
      ? group.memberships
      : await this.groupMembershipRepository.find({
        where: { group_id: group.id },
      });

    for (const membership of members.filter((member) => member.left_at == null)) {
      const enrollment = await this.findStudentEnrollmentForRunOrThrow(
        task.courseId,
        membership.user_id,
        task.courseRunId,
      );
      const progress = await this.ensureTaskProgress(task, enrollment, actorId);
      const now = new Date();

      progress.status = groupProgress.status;
      progress.completionPercentage = this.groupProgressCompletionPercentage(groupProgress.status);
      progress.startedAt = groupProgress.startedAt ?? progress.startedAt ?? now;
      progress.completedAt = groupProgress.completedAt ?? undefined;
      progress.resultPassed = assessment?.passed ?? undefined;
      progress.resultRecordedAt = assessment?.assessedAt ?? undefined;
      progress.updatedBy = actorId;
      await this.taskProgressRepository.save(progress);

      if (assessment?.passed === true) {
        await this.unlockEligibleNextTasks(task, enrollment);
      }
    }
  }

  private async loadGroupTaskProgressDtos(
    group: CourseGroup,
  ) {
    const repository = this.getGroupTaskProgressRepository();
    const progressList = await repository.find({
      where: {
        groupId: group.id,
      },
      order: {
        updatedAt: 'DESC',
      },
    });
    const assessments: TaskAssessment[] = progressList.length > 0
      ? await this.taskAssessmentRepository.find({
        where: {
          assessmentTargetType: TaskAssessmentTargetType.GROUP,
          groupId: group.id,
          taskId: In(progressList.map((progress) => progress.taskId)),
        },
      })
      : [];
    const assessmentsByTaskId = new Map<string, TaskAssessment>(
      assessments.map((assessment) => [assessment.taskId, assessment]),
    );

    return progressList.map((progress) =>
      mapGroupTaskProgressToDto(progress, assessmentsByTaskId.get(progress.taskId)),
    );
  }

  private async findGroupTaskProgress(
    task: Task,
    groupId: string,
  ): Promise<GroupTaskProgress | null> {
    return this.getGroupTaskProgressRepository().findOne({
      where: {
        courseRunId: task.courseRunId,
        taskId: task.id,
        groupId,
      },
    });
  }

  private isTaskCompletionSuccessful(
    task: Task,
    progress: TaskProgress | null,
  ): boolean {
    if (!progress || progress.status !== TaskProgressStatus.COMPLETED) {
      return false;
    }

    if ((task.gradingMode ?? TaskGradingMode.NOT_GRADED) === TaskGradingMode.NOT_GRADED) {
      return true;
    }

    return progress.resultPassed === true;
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
      const enrichedPrerequisite = prerequisite
        ? await this.enrichTaskReference(prerequisite)
        : null;
      const title = enrichedPrerequisite?.title ?? 'die vorherige Aufgabe';

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
    const runId = enrollment.courseRunId ?? (await this.getCurrentCourseRunOrCreate(courseId)).id;
    const activeVersion = await this.getActiveCourseVersionForRunOrThrow(
      courseId,
      runId,
    );
    const taskReferences = await this.taskRepository.find({
      where: {
        courseId,
        courseRunId: runId,
        courseVersionId: activeVersion.id,
      },
      order: { order: 'ASC' },
    });
    const tasks = await this.enrichTaskReferences(taskReferences);
    const visibleTasks = includeUnpublished
      ? tasks
      : tasks.filter((task) => task.isPublished);
    const tasksById = new Map<string, Task>(tasks.map((task: Task) => [task.id, task]));
    const taskDtos: StudentLearningTaskResponseDto[] = [];

    for (const task of visibleTasks) {
      const progress = await this.ensureTaskProgress(task, enrollment);
      let assessment = await this.findTaskAssessment(task, enrollment.userId);
      let lockedReason = await this.getTaskLockedReason(
        task,
        progress,
        tasksById,
      );
      let progressForDto = progress;
      let groupContext = null;

      if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) === TaskWorkMode.GROUP) {
        const studentGroup = await this.findStudentStudyGroupInRun(runId, enrollment.userId);

        if (!studentGroup) {
          if (progress.status !== TaskProgressStatus.LOCKED) {
            lockedReason = 'Du bist noch keiner Gruppe zugeordnet. Bitte wende dich an die Lehrperson.';
          }

          progressForDto = {
            ...progress,
            status: TaskProgressStatus.LOCKED,
            completionPercentage: 0,
          } as TaskProgress;
        } else {
          const groupProgress = await this.findGroupTaskProgress(task, studentGroup.id);
          const groupAssessment = await this.findGroupTaskAssessment(task, studentGroup.id);
          assessment = groupAssessment;
          groupContext = {
            id: studentGroup.id,
            name: studentGroup.name,
            status: groupProgress?.status,
            startedAt: groupProgress?.startedAt instanceof Date
              ? groupProgress.startedAt.toISOString()
              : null,
            submittedAt: groupProgress?.submittedAt instanceof Date
              ? groupProgress.submittedAt.toISOString()
              : null,
            completedAt: groupProgress?.completedAt instanceof Date
              ? groupProgress.completedAt.toISOString()
              : null,
          };

          if (groupProgress) {
            progressForDto = {
              ...progress,
              status: groupProgress.status,
              completionPercentage: this.groupProgressCompletionPercentage(groupProgress.status),
              startedAt: groupProgress.startedAt ?? progress.startedAt,
              completedAt: groupProgress.completedAt ?? progress.completedAt,
              resultPassed: groupAssessment?.passed ?? progress.resultPassed,
            } as TaskProgress;
          }
        }
      }

      taskDtos.push(mapLearningTaskWithProgressToDto(
        task,
        progressForDto,
        lockedReason,
        assessment,
        groupContext,
      ));
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
      } as TaskProgress, task.assessment, task.group),
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
        courseRunId: completedTask.courseRunId,
        ...(completedTask.courseVersionId ? { courseVersionId: completedTask.courseVersionId } : {}),
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

  private async applyAssessmentToProgress(
    task: Task,
    enrollment: Enrollment,
    assessment: TaskAssessment,
    actorId: string,
  ): Promise<void> {
    const progress = await this.ensureTaskProgress(task, enrollment, actorId);
    const now = new Date();

    if (assessment.status === TaskAssessmentStatus.PENDING_REVIEW) {
      progress.status = TaskProgressStatus.SUBMITTED;
      progress.completionPercentage = 75;
      progress.startedAt = progress.startedAt ?? now;
      progress.completedAt = undefined;
      progress.resultPassed = undefined;
      progress.updatedBy = actorId;
      await this.taskProgressRepository.save(progress);
      return;
    }

    if (assessment.passed === true) {
      progress.status = TaskProgressStatus.COMPLETED;
      progress.completionPercentage = 100;
      progress.startedAt = progress.startedAt ?? now;
      progress.completedAt = now;
      progress.resultPassed = true;
      progress.resultRecordedAt = now;
      progress.updatedBy = actorId;
      await this.taskProgressRepository.save(progress);
      await this.unlockEligibleNextTasks(task, enrollment);
      return;
    }

    if (assessment.passed === false) {
      progress.status = TaskProgressStatus.FAILED;
      progress.completionPercentage = 0;
      progress.startedAt = progress.startedAt ?? now;
      progress.completedAt = now;
      progress.resultPassed = false;
      progress.resultRecordedAt = now;
      progress.updatedBy = actorId;
      await this.taskProgressRepository.save(progress);
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
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(normalizedCourseId);

    const unlockMode = this.normalizeTaskUnlockMode(body?.unlockMode);
    const gradingMode = this.normalizeTaskGradingMode(body?.gradingMode);
    const workMode = this.normalizeTaskWorkMode(body?.workMode);
    const maxPoints = this.parseTaskAssessmentNumber(body?.maxPoints, 'maxPoints');
    const passThreshold = this.parseTaskAssessmentNumber(
      body?.passThreshold,
      'passThreshold',
      { max: 100 },
    );
    const prerequisiteTaskId = this.normalizeTaskPrerequisite(
      body?.prerequisiteTaskId,
    );
    const externalTaskId = body?.externalTaskId
      ? String(body.externalTaskId).trim()
      : randomUUID();
    if (!externalTaskId) {
      throw new ApiValidationError('External task id must not be empty');
    }
    this.validateTaskGradingConfiguration(gradingMode, maxPoints, passThreshold);

    await this.validateTaskConfiguration(
      normalizedCourseId,
      undefined,
      unlockMode,
      prerequisiteTaskId,
      version.id,
    );
    const taskServiceTask = await this.createTaskContent({
      id: externalTaskId,
      ...this.buildTaskServicePayload({
        ...body,
        title: this.requireTaskTitle(body?.title),
        maxPoints,
        passThreshold,
        gradingMode,
      }),
    });

    const task = new Task();
    task.externalTaskId = taskServiceTask.id;
    task.courseId = normalizedCourseId;
    task.course = { id: normalizedCourseId } as Course;
    task.courseRunId = currentRun.id;
    task.courseRun = currentRun;
    task.courseVersionId = version.id;
    task.courseVersion = version;
    task.order = this.parseTaskOrder(body?.order);
    task.unlockMode = unlockMode;
    task.prerequisiteTaskId = prerequisiteTaskId;
    task.gradingMode = gradingMode;
    task.workMode = workMode;
    task.maxPoints = maxPoints;
    task.passThreshold = passThreshold;
    task.feedbackRequired = body?.feedbackRequired === true;
    task.allowRetries = body?.allowRetries === true;
    task.isPublished = body?.isPublished === true;
    task.createdBy = actorId;
    task.updatedBy = actorId;

    const savedTask = this.applyTaskServiceContent(
      await this.taskRepository.save(task),
      taskServiceTask,
    );
    await this.refreshCourseVersionContent(savedTask.courseVersionId);
    await this.recordAuditEvent({
      eventType: AuditEventType.TASK_CREATED,
      actorUserId: actorId,
      courseId: savedTask.courseId,
      courseRunId: savedTask.courseRunId,
      courseVersionId: savedTask.courseVersionId,
      entityType: 'task',
      entityId: savedTask.id,
      summary: `Aufgabe erstellt: ${savedTask.title}`,
      metadataJson: {
        gradingMode: savedTask.gradingMode,
        workMode: savedTask.workMode,
        unlockMode: savedTask.unlockMode,
        published: savedTask.isPublished,
        externalTaskId: savedTask.externalTaskId,
      },
    });

    return mapLearningTaskToDto(savedTask);
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
    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(normalizedCourseId);
    const taskReferences = await this.taskRepository.find({
      where: {
        courseId: normalizedCourseId,
        courseRunId: currentRun.id,
        courseVersionId: version.id,
      },
      order: { order: 'ASC' },
    });
    const tasks = await this.enrichTaskReferences(taskReferences);

    return tasks
      .filter((task) => canManage || task.isPublished)
      .map(mapLearningTaskToDto);
  }

  async getTasksByCourseRun(
    courseId: string | number,
    runId: string,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const run = await this.assertCourseRunManageable(
      normalizedCourseId,
      runId,
      actorUserId,
    );
    const version = await this.getActiveCourseVersionForRunOrThrow(
      normalizedCourseId,
      run.id,
    );
    const taskReferences = await this.taskRepository.find({
      where: {
        courseId: normalizedCourseId,
        courseRunId: run.id,
        courseVersionId: version.id,
      },
      order: { order: 'ASC' },
    });
    const tasks = await this.enrichTaskReferences(taskReferences);

    return tasks.map(mapLearningTaskToDto);
  }

  async getTasksByCourseVersion(
    courseId: string | number,
    runId: string,
    versionId: string,
    actorUserId?: string | number,
  ): Promise<LearningTaskResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const run = await this.assertCourseRunManageable(
      normalizedCourseId,
      runId,
      actorUserId,
    );
    const version = await this.findCourseVersionInRunOrThrow(
      normalizedCourseId,
      run.id,
      versionId,
    );
    const taskReferences = await this.taskRepository.find({
      where: {
        courseId: normalizedCourseId,
        courseRunId: run.id,
        courseVersionId: version.id,
      },
      order: { order: 'ASC' },
    });
    const tasks = await this.enrichTaskReferences(taskReferences);

    return tasks.map(mapLearningTaskToDto);
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
    const gradingMode =
      body.gradingMode !== undefined
        ? this.normalizeTaskGradingMode(body.gradingMode, task.gradingMode)
        : task.gradingMode ?? TaskGradingMode.NOT_GRADED;
    const workMode =
      body.workMode !== undefined
        ? this.normalizeTaskWorkMode(body.workMode, task.workMode)
        : task.workMode ?? TaskWorkMode.INDIVIDUAL;
    const maxPoints =
      body.maxPoints !== undefined
        ? this.parseTaskAssessmentNumber(body.maxPoints, 'maxPoints')
        : (task.maxPoints === undefined || task.maxPoints === null ? null : Number(task.maxPoints));
    const passThreshold =
      body.passThreshold !== undefined
        ? this.parseTaskAssessmentNumber(body.passThreshold, 'passThreshold', { max: 100 })
        : (task.passThreshold === undefined || task.passThreshold === null ? null : Number(task.passThreshold));
    const prerequisiteTaskId =
      body.prerequisiteTaskId !== undefined
        ? this.normalizeTaskPrerequisite(body.prerequisiteTaskId)
        : task.prerequisiteTaskId;
    this.validateTaskGradingConfiguration(gradingMode, maxPoints, passThreshold);

    await this.validateTaskConfiguration(
      task.courseId,
      task.id,
      unlockMode,
      prerequisiteTaskId,
      task.courseVersionId,
    );
    const shouldUpdateTaskContent = [
      body.title,
      body.description,
      body.type,
      body.content,
      body.completionCriteria,
      body.maxPoints,
      body.passThreshold,
      body.gradingMode,
    ].some((value) => value !== undefined);
    const taskServiceTask = shouldUpdateTaskContent
      ? await this.updateTaskContent(task.externalTaskId, {
        ...this.buildTaskServicePayload({
          ...body,
          maxPoints,
          passThreshold,
          gradingMode,
        }, task),
      }, task)
      : null;

    if (body.order !== undefined) {
      task.order = this.parseTaskOrder(body.order);
    }

    if (body.gradingMode !== undefined) {
      task.gradingMode = gradingMode;
    }

    if (body.workMode !== undefined) {
      task.workMode = workMode;
    }

    if (body.maxPoints !== undefined) {
      task.maxPoints = maxPoints;
    }

    if (body.passThreshold !== undefined) {
      task.passThreshold = passThreshold;
    }

    if (body.feedbackRequired !== undefined) {
      task.feedbackRequired = body.feedbackRequired === true;
    }

    if (body.allowRetries !== undefined) {
      task.allowRetries = body.allowRetries === true;
    }

    if (body.isPublished !== undefined) {
      task.isPublished = body.isPublished === true;
    }

    task.unlockMode = unlockMode;
    task.gradingMode = gradingMode;
    task.workMode = workMode;
    task.maxPoints = maxPoints;
    task.passThreshold = passThreshold;
    task.prerequisiteTaskId = prerequisiteTaskId;
    task.updatedBy = actorId;

    const savedTask = this.applyTaskServiceContent(
      await this.taskRepository.save(task),
      taskServiceTask,
    );
    await this.reconcileTaskProgressAfterConfigurationChange(savedTask);
    await this.refreshCourseVersionContent(savedTask.courseVersionId);
    await this.recordAuditEvent({
      eventType: AuditEventType.TASK_UPDATED,
      actorUserId: actorId,
      courseId: savedTask.courseId,
      courseRunId: savedTask.courseRunId,
      courseVersionId: savedTask.courseVersionId,
      entityType: 'task',
      entityId: savedTask.id,
      summary: `Aufgabe aktualisiert: ${savedTask.title}`,
      metadataJson: {
        gradingMode: savedTask.gradingMode,
        workMode: savedTask.workMode,
        unlockMode: savedTask.unlockMode,
        published: savedTask.isPublished,
      },
    });

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

    const { run: currentRun, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(normalizedCourseId);
    const tasks = await this.taskRepository.find({
      where: {
        courseId: normalizedCourseId,
        courseRunId: currentRun.id,
        courseVersionId: version.id,
        id: In(body.items.map((item) => String(item.id ?? ''))),
      },
    });
    const tasksById = new Map<string, Task>(tasks.map((task: Task) => [task.id, task]));

    for (const item of body.items) {
      const task = item.id ? tasksById.get(item.id) : undefined;

      if (!task) {
        throw new ApiValidationError('All tasks must belong to the course');
      }

      task.order = this.parseTaskOrder(item.order);
      task.updatedBy = actorId;
    }

    const savedTasks = await this.taskRepository.save(tasks);
    await this.refreshCourseVersionContent(version.id);
    await this.recordAuditEvent({
      eventType: AuditEventType.TASK_UPDATED,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: currentRun.id,
      courseVersionId: version.id,
      entityType: 'task_sort_order',
      entityId: normalizedCourseId,
      summary: 'Sortierung der Aufgaben aktualisiert',
      metadataJson: {
        taskIds: savedTasks.map((task) => task.id),
      },
    });

    const enrichedTasks = await this.enrichTaskReferences(savedTasks);

    return enrichedTasks.sort((a, b) => a.order - b.order).map(mapLearningTaskToDto);
  }

  async deleteTask(
    id: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const task = await this.findLearningTaskOrThrow(id);
    await this.assertTaskManageable(task, actorUserId);

    const dependentTask = await this.taskRepository.findOne({
      where: {
        prerequisiteTaskId: task.id,
        ...(task.courseVersionId ? { courseVersionId: task.courseVersionId } : {}),
      },
    });

    if (dependentTask) {
      throw new ApiValidationError(
        'Task cannot be deleted while another task depends on it',
      );
    }

    await this.taskRepository.delete(id);
    const remainingReferences = await this.taskRepository.count({
      where: { externalTaskId: task.externalTaskId },
    });

    if (remainingReferences === 0) {
      await this.deleteTaskContent(task.externalTaskId);
    }

    await this.refreshCourseVersionContent(task.courseVersionId);
    await this.recordAuditEvent({
      eventType: AuditEventType.TASK_DELETED,
      actorUserId: actorUserId === undefined ? undefined : this.toUserId(actorUserId),
      courseId: task.courseId,
      courseRunId: task.courseRunId,
      courseVersionId: task.courseVersionId,
      entityType: 'task',
      entityId: task.id,
      summary: `Aufgabe gelöscht: ${task.title}`,
    });
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

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) === TaskWorkMode.GROUP) {
      return this.startGroupLearningTask(taskId, actorUserId);
    }

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

    if (progress.status === TaskProgressStatus.SUBMITTED) {
      throw new ApiValidationError('Diese Aufgabe wurde bereits abgegeben und wartet auf Bewertung.');
    }

    if (progress.status === TaskProgressStatus.FAILED && task.allowRetries !== true) {
      throw new ApiValidationError('Diese Aufgabe kann nicht erneut versucht werden.');
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
      await this.recordAuditEvent({
        eventType: AuditEventType.TASK_STARTED,
        actorUserId: actorId,
        actorRole: CourseMemberRole.STUDENT,
        courseId: task.courseId,
        courseRunId: task.courseRunId,
        courseVersionId: task.courseVersionId,
        entityType: 'task_progress',
        entityId: progress.id,
        summary: `Aufgabe gestartet: ${task.title}`,
        metadataJson: {
          taskId: task.id,
          studentId: enrollment.userId,
          status: progress.status,
        },
      });
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
    const gradingMode = task.gradingMode ?? TaskGradingMode.NOT_GRADED;
    let actorMayManage = false;

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) === TaskWorkMode.GROUP) {
      throw new ApiValidationError(
        'Gruppenaufgaben werden über Gruppenfortschritt und Gruppenbewertung abgeschlossen.',
      );
    }

    if (actorUserId !== undefined && actorUserId !== null) {
      const actorId = this.requireActorUserId(actorUserId);

      if (actorId !== normalizedStudentId) {
        await this.assertTaskManageable(task, actorId);
        actorMayManage = true;
      } else {
        await this.assertTaskReadable(task, actorId);
      }
    }

    if (!actorMayManage) {
      if (!passed) {
        throw new ApiForbiddenError(
          'Studierende dürfen Bewertungsergebnisse nicht direkt auf nicht bestanden setzen.',
          'TASK_ASSESSMENT_DENIED',
        );
      }

      if (
        gradingMode !== TaskGradingMode.NOT_GRADED &&
        gradingMode !== TaskGradingMode.SELF_CONFIRMATION
      ) {
        throw new ApiForbiddenError(
          'Diese Aufgabe muss abgegeben oder bewertet werden.',
          'TASK_ASSESSMENT_DENIED',
        );
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
      (gradingMode === TaskGradingMode.NOT_GRADED || progress.resultPassed === true)
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
    progress.resultPassed = gradingMode === TaskGradingMode.NOT_GRADED ? undefined : passed;
    progress.resultRecordedAt = now;
    progress.updatedBy = actorUserId ? this.toUserId(actorUserId) : 'system';

    await this.taskProgressRepository.save(progress);

    if (gradingMode === TaskGradingMode.SELF_CONFIRMATION) {
      const assessment = await this.ensureTaskAssessment(task, enrollment);
      assessment.status = TaskAssessmentStatus.PASSED;
      assessment.passed = true;
      assessment.assessedBy = normalizedStudentId;
      assessment.assessedAt = now;
      await this.saveTaskAssessment(assessment);
    }

    if (passed) {
      await this.unlockEligibleNextTasks(task, enrollment);
    }

    await this.recordAuditEvent({
      eventType: passed ? AuditEventType.TASK_COMPLETED : AuditEventType.TASK_FAILED,
      actorUserId: actorUserId ? this.toUserId(actorUserId) : normalizedStudentId,
      courseId: task.courseId,
      courseRunId: task.courseRunId,
      courseVersionId: task.courseVersionId,
      entityType: 'task_progress',
      entityId: progress.id,
      summary: `${passed ? 'Aufgabe abgeschlossen' : 'Aufgabe nicht bestanden'}: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        studentId: enrollment.userId,
        gradingMode,
      },
    });

    return this.buildLearningPathForEnrollment(task.courseId, enrollment);
  }

  async selfConfirmLearningTask(
    taskId: string,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const task = await this.findLearningTaskOrThrow(taskId);
    const gradingMode = task.gradingMode ?? TaskGradingMode.NOT_GRADED;

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) === TaskWorkMode.GROUP) {
      throw new ApiValidationError(
        'Gruppenaufgaben können nicht individuell per Selbstbestätigung abgeschlossen werden.',
      );
    }

    if (
      gradingMode !== TaskGradingMode.NOT_GRADED &&
      gradingMode !== TaskGradingMode.SELF_CONFIRMATION
    ) {
      throw new ApiForbiddenError(
        'Diese Aufgabe darf nicht per Selbstbestätigung abgeschlossen werden.',
        'TASK_ASSESSMENT_DENIED',
      );
    }

    const actorId = this.requireActorUserId(actorUserId);

    return this.recordTaskResult(actorId, taskId, true, actorId);
  }

  async submitLearningTask(
    taskId: string,
    body: SubmitLearningTaskDto = {},
    actorUserId?: string | number,
    options: { allowStoredSubmissionFile?: boolean } = {},
  ): Promise<LearningPathResponseDto> {
    const task = await this.findLearningTaskOrThrow(taskId);

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) === TaskWorkMode.GROUP) {
      return this.submitGroupLearningTask(taskId, body, actorUserId, options);
    }

    await this.assertTaskReadable(task, actorUserId);
    const actorId = this.requireActorUserId(actorUserId);
    const enrollment = await this.assertCurrentStudentEnrollment(task.courseId, actorId);
    const gradingMode = task.gradingMode ?? TaskGradingMode.NOT_GRADED;

    if (gradingMode === TaskGradingMode.AUTOMATIC_MOCK) {
      return this.mockEvaluateLearningTask(taskId, {
        submissionData: body.submissionData,
      }, actorId);
    }

    if (gradingMode !== TaskGradingMode.MANUAL) {
      throw new ApiValidationError(
        'Nur manuell bewertete Aufgaben werden abgegeben. Nutze bei dieser Aufgabe die passende Abschlussaktion.',
      );
    }

    const progress = await this.ensureTaskProgress(task, enrollment, actorId);

    if (progress.status === TaskProgressStatus.LOCKED) {
      throw new ApiForbiddenError('Task is locked', 'TASK_LOCKED');
    }

    if (
      (progress.status === TaskProgressStatus.COMPLETED ||
        progress.status === TaskProgressStatus.FAILED) &&
      task.allowRetries !== true
    ) {
      throw new ApiValidationError('Diese Aufgabe kann nicht erneut abgegeben werden.');
    }

    const assessment = await this.ensureTaskAssessment(task, enrollment);
    const previousFile = this.extractTaskSubmissionFile(assessment.submissionData);
    const submissionData = this.normalizeTaskSubmissionData(body.submissionData, {
      allowStorageKey: options.allowStoredSubmissionFile === true,
    });

    if (
      body.keepExistingFile === true &&
      previousFile &&
      !this.extractTaskSubmissionFile(submissionData)
    ) {
      submissionData.file = previousFile;
    }

    assessment.status = TaskAssessmentStatus.PENDING_REVIEW;
    assessment.passed = null;
    assessment.points = null;
    assessment.feedback = null;
    assessment.submissionData = submissionData;
    assessment.assessedBy = null;
    assessment.assessedAt = null;
    await this.saveTaskAssessment(assessment);
    await this.deleteReplacedTaskSubmissionFile(
      task.courseId,
      previousFile,
      this.extractTaskSubmissionFile(submissionData),
    );
    await this.applyAssessmentToProgress(task, enrollment, assessment, actorId);
    await this.recordAuditEvent({
      eventType: AuditEventType.ASSESSMENT_SUBMITTED,
      actorUserId: actorId,
      actorRole: CourseMemberRole.STUDENT,
      courseId: task.courseId,
      courseRunId: task.courseRunId,
      courseVersionId: task.courseVersionId,
      entityType: 'task_assessment',
      entityId: assessment.id,
      summary: `Aufgabe abgegeben: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        studentId: enrollment.userId,
        status: assessment.status,
      },
    });
    await this.recordAuditEvent({
      eventType: AuditEventType.TASK_SUBMITTED,
      actorUserId: actorId,
      actorRole: CourseMemberRole.STUDENT,
      courseId: task.courseId,
      courseRunId: task.courseRunId,
      courseVersionId: task.courseVersionId,
      entityType: 'task_progress',
      entityId: task.id,
      summary: `Aufgabe wartet auf Bewertung: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        studentId: enrollment.userId,
      },
    });

    return this.buildLearningPathForEnrollment(task.courseId, enrollment);
  }

  async submitLearningTaskWithUpload(
    taskId: string,
    body: SubmitLearningTaskDto & Record<string, unknown> = {},
    file: UploadedLearningMaterialFile | undefined,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const task = await this.findLearningTaskOrThrow(taskId);
    let storedStorageKey: string | undefined;

    try {
      const upload = await this.buildTaskSubmissionDataFromUpload(
        task.courseId,
        body,
        file,
      );
      storedStorageKey = upload.storageKey;

      return await this.submitLearningTask(
        taskId,
        {
          keepExistingFile: this.parseBooleanLike(body.keepExistingFile),
          submissionData: upload.submissionData,
        },
        actorUserId,
        {
          allowStoredSubmissionFile: true,
        },
      );
    } catch (error) {
      if (storedStorageKey) {
        await this.materialStorage.deleteFile(task.courseId, storedStorageKey);
      }

      throw error;
    }
  }

  async downloadTaskSubmissionFile(
    assessmentId: string,
    actorUserId?: string | number,
  ): Promise<LearningMaterialDownload> {
    const actorId = this.requireActorUserId(actorUserId);
    const assessment = await this.taskAssessmentRepository.findOne({
      where: { id: assessmentId },
      relations: ['task'],
    });

    if (!assessment) {
      throw new ApiNotFoundError('Task assessment not found', 'TASK_NOT_FOUND');
    }

    const task = assessment.task ?? (await this.findLearningTaskOrThrow(assessment.taskId));
    const role = await this.assertCoursePermission(
      task.courseId,
      actorId,
      CoursePermission.ReadCourseContent,
    );

    if (!hasCoursePermission(role, CoursePermission.ReadAllResults)) {
      if (assessment.assessmentTargetType === TaskAssessmentTargetType.GROUP) {
        const group = await this.assertStudentStudyGroupInRun(
          task.courseId,
          assessment.courseRunId,
          actorId,
        );

        if (group.id !== assessment.groupId) {
          throw new ApiForbiddenError(
            'You may only access your own task submissions',
            'TASK_ASSESSMENT_DENIED',
          );
        }
      } else if (assessment.studentId !== actorId) {
        throw new ApiForbiddenError(
          'You may only access your own task submissions',
          'TASK_ASSESSMENT_DENIED',
        );
      }
    }

    const fileData = this.extractTaskSubmissionFile(assessment.submissionData);

    if (!fileData?.storageKey) {
      throw new ApiValidationError('This assessment does not contain a downloadable submission file');
    }

    const file = this.materialStorage.openFile(task.courseId, fileData.storageKey);

    return {
      fileName: fileData.originalFileName ?? 'aufgabenabgabe',
      fileSize: fileData.fileSize,
      mimeType: fileData.mimeType ?? 'application/octet-stream',
      stream: file.stream,
    };
  }

  async mockEvaluateLearningTask(
    taskId: string,
    body: MockEvaluateLearningTaskDto = {},
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    return this.assessmentService.mockEvaluateLearningTask(taskId, body, actorUserId);
  }

  async completeLearningTask(
    taskId: string,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    return this.selfConfirmLearningTask(taskId, actorUserId);
  }

  async failLearningTask(
    taskId: string,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const actorId = this.requireActorUserId(actorUserId);
    const task = await this.findLearningTaskOrThrow(taskId);
    await this.assertTaskManageable(task, actorId);

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) === TaskWorkMode.GROUP) {
      throw new ApiValidationError(
        'Gruppenaufgaben werden über Gruppenbewertungen als nicht bestanden markiert.',
      );
    }

    return this.recordTaskResult(actorId, taskId, false, actorId);
  }

  async setManualTaskAssessment(
    courseId: string | number,
    runId: string,
    taskId: string,
    studentId: string | number,
    body: ManualTaskAssessmentDto,
    actorUserId?: string | number,
  ): Promise<TaskAssessmentResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    const run = await this.assertCourseRunManageable(normalizedCourseId, runId, actorId);
    const activeVersion = await this.getActiveCourseVersionForRunOrThrow(
      normalizedCourseId,
      run.id,
    );
    const task = await this.findLearningTaskOrThrow(taskId);

    if (
      task.courseId !== normalizedCourseId ||
      task.courseRunId !== run.id ||
      task.courseVersionId !== activeVersion.id
    ) {
      throw new ApiValidationError(
        'Die Aufgabe gehört nicht zur aktiven Inhaltsversion dieses Kursdurchlaufs.',
      );
    }

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) === TaskWorkMode.GROUP) {
      throw new ApiValidationError('Gruppenaufgaben müssen als Gruppe bewertet werden.');
    }

    if ((task.gradingMode ?? TaskGradingMode.NOT_GRADED) !== TaskGradingMode.MANUAL) {
      throw new ApiValidationError('Nur manuell bewertete Aufgaben können manuell bewertet werden.');
    }

    const enrollment = await this.findStudentEnrollmentForRunOrThrow(
      normalizedCourseId,
      studentId,
      run.id,
    );
    const maxPoints = body.maxPoints !== undefined
      ? this.parseTaskAssessmentNumber(body.maxPoints, 'maxPoints', { required: true })
      : this.parseTaskAssessmentNumber(task.maxPoints, 'maxPoints', { required: true });
    const points = body.points !== undefined
      ? this.parseTaskAssessmentNumber(body.points, 'points', {
        required: true,
        max: maxPoints ?? undefined,
      })
      : null;
    const passThreshold = task.passThreshold ?? TASK_PASS_THRESHOLD_PERCENT;
    const calculatedPassed = points !== null
      ? calculateTaskAssessmentPassed(points, maxPoints, passThreshold)
      : null;
    const passed = body.passed ?? calculatedPassed;

    if (passed === null || passed === undefined) {
      throw new ApiValidationError('Eine manuelle Bewertung benötigt bestanden/nicht bestanden oder Punkte.');
    }

    const assessment = await this.ensureTaskAssessment(task, enrollment);
    assessment.status = passed ? TaskAssessmentStatus.PASSED : TaskAssessmentStatus.FAILED;
    assessment.points = points;
    assessment.maxPoints = maxPoints;
    assessment.passThreshold = passThreshold;
    assessment.passed = passed;
    assessment.feedback = body.feedback === undefined || body.feedback === null
      ? null
      : String(body.feedback).trim();
    assessment.assessedBy = actorId;
    assessment.assessedAt = new Date();
    await this.saveTaskAssessment(assessment);
    await this.applyAssessmentToProgress(task, enrollment, assessment, actorId);
    await this.recordAuditEvent({
      eventType: AuditEventType.ASSESSMENT_MANUALLY_GRADED,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: run.id,
      courseVersionId: task.courseVersionId,
      entityType: 'task_assessment',
      entityId: assessment.id,
      summary: `Aufgabe manuell bewertet: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        studentId: enrollment.userId,
        points: assessment.points,
        maxPoints: assessment.maxPoints,
        passed: assessment.passed,
      },
    });
    await this.recordAuditEvent({
      eventType: passed ? AuditEventType.TASK_COMPLETED : AuditEventType.TASK_FAILED,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: run.id,
      courseVersionId: task.courseVersionId,
      entityType: 'task_progress',
      entityId: task.id,
      summary: `${passed ? 'Aufgabe bestanden' : 'Aufgabe nicht bestanden'}: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        studentId: enrollment.userId,
      },
    });

    return mapTaskAssessmentToDto(assessment);
  }

  async resetTaskAssessment(
    courseId: string | number,
    runId: string,
    taskId: string,
    studentId: string | number,
    actorUserId?: string | number,
  ): Promise<TaskAssessmentResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    const run = await this.assertCourseRunManageable(normalizedCourseId, runId, actorId);
    const activeVersion = await this.getActiveCourseVersionForRunOrThrow(
      normalizedCourseId,
      run.id,
    );
    const task = await this.findLearningTaskOrThrow(taskId);

    if (
      task.courseId !== normalizedCourseId ||
      task.courseRunId !== run.id ||
      task.courseVersionId !== activeVersion.id
    ) {
      throw new ApiValidationError(
        'Die Aufgabe gehört nicht zur aktiven Inhaltsversion dieses Kursdurchlaufs.',
      );
    }

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) === TaskWorkMode.GROUP) {
      throw new ApiValidationError('Gruppenbewertungen müssen in der Gruppenansicht zurückgesetzt werden.');
    }

    if ((task.gradingMode ?? TaskGradingMode.NOT_GRADED) !== TaskGradingMode.MANUAL) {
      throw new ApiValidationError('Nur manuell bewertete Aufgaben können zurückgesetzt werden.');
    }

    const enrollment = await this.findStudentEnrollmentForRunOrThrow(
      normalizedCourseId,
      studentId,
      run.id,
    );
    const assessment = await this.findTaskAssessment(task, enrollment.userId);

    if (!assessment) {
      throw new ApiValidationError('Für diese Aufgabe liegt noch keine Bewertung vor.');
    }

    assessment.status = assessment.submissionData
      ? TaskAssessmentStatus.PENDING_REVIEW
      : TaskAssessmentStatus.NOT_SUBMITTED;
    assessment.points = null;
    assessment.passed = null;
    assessment.feedback = null;
    assessment.assessedBy = null;
    assessment.assessedAt = null;
    await this.saveTaskAssessment(assessment);

    const progress = await this.ensureTaskProgress(task, enrollment, actorId);
    const now = new Date();
    progress.status = assessment.submissionData
      ? TaskProgressStatus.SUBMITTED
      : TaskProgressStatus.IN_PROGRESS;
    progress.completionPercentage = assessment.submissionData ? 75 : 50;
    progress.startedAt = progress.startedAt ?? now;
    progress.completedAt = undefined;
    progress.resultPassed = undefined;
    progress.resultRecordedAt = undefined;
    progress.updatedBy = actorId;
    await this.taskProgressRepository.save(progress);
    await this.recordAuditEvent({
      eventType: AuditEventType.ASSESSMENT_RESET,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: run.id,
      courseVersionId: task.courseVersionId,
      entityType: 'task_assessment',
      entityId: assessment.id,
      summary: `Bewertung zurückgesetzt: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        studentId: enrollment.userId,
        status: assessment.status,
      },
    });
    await this.recordAuditEvent({
      eventType: AuditEventType.PROGRESS_UPDATED,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: run.id,
      courseVersionId: task.courseVersionId,
      entityType: 'task_progress',
      entityId: progress.id,
      summary: `Fortschritt nach Bewertungsreset aktualisiert: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        studentId: enrollment.userId,
        status: progress.status,
      },
    });

    return mapTaskAssessmentToDto(assessment);
  }

  async listTaskAssessmentsByRun(
    courseId: string | number,
    runId: string,
    actorUserId?: string | number,
  ): Promise<TaskAssessmentResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const run = await this.assertCourseRunManageable(
      normalizedCourseId,
      runId,
      actorUserId,
    );
    const assessments = await this.taskAssessmentRepository.find({
      where: {
        courseRunId: run.id,
      },
      order: {
        updatedAt: 'DESC',
      },
    });

    return assessments.map(mapTaskAssessmentToDto);
  }

  async listTaskAssessmentsByTask(
    courseId: string | number,
    runId: string,
    taskId: string,
    actorUserId?: string | number,
  ): Promise<TaskAssessmentResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const run = await this.assertCourseRunManageable(
      normalizedCourseId,
      runId,
      actorUserId,
    );
    const task = await this.findLearningTaskOrThrow(taskId);

    if (task.courseId !== normalizedCourseId || task.courseRunId !== run.id) {
      throw new ApiValidationError('Die Aufgabe gehört nicht zu diesem Kursdurchlauf.');
    }

    const assessments = await this.taskAssessmentRepository.find({
      where: {
        courseRunId: run.id,
        taskId,
      },
      order: {
        updatedAt: 'DESC',
      },
    });

    return assessments.map(mapTaskAssessmentToDto);
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

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) === TaskWorkMode.GROUP) {
      throw new ApiValidationError(
        'Gruppenaufgaben werden über die Gruppe freigeschaltet und bearbeitet.',
      );
    }

    const enrollment = await this.findStudentEnrollmentOrThrow(
      task.courseId,
      studentId,
    );
    const progress = await this.ensureTaskProgress(task, enrollment, actorId);

    if (
      progress.status === TaskProgressStatus.LOCKED ||
      (progress.status === TaskProgressStatus.AVAILABLE &&
        progress.unlockSource !== TaskUnlockSource.MANUAL)
    ) {
      progress.status = TaskProgressStatus.AVAILABLE;
      progress.completionPercentage = 0;
      progress.unlockedAt = progress.unlockedAt ?? new Date();
      progress.unlockSource = TaskUnlockSource.MANUAL;
      progress.updatedBy = actorId;
      await this.taskProgressRepository.save(progress);
      await this.recordAuditEvent({
        eventType: AuditEventType.PROGRESS_UPDATED,
        actorUserId: actorId,
        courseId: task.courseId,
        courseRunId: task.courseRunId,
        courseVersionId: task.courseVersionId,
        entityType: 'task_progress',
        entityId: progress.id,
        summary: `Aufgabe manuell freigeschaltet: ${task.title}`,
        metadataJson: {
          taskId: task.id,
          studentId: enrollment.userId,
          status: progress.status,
          unlockSource: progress.unlockSource,
        },
      });
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

  private async buildLearningTaskProgressOverviewForRun(
    courseId: string,
    runId: string,
  ): Promise<StudentProgressOverviewDto[]> {
    const enrollments = await this.enrollmentRepository.find({
      where: {
        courseId,
        courseRunId: runId,
        role: CourseMemberRole.STUDENT,
      },
      order: { userId: 'ASC' },
    });
    const overview: StudentProgressOverviewDto[] = [];

    for (const enrollment of enrollments) {
      overview.push(await this.buildStudentProgressOverview(courseId, enrollment));
    }

    return overview;
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
    const currentRun = await this.getCurrentCourseRunOrCreate(normalizedCourseId);

    return this.buildLearningTaskProgressOverviewForRun(
      normalizedCourseId,
      currentRun.id,
    );
  }

  async getLearningTaskProgressOverviewByRun(
    courseId: string | number,
    runId: string,
    actorUserId?: string | number,
  ): Promise<StudentProgressOverviewDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const run = await this.assertCourseRunManageable(
      normalizedCourseId,
      runId,
      actorUserId,
    );

    return this.buildLearningTaskProgressOverviewForRun(
      normalizedCourseId,
      run.id,
    );
  }

  async createStudyGroup(
    courseId: string | number,
    runId: string,
    body: CreateStudyGroupDto,
    actorUserId?: string | number,
  ): Promise<StudyGroupResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    const run = await this.assertCourseRunManageable(normalizedCourseId, runId, actorId);
    const group = new CourseGroup();
    group.course_id = normalizedCourseId;
    group.course_run_id = run.id;
    group.name = this.normalizeStudyGroupName(body?.name);
    group.description = this.normalizeStudyGroupDescription(body?.description);
    group.group_type = 'WORKGROUP' as any;
    group.is_active = true;
    group.created_by = actorId;
    group.updated_by = actorId;

    const savedGroup = await this.courseGroupRepository.save(group);
    await this.recordAuditEvent({
      eventType: AuditEventType.PROGRESS_UPDATED,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: run.id,
      entityType: 'study_group',
      entityId: savedGroup.id,
      summary: `Gruppe erstellt: ${savedGroup.name}`,
    });

    return mapStudyGroupToDto({ ...savedGroup, memberships: [] } as CourseGroup);
  }

  async listStudyGroups(
    courseId: string | number,
    runId: string,
    actorUserId?: string | number,
  ): Promise<StudyGroupResponseDto[]> {
    const normalizedCourseId = this.toCourseId(courseId);
    const run = await this.assertCourseRunManageable(
      normalizedCourseId,
      runId,
      actorUserId,
    );
    const groups = await this.courseGroupRepository.find({
      where: {
        course_id: normalizedCourseId,
        course_run_id: run.id,
      },
      relations: ['memberships'],
      order: { name: 'ASC' },
    });
    const dtos: StudyGroupResponseDto[] = [];

    for (const group of groups) {
      dtos.push(mapStudyGroupToDto(group, await this.loadGroupTaskProgressDtos(group)));
    }

    return dtos;
  }

  async getMyStudyGroup(
    courseId: string | number,
    runId: string,
    actorUserId?: string | number,
  ): Promise<StudyGroupResponseDto | null> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    await this.assertCourseRunReadable(normalizedCourseId, runId, actorId);
    await this.findStudentEnrollmentForRunOrThrow(normalizedCourseId, actorId, runId);
    const group = await this.findStudentStudyGroupInRun(runId, actorId);

    if (!group || group.course_id !== normalizedCourseId) {
      return null;
    }

    return mapStudyGroupToDto(group, await this.loadGroupTaskProgressDtos(group));
  }

  async updateStudyGroup(
    courseId: string | number,
    runId: string,
    groupId: string,
    body: UpdateStudyGroupDto,
    actorUserId?: string | number,
  ): Promise<StudyGroupResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    const run = await this.assertCourseRunManageable(normalizedCourseId, runId, actorId);
    const group = await this.findStudyGroupInRunOrThrow(
      normalizedCourseId,
      run.id,
      groupId,
      ['memberships'],
    );

    if (body.name !== undefined) {
      group.name = this.normalizeStudyGroupName(body.name);
    }

    if (body.description !== undefined) {
      group.description = this.normalizeStudyGroupDescription(body.description);
    }

    group.updated_by = actorId;
    const savedGroup = await this.courseGroupRepository.save(group);
    await this.recordAuditEvent({
      eventType: AuditEventType.PROGRESS_UPDATED,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: run.id,
      entityType: 'study_group',
      entityId: savedGroup.id,
      summary: `Gruppe aktualisiert: ${savedGroup.name}`,
    });

    return mapStudyGroupToDto(savedGroup, await this.loadGroupTaskProgressDtos(savedGroup));
  }

  async deleteStudyGroup(
    courseId: string | number,
    runId: string,
    groupId: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    const run = await this.assertCourseRunManageable(normalizedCourseId, runId, actorId);
    const group = await this.findStudyGroupInRunOrThrow(
      normalizedCourseId,
      run.id,
      groupId,
      ['memberships'],
    );
    const [progress, assessments] = await Promise.all([
      this.getGroupTaskProgressRepository().find({
        where: { courseRunId: run.id, groupId: group.id },
      }),
      this.taskAssessmentRepository.find({
        where: {
          courseRunId: run.id,
          assessmentTargetType: TaskAssessmentTargetType.GROUP,
          groupId: group.id,
        },
      }),
    ]);

    if (progress.length > 0 || assessments.length > 0) {
      throw new ApiValidationError(
        'Diese Gruppe kann nicht gelöscht werden, da bereits Fortschritt oder Bewertungen vorhanden sind.',
      );
    }

    await this.courseGroupRepository.delete(group.id);
    await this.recordAuditEvent({
      eventType: AuditEventType.PROGRESS_UPDATED,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: run.id,
      entityType: 'study_group',
      entityId: group.id,
      summary: `Gruppe gelöscht: ${group.name}`,
    });
  }

  async addStudyGroupMember(
    courseId: string | number,
    runId: string,
    groupId: string,
    body: AddStudyGroupMemberDto,
    actorUserId?: string | number,
  ): Promise<StudyGroupResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    const run = await this.assertCourseRunManageable(normalizedCourseId, runId, actorId);
    const studentId = body?.studentId;

    if (studentId === undefined || studentId === null || studentId === '') {
      throw new ApiValidationError('Student ID is required');
    }

    const group = await this.findStudyGroupInRunOrThrow(
      normalizedCourseId,
      run.id,
      groupId,
      ['memberships'],
    );
    await this.findStudentEnrollmentForRunOrThrow(normalizedCourseId, studentId, run.id);
    const existingGroup = await this.findStudentStudyGroupInRun(run.id, studentId);

    if (existingGroup && existingGroup.id !== group.id) {
      throw new ApiValidationError(
        'Ein Studierender kann in einem Kursdurchlauf nur einer Gruppe angehören.',
      );
    }

    if (!group.memberships?.some((membership) => membership.user_id === this.toUserId(studentId))) {
      const membership = new GroupMembership();
      membership.group_id = group.id;
      membership.group = group;
      membership.user_id = this.toUserId(studentId);
      membership.role = MembershipRole.MEMBER;
      membership.joined_at = new Date();
      membership.left_at = null;
      membership.added_by = actorId;
      const savedMembership = await this.groupMembershipRepository.save(membership);
      group.memberships = [...(group.memberships ?? []), savedMembership];
    }

    const updatedGroup = await this.findStudyGroupInRunOrThrow(
      normalizedCourseId,
      run.id,
      group.id,
      ['memberships'],
    );
    await this.recordAuditEvent({
      eventType: AuditEventType.PROGRESS_UPDATED,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: run.id,
      entityType: 'study_group_member',
      entityId: group.id,
      summary: `Studierende:r ${this.toUserId(studentId)} Gruppe ${group.name} zugeordnet`,
      metadataJson: { studentId: this.toUserId(studentId) },
    });

    return mapStudyGroupToDto(updatedGroup, await this.loadGroupTaskProgressDtos(updatedGroup));
  }

  async removeStudyGroupMember(
    courseId: string | number,
    runId: string,
    groupId: string,
    studentId: string | number,
    actorUserId?: string | number,
  ): Promise<StudyGroupResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    const run = await this.assertCourseRunManageable(normalizedCourseId, runId, actorId);
    const group = await this.findStudyGroupInRunOrThrow(
      normalizedCourseId,
      run.id,
      groupId,
      ['memberships'],
    );
    await this.groupMembershipRepository.delete({
      group_id: group.id,
      user_id: this.toUserId(studentId),
    });
    group.memberships = (group.memberships ?? []).filter(
      (membership) => membership.user_id !== this.toUserId(studentId),
    );
    const updatedGroup = await this.findStudyGroupInRunOrThrow(
      normalizedCourseId,
      run.id,
      group.id,
      ['memberships'],
    );
    await this.recordAuditEvent({
      eventType: AuditEventType.PROGRESS_UPDATED,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: run.id,
      entityType: 'study_group_member',
      entityId: group.id,
      summary: `Studierende:r ${this.toUserId(studentId)} aus Gruppe ${group.name} entfernt`,
      metadataJson: { studentId: this.toUserId(studentId) },
    });

    return mapStudyGroupToDto(updatedGroup, await this.loadGroupTaskProgressDtos(updatedGroup));
  }

  async startGroupLearningTask(
    taskId: string,
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const task = await this.findLearningTaskOrThrow(taskId);

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) !== TaskWorkMode.GROUP) {
      return this.startLearningTask(taskId, actorUserId);
    }

    await this.assertTaskReadable(task, actorUserId);
    const actorId = this.requireActorUserId(actorUserId);
    const enrollment = await this.findStudentEnrollmentForRunOrThrow(
      task.courseId,
      actorId,
      task.courseRunId,
    );
    const group = await this.assertStudentStudyGroupInRun(task.courseId, task.courseRunId, actorId);
    const memberProgress = await this.ensureTaskProgress(task, enrollment, actorId);

    if (memberProgress.status === TaskProgressStatus.LOCKED) {
      throw new ApiForbiddenError('Task is locked', 'TASK_LOCKED');
    }

    const groupProgress = await this.ensureGroupTaskProgress(task, group, actorId);

    if (groupProgress.status === TaskProgressStatus.SUBMITTED) {
      throw new ApiValidationError('Diese Gruppenaufgabe wurde bereits abgegeben und wartet auf Bewertung.');
    }

    if (groupProgress.status === TaskProgressStatus.FAILED && task.allowRetries !== true) {
      throw new ApiValidationError('Diese Gruppenaufgabe kann nicht erneut versucht werden.');
    }

    if (
      groupProgress.status !== TaskProgressStatus.COMPLETED &&
      groupProgress.status !== TaskProgressStatus.IN_PROGRESS
    ) {
      groupProgress.status = TaskProgressStatus.IN_PROGRESS;
      groupProgress.startedAt = groupProgress.startedAt ?? new Date();
      groupProgress.updatedBy = actorId;
      const savedProgress = await this.getGroupTaskProgressRepository().save(groupProgress);
      await this.applyGroupProgressToMembers(task, group, savedProgress, null, actorId);
      await this.recordAuditEvent({
        eventType: AuditEventType.TASK_STARTED,
        actorUserId: actorId,
        actorRole: CourseMemberRole.STUDENT,
        courseId: task.courseId,
        courseRunId: task.courseRunId,
        courseVersionId: task.courseVersionId,
        entityType: 'group_task_progress',
        entityId: savedProgress.id,
        summary: `Gruppenaufgabe gestartet: ${task.title}`,
        metadataJson: {
          taskId: task.id,
          groupId: group.id,
        },
      });
    }

    return this.buildLearningPathForEnrollment(task.courseId, enrollment);
  }

  async submitGroupLearningTask(
    taskId: string,
    body: SubmitLearningTaskDto = {},
    actorUserId?: string | number,
    options: { allowStoredSubmissionFile?: boolean } = {},
  ): Promise<LearningPathResponseDto> {
    const task = await this.findLearningTaskOrThrow(taskId);

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) !== TaskWorkMode.GROUP) {
      return this.submitLearningTask(taskId, body, actorUserId, options);
    }

    await this.assertTaskReadable(task, actorUserId);
    const actorId = this.requireActorUserId(actorUserId);
    const enrollment = await this.findStudentEnrollmentForRunOrThrow(
      task.courseId,
      actorId,
      task.courseRunId,
    );
    const group = await this.assertStudentStudyGroupInRun(task.courseId, task.courseRunId, actorId);

    if ((task.gradingMode ?? TaskGradingMode.NOT_GRADED) !== TaskGradingMode.MANUAL) {
      throw new ApiValidationError('Gruppenaufgaben werden in dieser Mini-Version manuell bewertet.');
    }

    const memberProgress = await this.ensureTaskProgress(task, enrollment, actorId);

    if (memberProgress.status === TaskProgressStatus.LOCKED) {
      throw new ApiForbiddenError('Task is locked', 'TASK_LOCKED');
    }

    const groupProgress = await this.ensureGroupTaskProgress(task, group, actorId);

    if (
      (groupProgress.status === TaskProgressStatus.COMPLETED ||
        groupProgress.status === TaskProgressStatus.FAILED) &&
      task.allowRetries !== true
    ) {
      throw new ApiValidationError('Diese Gruppenaufgabe kann nicht erneut abgegeben werden.');
    }

    const assessment = await this.ensureGroupTaskAssessment(task, group);
    const previousFile = this.extractTaskSubmissionFile(assessment.submissionData);
    const submissionData = this.normalizeTaskSubmissionData(body.submissionData, {
      allowStorageKey: options.allowStoredSubmissionFile === true,
    });

    if (
      body.keepExistingFile === true &&
      previousFile &&
      !this.extractTaskSubmissionFile(submissionData)
    ) {
      submissionData.file = previousFile;
    }

    assessment.status = TaskAssessmentStatus.PENDING_REVIEW;
    assessment.passed = null;
    assessment.points = null;
    assessment.feedback = null;
    assessment.submissionData = submissionData;
    assessment.assessedBy = null;
    assessment.assessedAt = null;
    await this.saveTaskAssessment(assessment);
    await this.deleteReplacedTaskSubmissionFile(
      task.courseId,
      previousFile,
      this.extractTaskSubmissionFile(submissionData),
    );

    groupProgress.status = TaskProgressStatus.SUBMITTED;
    groupProgress.startedAt = groupProgress.startedAt ?? new Date();
    groupProgress.submittedAt = new Date();
    groupProgress.completedAt = null;
    groupProgress.progressData = submissionData;
    groupProgress.updatedBy = actorId;
    const savedProgress = await this.getGroupTaskProgressRepository().save(groupProgress);
    await this.applyGroupProgressToMembers(task, group, savedProgress, assessment, actorId);
    await this.recordAuditEvent({
      eventType: AuditEventType.ASSESSMENT_SUBMITTED,
      actorUserId: actorId,
      actorRole: CourseMemberRole.STUDENT,
      courseId: task.courseId,
      courseRunId: task.courseRunId,
      courseVersionId: task.courseVersionId,
      entityType: 'task_assessment',
      entityId: assessment.id,
      summary: `Gruppenaufgabe abgegeben: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        groupId: group.id,
      },
    });

    return this.buildLearningPathForEnrollment(task.courseId, enrollment);
  }

  async setManualGroupTaskAssessment(
    courseId: string | number,
    runId: string,
    taskId: string,
    groupId: string,
    body: ManualGroupTaskAssessmentDto,
    actorUserId?: string | number,
  ): Promise<TaskAssessmentResponseDto> {
    const normalizedCourseId = this.toCourseId(courseId);
    const actorId = this.requireActorUserId(actorUserId);
    const run = await this.assertCourseRunManageable(normalizedCourseId, runId, actorId);
    const activeVersion = await this.getActiveCourseVersionForRunOrThrow(
      normalizedCourseId,
      run.id,
    );
    const task = await this.findLearningTaskOrThrow(taskId);

    if (
      task.courseId !== normalizedCourseId ||
      task.courseRunId !== run.id ||
      task.courseVersionId !== activeVersion.id
    ) {
      throw new ApiValidationError(
        'Die Aufgabe gehört nicht zur aktiven Inhaltsversion dieses Kursdurchlaufs.',
      );
    }

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) !== TaskWorkMode.GROUP) {
      throw new ApiValidationError('Nur Gruppenaufgaben können als Gruppe bewertet werden.');
    }

    if ((task.gradingMode ?? TaskGradingMode.NOT_GRADED) !== TaskGradingMode.MANUAL) {
      throw new ApiValidationError('Nur manuell bewertete Aufgaben können manuell bewertet werden.');
    }

    const group = await this.findStudyGroupInRunOrThrow(
      normalizedCourseId,
      run.id,
      groupId,
      ['memberships'],
    );
    const maxPoints = body.maxPoints !== undefined
      ? this.parseTaskAssessmentNumber(body.maxPoints, 'maxPoints', { required: true })
      : this.parseTaskAssessmentNumber(task.maxPoints, 'maxPoints', { required: true });
    const points = body.points !== undefined
      ? this.parseTaskAssessmentNumber(body.points, 'points', {
        required: true,
        max: maxPoints ?? undefined,
      })
      : null;
    const passThreshold = task.passThreshold ?? TASK_PASS_THRESHOLD_PERCENT;
    const calculatedPassed = points !== null
      ? calculateTaskAssessmentPassed(points, maxPoints, passThreshold)
      : null;
    const passed = body.passed ?? calculatedPassed;

    if (passed === null || passed === undefined) {
      throw new ApiValidationError('Eine manuelle Gruppenbewertung benötigt bestanden/nicht bestanden oder Punkte.');
    }

    const assessment = await this.ensureGroupTaskAssessment(task, group);
    assessment.status = passed ? TaskAssessmentStatus.PASSED : TaskAssessmentStatus.FAILED;
    assessment.points = points;
    assessment.maxPoints = maxPoints;
    assessment.passThreshold = passThreshold;
    assessment.passed = passed;
    assessment.feedback = body.feedback === undefined || body.feedback === null
      ? null
      : String(body.feedback).trim();
    assessment.assessedBy = actorId;
    assessment.assessedAt = new Date();
    await this.saveTaskAssessment(assessment);

    const groupProgress = await this.ensureGroupTaskProgress(task, group, actorId);
    groupProgress.status = passed ? TaskProgressStatus.COMPLETED : TaskProgressStatus.FAILED;
    groupProgress.startedAt = groupProgress.startedAt ?? new Date();
    groupProgress.completedAt = new Date();
    groupProgress.updatedBy = actorId;
    const savedProgress = await this.getGroupTaskProgressRepository().save(groupProgress);
    await this.applyGroupProgressToMembers(task, group, savedProgress, assessment, actorId);
    await this.recordAuditEvent({
      eventType: AuditEventType.ASSESSMENT_MANUALLY_GRADED,
      actorUserId: actorId,
      courseId: normalizedCourseId,
      courseRunId: run.id,
      courseVersionId: task.courseVersionId,
      entityType: 'task_assessment',
      entityId: assessment.id,
      summary: `Gruppenaufgabe bewertet: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        groupId: group.id,
        points: assessment.points,
        maxPoints: assessment.maxPoints,
        passed: assessment.passed,
      },
    });

    return mapTaskAssessmentToDto(assessment);
  }
}

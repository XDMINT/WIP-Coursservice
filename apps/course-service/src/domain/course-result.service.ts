import {
  COURSE_PASSING_RULE_DESCRIPTION,
  COURSE_PASSING_THRESHOLD_PERCENT,
  calculateCoursePassStatus,
} from '../course-result.rules';
import {
  CoursePassStatus,
  CourseResult,
  CourseResultMode,
  CourseResultSource,
} from '../entities/course-result.entity';
import { Course } from '../entities/course.entity';
import { CourseMemberRole, Enrollment } from '../entities/enrollment.entity';
import {
  CourseResultListQueryDto,
  CourseResultListResponseDto,
  CourseResultResponseDto,
  ManualCourseResultDto,
  mapCourseResultToDto,
  mapMissingCourseResultToDto,
} from '../dto/course-result.dto';
import { CoursePermission } from '../courses.permissions';
import { ApiValidationError } from '../common/api-errors';
import { CourseDomainFacade } from './course-domain.context';

export class CourseResultService {
  constructor(private readonly courseService: CourseDomainFacade) {}

  async getMyCourseResult(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    const actorId = this.courseService.requireActorUserId(actorUserId);

    await this.courseService.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ReadOwnResults,
    );

    const enrollment = await this.courseService.findStudentEnrollmentOrThrow(
      this.courseService.toCourseId(courseId),
      actorId,
    );
    const result = await this.findCourseResult(
      this.courseService.toCourseId(courseId),
      enrollment.id,
    );

    return result
      ? mapCourseResultToDto(result)
      : mapMissingCourseResultToDto(this.courseService.toCourseId(courseId), enrollment);
  }

  async getCourseResults(
    courseId: string,
    query: CourseResultListQueryDto = {},
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    await this.assertCourseResultManager(courseId, actorUserId);
    await this.courseService.findCourseOrThrow(courseId);
    const currentRun = await this.courseService.getCurrentCourseRunOrCreate(courseId);

    return this.buildCourseResultsForRun(courseId, currentRun.id, query);
  }

  async getCourseResultsByRun(
    courseId: string,
    runId: string,
    query: CourseResultListQueryDto = {},
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    const run = await this.courseService.assertCourseRunManageable(courseId, runId, actorUserId);

    return this.buildCourseResultsForRun(courseId, run.id, query);
  }

  async setManualCourseResult(
    courseId: string,
    studentId: string,
    body: ManualCourseResultDto,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    const actorId = await this.assertCourseResultManager(courseId, actorUserId);
    const enrollment = await this.courseService.findStudentEnrollmentOrThrow(
      this.courseService.toCourseId(courseId),
      studentId,
    );
    const pointsAchieved = this.parseCourseResultNumber(
      body?.pointsAchieved,
      'Points achieved',
    );
    const maxPoints = this.parseCourseResultNumber(body?.maxPoints, 'Max points');
    const manualGrade = this.courseService.normalizeOptionalText(body?.manualGrade);
    const comment = this.courseService.normalizeOptionalText(body?.comment);
    const passStatus = this.normalizeManualPassStatus(body?.passStatus);

    this.validateCourseResultPoints(pointsAchieved, maxPoints);

    const existingResult = await this.findCourseResult(
      this.courseService.toCourseId(courseId),
      enrollment.id,
    );
    const result = existingResult ?? new CourseResult();
    const previousSource = existingResult?.source;
    const previousAssessmentMode = existingResult?.assessmentMode;
    const source =
      previousSource === CourseResultSource.AUTOMATIC_CALCULATION ||
      previousSource === CourseResultSource.MANUAL_OVERRIDE
        ? CourseResultSource.MANUAL_OVERRIDE
        : CourseResultSource.MANUAL_ENTRY;

    this.assignCourseResultRelations(result, this.courseService.toCourseId(courseId), enrollment);
    result.assessmentMode = CourseResultMode.MANUAL;
    result.pointsAchieved = pointsAchieved;
    result.maxPoints = maxPoints;
    result.percentage = this.calculatePercentage(pointsAchieved, maxPoints);
    result.manualGrade = manualGrade;
    result.passStatus = passStatus;
    result.source = source;
    result.comment = comment;
    result.gradedBy = actorId;
    result.gradedAt = new Date();
    result.sourceDetails = {
      source,
      previousSource,
      previousAssessmentMode,
      enteredBy: actorId,
      enteredAt: result.gradedAt.toISOString(),
    };
    result.createdBy = result.createdBy ?? actorId;
    result.updatedBy = actorId;

    return mapCourseResultToDto(
      await this.courseService.repositories.courseResults.save(result),
    );
  }

  async recalculateCourseResult(
    courseId: string,
    studentId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    const actorId = await this.assertCourseResultManager(courseId, actorUserId);
    const enrollment = await this.courseService.findStudentEnrollmentOrThrow(
      this.courseService.toCourseId(courseId),
      studentId,
    );

    return this.calculateAndSaveAutomaticCourseResult(
      this.courseService.toCourseId(courseId),
      enrollment,
      actorId,
    );
  }

  async recalculateAllCourseResults(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    const actorId = await this.assertCourseResultManager(courseId, actorUserId);
    const currentRun = await this.courseService.getCurrentCourseRunOrCreate(courseId);
    const enrollments = await this.courseService.repositories.enrollments.find({
      where: {
        courseId: this.courseService.toCourseId(courseId),
        courseRunId: currentRun.id,
        role: CourseMemberRole.STUDENT,
      },
      order: {
        userId: 'ASC',
      },
    }) as Enrollment[];

    for (const enrollment of enrollments) {
      await this.calculateAndSaveAutomaticCourseResult(
        this.courseService.toCourseId(courseId),
        enrollment,
        actorId,
      );
    }

    return this.getCourseResults(
      this.courseService.toCourseId(courseId),
      {
        page: 1,
        pageSize: Math.max(enrollments.length, 1),
      },
      actorId,
    );
  }

  private parseCourseResultNumber(
    value: unknown,
    fieldName: string,
  ): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      throw new ApiValidationError(`${fieldName} must be a valid number`);
    }

    if (numericValue < 0) {
      throw new ApiValidationError(`${fieldName} cannot be negative`);
    }

    return Math.round(numericValue * 100) / 100;
  }

  private normalizeManualPassStatus(value: unknown): CoursePassStatus {
    const normalizedStatus = String(value ?? '').toUpperCase() as CoursePassStatus;

    if (
      normalizedStatus !== CoursePassStatus.PASSED &&
      normalizedStatus !== CoursePassStatus.FAILED
    ) {
      throw new ApiValidationError(
        'Manual results require PASSED or FAILED as pass status',
      );
    }

    return normalizedStatus;
  }

  private normalizeOptionalPassStatus(
    value: unknown,
  ): CoursePassStatus | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const normalizedStatus = String(value).toUpperCase() as CoursePassStatus;

    if (!Object.values(CoursePassStatus).includes(normalizedStatus)) {
      throw new ApiValidationError('Invalid pass status filter');
    }

    return normalizedStatus;
  }

  private normalizeOptionalCourseResultSource(
    value: unknown,
  ): CourseResultSource | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const normalizedSource = String(value).toUpperCase() as CourseResultSource;

    if (!Object.values(CourseResultSource).includes(normalizedSource)) {
      throw new ApiValidationError('Invalid result source filter');
    }

    return normalizedSource;
  }

  private validateCourseResultPoints(
    pointsAchieved: number | null,
    maxPoints: number | null,
  ): void {
    if (
      (pointsAchieved === null && maxPoints !== null) ||
      (pointsAchieved !== null && maxPoints === null)
    ) {
      throw new ApiValidationError(
        'Points achieved and max points must be provided together',
      );
    }

    if (
      pointsAchieved !== null &&
      maxPoints !== null &&
      pointsAchieved > maxPoints
    ) {
      throw new ApiValidationError(
        'Points achieved cannot be greater than max points',
      );
    }
  }

  private calculatePercentage(
    pointsAchieved: number | null,
    maxPoints: number | null,
  ): number | null {
    if (
      pointsAchieved === null ||
      maxPoints === null ||
      maxPoints === 0
    ) {
      return null;
    }

    return Math.round((pointsAchieved / maxPoints) * 10000) / 100;
  }

  private async findCourseResult(
    courseId: string,
    enrollmentId: string,
  ): Promise<CourseResult | null> {
    return this.courseService.repositories.courseResults.findOne({
      where: {
        courseId,
        enrollmentId,
      },
    });
  }

  private assignCourseResultRelations(
    result: CourseResult,
    courseId: string,
    enrollment: Enrollment,
  ): void {
    result.courseId = courseId;
    result.courseRunId = enrollment.courseRunId;
    result.enrollmentId = enrollment.id;
    result.studentId = enrollment.userId;

    const course = new Course();
    course.id = courseId;
    result.course = course;
    result.enrollment = enrollment;
  }

  private async assertCourseResultManager(
    courseId: string | number,
    actorUserId?: string | number,
  ): Promise<string> {
    const actorId = this.courseService.requireActorUserId(actorUserId);

    await this.courseService.assertCoursePermission(
      courseId,
      actorId,
      CoursePermission.ReadAllResults,
    );

    return actorId;
  }

  private async calculateAndSaveAutomaticCourseResult(
    courseId: string,
    enrollment: Enrollment,
    actorId: string,
  ): Promise<CourseResultResponseDto> {
    const assignments = await this.courseService.repositories.assignments.find({
      where: {
        course: { id: courseId },
        courseRunId: enrollment.courseRunId,
        isGraded: true,
      },
    }) as any[];
    const grades = await this.courseService.repositories.grades.find({
      where: { enrollment: { id: enrollment.id } },
      relations: ['assignment'],
    }) as any[];
    const finalGrades = grades.filter((grade) => grade.isFinal);

    let totalPointsAchieved = 0;
    let totalMaxPoints = 0;
    const assignmentAudit = assignments.map((assignment) => {
      const maxPoints = this.courseService.ensureValidAssignmentMaxPoints(assignment);
      const grade = finalGrades.find(
        (candidate) => candidate.assignment?.id === assignment.id,
      );
      const pointsAchieved = grade
        ? this.courseService.ensureValidAutomaticGradePoints(grade.pointsAchieved, maxPoints)
        : 0;

      totalPointsAchieved += pointsAchieved;
      totalMaxPoints += maxPoints;

      return {
        assignmentId: assignment.id,
        title: assignment.title,
        maxPoints,
        pointsAchieved,
        gradeId: grade?.id,
        finalGradeAvailable: Boolean(grade),
      };
    });
    const roundedPointsAchieved = Math.round(totalPointsAchieved * 100) / 100;
    const roundedMaxPoints = Math.round(totalMaxPoints * 100) / 100;
    const percentage = this.calculatePercentage(
      roundedPointsAchieved,
      roundedMaxPoints,
    );
    const existingResult = await this.findCourseResult(courseId, enrollment.id);
    const result = existingResult ?? new CourseResult();

    this.assignCourseResultRelations(result, courseId, enrollment);
    result.assessmentMode = CourseResultMode.AUTOMATIC;
    result.pointsAchieved = roundedPointsAchieved;
    result.maxPoints = roundedMaxPoints;
    result.percentage = percentage;
    result.manualGrade = null;
    result.passStatus = calculateCoursePassStatus(percentage);
    result.source = CourseResultSource.AUTOMATIC_CALCULATION;
    result.comment = null;
    result.gradedBy = actorId;
    result.gradedAt = new Date();
    result.sourceDetails = {
      rule: COURSE_PASSING_RULE_DESCRIPTION,
      passThresholdPercent: COURSE_PASSING_THRESHOLD_PERCENT,
      comparator: '>',
      calculatedFrom: 'course.assignments.finalGrades',
      assignments: assignmentAudit,
    };
    result.createdBy = result.createdBy ?? actorId;
    result.updatedBy = actorId;

    return mapCourseResultToDto(
      await this.courseService.repositories.courseResults.save(result),
    );
  }

  private async buildCourseResultsForRun(
    courseId: string,
    courseRunId: string,
    query: CourseResultListQueryDto = {},
  ): Promise<CourseResultListResponseDto> {
    const page = this.courseService.parsePaginationValue(query.page, 1);
    const pageSize = this.courseService.parsePaginationValue(query.pageSize, 10, 100);
    const passStatus = this.normalizeOptionalPassStatus(query.passStatus);
    const source = this.normalizeOptionalCourseResultSource(query.source);
    const enrollments = await this.courseService.repositories.enrollments.find({
      where: {
        courseId: this.courseService.toCourseId(courseId),
        courseRunId,
        role: CourseMemberRole.STUDENT,
      },
      order: {
        userId: 'ASC',
      },
    }) as Enrollment[];
    const results = await this.courseService.repositories.courseResults.find({
      where: {
        courseId: this.courseService.toCourseId(courseId),
        courseRunId,
      },
    }) as CourseResult[];
    const resultByEnrollmentId = new Map(
      results.map((result) => [result.enrollmentId, result]),
    );
    const allItems = enrollments
      .map((enrollment) => {
        const result = resultByEnrollmentId.get(enrollment.id);

        return result
          ? mapCourseResultToDto(result)
          : mapMissingCourseResultToDto(this.courseService.toCourseId(courseId), enrollment);
      })
      .filter((item) => !passStatus || item.passStatus === passStatus)
      .filter((item) => !source || item.source === source)
      .sort((left, right) =>
        String(left.studentId).localeCompare(String(right.studentId), undefined, {
          numeric: true,
        }),
      );
    const offset = (page - 1) * pageSize;

    return {
      items: allItems.slice(offset, offset + pageSize),
      page,
      pageSize,
      total: allItems.length,
    };
  }
}

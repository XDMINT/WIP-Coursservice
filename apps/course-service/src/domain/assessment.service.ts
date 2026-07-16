import { CourseMemberRole } from '../entities/enrollment.entity';
import { TaskGradingMode, TaskWorkMode } from '../entities/task.entity';
import {
  TaskAssessmentStatus,
} from '../entities/task-assessment.entity';
import { TaskProgressStatus } from '../entities/task-progress.entity';
import { ApiForbiddenError, ApiValidationError } from '../common/api-errors';
import {
  LearningPathResponseDto,
  MockEvaluateLearningTaskDto,
} from '../dto/learning-process.dto';
import { TASK_PASS_THRESHOLD_PERCENT } from '../task-assessment.rules';
import { AuditEventType } from '../entities/audit-event.entity';

type CourseServiceFacade = any;

export class AssessmentService {
  constructor(private readonly courseService: CourseServiceFacade) {}

  async mockEvaluateLearningTask(
    taskId: string,
    body: MockEvaluateLearningTaskDto = {},
    actorUserId?: string | number,
  ): Promise<LearningPathResponseDto> {
    const task = await this.courseService.findLearningTaskOrThrow(taskId);
    await this.courseService.assertTaskReadable(task, actorUserId);
    const actorId = this.courseService.requireActorUserId(actorUserId);
    const enrollment = await this.courseService.assertCurrentStudentEnrollment(
      task.courseId,
      actorId,
    );

    if ((task.workMode ?? TaskWorkMode.INDIVIDUAL) === TaskWorkMode.GROUP) {
      throw new ApiValidationError(
        'Automatische Gruppenbewertung ist in dieser Mini-Version nicht aktiv. Bitte manuell bewerten.',
      );
    }

    if ((task.gradingMode ?? TaskGradingMode.NOT_GRADED) !== TaskGradingMode.AUTOMATIC_MOCK) {
      throw new ApiValidationError('Diese Aufgabe ist nicht automatisch bewertet.');
    }

    const progress = await this.courseService.ensureTaskProgress(task, enrollment, actorId);

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

    const submissionData = {
      ...(body.submissionData ?? {}),
      ...(body.passed !== undefined ? { passed: body.passed } : {}),
    };
    const result = await this.courseService.getTaskServiceClient().evaluateSubmission({
      task,
      studentId: enrollment.userId,
      submissionData,
    });
    const assessment = await this.courseService.ensureTaskAssessment(task, enrollment);
    assessment.status = TaskAssessmentStatus.AUTO_EVALUATED;
    assessment.points = result.points;
    assessment.maxPoints = result.maxPoints;
    assessment.passThreshold = task.passThreshold ?? TASK_PASS_THRESHOLD_PERCENT;
    assessment.passed = result.passed;
    assessment.feedback = result.feedback;
    assessment.submissionData = submissionData;
    assessment.assessedBy = 'task-service';
    assessment.assessedAt = new Date();
    await this.courseService.saveTaskAssessment(assessment);
    await this.courseService.applyAssessmentToProgress(task, enrollment, assessment, actorId);
    await this.courseService.recordAuditEvent({
      eventType: AuditEventType.ASSESSMENT_AUTO_EVALUATED,
      actorUserId: actorId,
      actorRole: CourseMemberRole.STUDENT,
      courseId: task.courseId,
      courseRunId: task.courseRunId,
      courseVersionId: task.courseVersionId,
      entityType: 'task_assessment',
      entityId: assessment.id,
      summary: `Aufgabe automatisch bewertet: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        studentId: enrollment.userId,
        points: assessment.points,
        maxPoints: assessment.maxPoints,
        passed: assessment.passed,
      },
    });
    await this.courseService.recordAuditEvent({
      eventType: assessment.passed ? AuditEventType.TASK_COMPLETED : AuditEventType.TASK_FAILED,
      actorUserId: actorId,
      actorRole: CourseMemberRole.STUDENT,
      courseId: task.courseId,
      courseRunId: task.courseRunId,
      courseVersionId: task.courseVersionId,
      entityType: 'task_progress',
      entityId: task.id,
      summary: `${assessment.passed ? 'Aufgabe abgeschlossen' : 'Aufgabe nicht bestanden'}: ${task.title}`,
      metadataJson: {
        taskId: task.id,
        studentId: enrollment.userId,
        gradingMode: task.gradingMode,
      },
    });

    return this.courseService.buildLearningPathForEnrollment(task.courseId, enrollment);
  }
}

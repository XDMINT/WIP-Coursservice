import { calculateCoursePassStatus } from '../course-result.rules';
import { CourseDomainService } from './course-domain.service';
import { ApiNotFoundError } from '../common/api-errors';
import { CoursePermission } from '../courses.permissions';
import { Assignment } from '../entities/assignment.entity';
import { Course } from '../entities/course.entity';
import { CoursePassStatus } from '../entities/course-result.entity';
import { Enrollment } from '../entities/enrollment.entity';
import { Grade } from '../entities/grade.entity';


export class AssignmentGradeService extends CourseDomainService {

  private async assertCourseReadable(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<void> {
    if (actorUserId === undefined) {
      return;
    }

    await this.assertCoursePermission(
      courseId,
      actorUserId,
      CoursePermission.ReadCourseContent,
    );
  }

  private async assertCourseManageable(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<string | undefined> {
    if (actorUserId === undefined) {
      return undefined;
    }

    await this.assertCoursePermission(
      courseId,
      actorUserId,
      CoursePermission.ManageCourseContent,
    );

    return this.toUserId(actorUserId);
  }

  private async findAssignmentWithCourseOrThrow(id: string): Promise<Assignment> {
    const assignment = await this.repositories.assignments.findOne({
      where: { id },
      relations: ['course'],
    });

    if (!assignment?.course?.id) {
      throw new ApiNotFoundError('Assignment not found');
    }

    return assignment;
  }

  private async assertAssignmentReadable(
    assignment: Assignment,
    actorUserId?: string | number,
  ): Promise<void> {
    await this.assertCourseReadable(assignment.course.id, actorUserId);
  }

  private async assertAssignmentManageable(
    assignment: Assignment,
    actorUserId?: string | number,
  ): Promise<string | undefined> {
    return this.assertCourseManageable(assignment.course.id, actorUserId);
  }

  private async assertEnrollmentGradesReadable(
    enrollmentId: string,
    actorUserId?: string | number,
  ): Promise<void> {
    if (actorUserId === undefined) {
      return;
    }

    const enrollment = await this.repositories.enrollments.findOne({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      throw new ApiNotFoundError('Enrollment not found');
    }

    const actorId = this.toUserId(actorUserId);
    await this.assertCoursePermission(
      enrollment.courseId,
      actorId,
      enrollment.userId === actorId
        ? CoursePermission.ReadOwnResults
        : CoursePermission.ReadAllResults,
    );
  }

  async createAssignment(
    courseId: string,
    title: string,
    description: string,
    type: string,
    maxPoints: number,
    weight: number,
    dueDate: Date,
    createdBy: string,
    actorUserId?: string | number,
  ): Promise<Assignment> {
    const actorId = await this.assertCourseManageable(courseId, actorUserId);
    const creatorId = actorId ?? createdBy;
    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);
    const assignment = new Assignment();
    assignment.title = title;
    assignment.description = description;
    assignment.type = type;
    assignment.maxPoints = maxPoints;
    assignment.weight = weight;
    assignment.dueDate = dueDate;
    assignment.createdBy = creatorId;
    assignment.updatedBy = creatorId;
    assignment.isPublished = false;
    assignment.isGraded = false;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    assignment.course = course;
    assignment.courseRunId = currentRun.id;
    assignment.courseRun = currentRun;

    return this.repositories.assignments.save(assignment);
  }

  async getAssignmentsByCourse(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<Assignment[]> {
    await this.assertCourseReadable(courseId, actorUserId);
    const currentRun = await this.getCurrentCourseRunOrCreate(courseId);

    return this.repositories.assignments.find({
      where: {
        course: { id: courseId },
        courseRunId: currentRun.id,
      },
      relations: ['grades'],
    });
  }

  async getAssignmentById(
    id: string,
    actorUserId?: string | number,
  ): Promise<Assignment> {
    const assignment = await this.findAssignmentWithCourseOrThrow(id);
    await this.assertAssignmentReadable(assignment, actorUserId);

    return this.repositories.assignments.findOne({
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
    actorUserId?: string | number,
  ): Promise<Assignment> {
    const assignment = await this.findAssignmentWithCourseOrThrow(id);
    const actorId = await this.assertAssignmentManageable(assignment, actorUserId);

    assignment.title = title;
    assignment.description = description;
    assignment.type = type;
    assignment.maxPoints = maxPoints;
    assignment.weight = weight;
    assignment.dueDate = dueDate;
    assignment.isPublished = isPublished;
    assignment.isGraded = isGraded;
    assignment.updatedBy = actorId ?? updatedBy;

    return this.repositories.assignments.save(assignment);
  }

  async deleteAssignment(
    id: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const assignment = await this.findAssignmentWithCourseOrThrow(id);
    await this.assertAssignmentManageable(assignment, actorUserId);

    await this.repositories.assignments.delete(id);
  }

  async publishAssignment(
    id: string,
    updatedBy: string,
    actorUserId?: string | number,
  ): Promise<Assignment> {
    const assignment = await this.findAssignmentWithCourseOrThrow(id);
    const actorId = await this.assertAssignmentManageable(assignment, actorUserId);

    assignment.isPublished = true;
    assignment.updatedBy = actorId ?? updatedBy;

    return this.repositories.assignments.save(assignment);
  }

  async unpublishAssignment(
    id: string,
    updatedBy: string,
    actorUserId?: string | number,
  ): Promise<Assignment> {
    const assignment = await this.findAssignmentWithCourseOrThrow(id);
    const actorId = await this.assertAssignmentManageable(assignment, actorUserId);

    assignment.isPublished = false;
    assignment.updatedBy = actorId ?? updatedBy;

    return this.repositories.assignments.save(assignment);
  }

  async createGrade(
    assignmentId: string,
    enrollmentId: string,
    pointsAchieved: number,
    feedback: string,
    gradedBy: string,
    isFinal: boolean,
    actorUserId?: string | number,
  ): Promise<Grade> {
    const assignment = await this.repositories.assignments.findOne({
      where: { id: assignmentId },
      relations: ['course'],
    });

    if (!assignment?.course?.id) {
      throw new ApiNotFoundError('Assignment not found');
    }

    const actorId = await this.assertAssignmentManageable(assignment, actorUserId);
    const graderId = actorId ?? gradedBy;

    this.ensureValidAutomaticGradePoints(
      pointsAchieved,
      this.ensureValidAssignmentMaxPoints(assignment),
    );

    const grade = new Grade();
    grade.pointsAchieved = pointsAchieved;
    grade.feedback = feedback;
    grade.gradedBy = graderId;
    grade.gradedAt = new Date();
    grade.isFinal = isFinal;
    grade.updatedBy = graderId;

    grade.assignment = assignment;

    // Set the enrollment relation
    const enrollment = new Enrollment();
    enrollment.id = enrollmentId;
    grade.enrollment = enrollment;

    return this.repositories.grades.save(grade);
  }

  async getGradesByAssignment(
    assignmentId: string,
    actorUserId?: string | number,
  ): Promise<Grade[]> {
    const assignment = await this.findAssignmentWithCourseOrThrow(assignmentId);

    if (actorUserId !== undefined) {
      await this.assertCoursePermission(
        assignment.course.id,
        actorUserId,
        CoursePermission.ReadAllResults,
      );
    }

    return this.repositories.grades.find({
      where: { assignment: { id: assignmentId } },
      relations: ['enrollment', 'assignment'],
    });
  }

  async getGradesByEnrollment(
    enrollmentId: string,
    actorUserId?: string | number,
  ): Promise<Grade[]> {
    await this.assertEnrollmentGradesReadable(enrollmentId, actorUserId);

    return this.repositories.grades.find({
      where: { enrollment: { id: enrollmentId } },
      relations: ['assignment'],
    });
  }

  async getGradeById(
    id: string,
    actorUserId?: string | number,
  ): Promise<Grade> {
    const grade = await this.repositories.grades.findOne({
      where: { id },
      relations: ['enrollment', 'assignment', 'assignment.course'],
    });

    if (!grade) {
      throw new ApiNotFoundError('Grade not found');
    }

    if (actorUserId !== undefined) {
      const actorId = this.toUserId(actorUserId);
      await this.assertCoursePermission(
        grade.assignment.course.id,
        actorId,
        grade.enrollment.userId === actorId
          ? CoursePermission.ReadOwnResults
          : CoursePermission.ReadAllResults,
      );
    }

    return grade;
  }

  async updateGrade(
    id: string,
    pointsAchieved: number,
    feedback: string,
    gradedBy: string,
    isFinal: boolean,
    updatedBy: string,
    actorUserId?: string | number,
  ): Promise<Grade> {
    const grade = await this.repositories.grades.findOne({
      where: { id },
      relations: ['assignment', 'assignment.course'],
    });

    if (!grade) {
      throw new ApiNotFoundError('Grade not found');
    }

    const assignment = grade.assignment?.course?.id
      ? grade.assignment
      : await this.repositories.assignments.findOne({
          where: { id: (grade as any).assignmentId },
          relations: ['course'],
        });

    if (!assignment?.course?.id) {
      throw new ApiNotFoundError('Assignment not found');
    }

    const actorId = await this.assertAssignmentManageable(assignment, actorUserId);
    const graderId = actorId ?? gradedBy;

    this.ensureValidAutomaticGradePoints(
      pointsAchieved,
      this.ensureValidAssignmentMaxPoints(assignment),
    );

    grade.pointsAchieved = pointsAchieved;
    grade.feedback = feedback;
    grade.gradedBy = graderId;
    grade.gradedAt = new Date();
    grade.isFinal = isFinal;
    grade.updatedBy = actorId ?? updatedBy;

    return this.repositories.grades.save(grade);
  }

  async deleteGrade(
    id: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const grade = await this.repositories.grades.findOne({
      where: { id },
      relations: ['assignment', 'assignment.course'],
    });

    if (!grade?.assignment?.course?.id) {
      throw new ApiNotFoundError('Grade not found');
    }

    await this.assertAssignmentManageable(grade.assignment, actorUserId);

    await this.repositories.grades.delete(id);
  }

  async calculateCourseGrade(
    courseId: string,
    enrollmentId: string,
    actorUserId?: string | number,
  ): Promise<{ grade: number; passed: boolean }> {
    const enrollment = await this.repositories.enrollments.findOne({
      where: { id: enrollmentId },
    });

    if (!enrollment || enrollment.courseId !== courseId) {
      throw new ApiNotFoundError('Enrollment not found');
    }

    await this.assertEnrollmentGradesReadable(enrollmentId, actorUserId);

    // Get all assignments for the course
    const assignments = await this.repositories.assignments.find({
      where: { course: { id: courseId }, isGraded: true },
    });

    if (assignments.length === 0) {
      throw new Error('No graded assignments found for this course');
    }

    // Get all grades for the enrollment
    const grades = await this.repositories.grades.find({
      where: { enrollment: { id: enrollmentId } },
      relations: ['assignment'],
    });

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const assignment of assignments) {
      const grade = grades.find(g => g.assignment.id === assignment.id);

      if (grade && grade.isFinal) {
        const maxPoints = this.ensureValidAssignmentMaxPoints(assignment);

        if (maxPoints === 0) {
          continue;
        }

        const pointsAchieved = this.ensureValidAutomaticGradePoints(
          grade.pointsAchieved,
          maxPoints,
        );
        const percentage = pointsAchieved / maxPoints;
        totalWeightedScore += percentage * assignment.weight;
        totalWeight += assignment.weight;
      }
    }

    if (totalWeight === 0) {
      throw new Error('No valid grades found for calculation');
    }

    const finalGrade = totalWeightedScore / totalWeight;
    const passed =
      calculateCoursePassStatus(finalGrade * 100) === CoursePassStatus.PASSED;

    return { grade: finalGrade, passed };
  }

  async getCoursePerformance(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<any> {
    if (actorUserId !== undefined) {
      await this.assertCoursePermission(
        courseId,
        actorUserId,
        CoursePermission.ReadAllResults,
      );
    }

    // Get all enrollments for the course
    const enrollments = await this.repositories.enrollments.find({
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
}

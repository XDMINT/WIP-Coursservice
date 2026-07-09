/**
 * Courses Service - Business logic layer for course management
 * 
 * This service provides all the business logic for managing courses, learning materials,
 * assignments, grades, tasks, content releases, templates, groups, and calendar events.
 * It acts as the bridge between the controllers and the database repositories.
 * 
 * @module CoursesService
 */
import { Injectable, Inject } from '@nestjs/common';
import { Repository, LessThanOrEqual, ILike, MoreThanOrEqual, Not, IsNull } from 'typeorm';
import { LearningMaterial } from './entities/learning-material.entity';
import { Assignment } from './entities/assignment.entity';
import { Grade } from './entities/grade.entity';
import { Enrollment, CourseMemberRole } from './entities/enrollment.entity';
import { Task } from './entities/task.entity';
import { TaskProgress } from './entities/task-progress.entity';
import { ContentRelease, ReleaseType } from './entities/content-release.entity';
import { ContentTemplate } from './entities/content-template.entity';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { CalendarEvent } from './entities/calendar-event.entity';

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
    @Inject('COURSE_REPOSITORY')
    private coursesRepository: Repository<Course>,
    @Inject('LEARNING_MATERIAL_REPOSITORY')
    private learningMaterialRepository: Repository<LearningMaterial>,
    @Inject('ASSIGNMENT_REPOSITORY')
    private assignmentRepository: Repository<Assignment>,
    @Inject('GRADE_REPOSITORY')
    private gradeRepository: Repository<Grade>,
    @Inject('ENROLLMENT_REPOSITORY')
    private enrollmentRepository: Repository<Enrollment>,
    @Inject('TASK_REPOSITORY')
    private taskRepository: Repository<Task>,
    @Inject('TASK_PROGRESS_REPOSITORY')
    private taskProgressRepository: Repository<TaskProgress>,
    @Inject('CONTENT_RELEASE_REPOSITORY')
    private contentReleaseRepository: Repository<ContentRelease>,
    @Inject('CONTENT_TEMPLATE_REPOSITORY')
    private contentTemplateRepository: Repository<ContentTemplate>,
    @Inject('COURSE_GROUP_REPOSITORY')
    private courseGroupRepository: Repository<CourseGroup>,
    @Inject('GROUP_MEMBERSHIP_REPOSITORY')
    private groupMembershipRepository: Repository<GroupMembership>,
    @Inject('CALENDAR_EVENT_REPOSITORY')
    private calendarEventRepository: Repository<CalendarEvent>,
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
      throw new Error('Invalid course status');
    }

    return normalizedStatus;
  }

  private normalizeCourseRole(role: string): CourseMemberRole {
    const normalizedRole = String(role).toUpperCase() as CourseMemberRole;

    if (!Object.values(CourseMemberRole).includes(normalizedRole)) {
      throw new Error('Invalid course role');
    }

    return normalizedRole;
  }

  private createExternalCourseId(): string {
    return `course-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

  async findAll(userId?: string | number): Promise<Course[]> {
    if (userId === undefined || userId === null) {
      return this.coursesRepository.find();
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

    return Array.from(coursesById.values());
  }

  async findOne(id: string | number): Promise<Course> {
    return this.coursesRepository.findOne({
      where: { id: this.toCourseId(id) },
      relations: ['versions', 'enrollments', 'groups'],
    });
  }

  async getUserRoleInCourse(
    courseId: string | number,
    userId: string | number,
  ): Promise<CourseMemberRole | null> {
    const normalizedCourseId = this.toCourseId(courseId);
    const enrollment = await this.findCourseEnrollment(
      normalizedCourseId,
      userId,
    );

    if (enrollment) {
      return enrollment.role;
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

  async getCourseMembers(courseId: string | number): Promise<Enrollment[]> {
    return this.enrollmentRepository.find({
      where: { courseId: this.toCourseId(courseId) },
    });
  }

  async createCourse(body: any): Promise<Course> {
    body = body ?? {};

    const course = new Course();
    const ownerId = this.toOptionalNumber(
      body.owner_id ?? body.ownerId ?? body.userId,
    );
    const status = this.normalizeCourseStatus(body.status);

    course.external_id =
      body.external_id ?? body.externalId ?? this.createExternalCourseId();
    course.title = body.title;
    course.description = body.description;
    course.semester = body.semester;
    course.status = status ?? CourseStatus.DRAFT;
    course.location = body.location;
    course.key_password = body.key_password ?? body.keyPassword;
    course.owner_id = ownerId;

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

        await this.enrollmentRepository.save(enrollment);
      }
    }

    return savedCourse;
  }

  async joinCourse(
    courseId: string | number,
    userId: string | number,
    key?: string,
  ): Promise<Enrollment> {
    const normalizedCourseId = this.toCourseId(courseId);
    const course = await this.coursesRepository.findOne({
      where: { id: normalizedCourseId },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    if (course.key_password && course.key_password !== key) {
      throw new Error('Invalid course key');
    }

    const existingEnrollment = await this.findCourseEnrollment(
      normalizedCourseId,
      userId,
    );

    if (existingEnrollment) {
      return existingEnrollment;
    }

    const enrollment = new Enrollment();
    enrollment.courseId = normalizedCourseId;
    enrollment.course = course;
    enrollment.userId = this.toUserId(userId);
    enrollment.role = CourseMemberRole.STUDENT;

    return this.enrollmentRepository.save(enrollment);
  }

  async leaveCourse(
    courseId: string | number,
    userId?: string | number,
  ): Promise<void> {
    if (userId === undefined || userId === null) {
      throw new Error('User ID is required to leave a course');
    }

    await this.enrollmentRepository.delete({
      courseId: this.toCourseId(courseId),
      userId: this.toUserId(userId),
    });
  }

  async updateCourse(id: string | number, body: any): Promise<Course> {
    body = body ?? {};

    const course = await this.coursesRepository.findOne({
      where: { id: this.toCourseId(id) },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    const status = this.normalizeCourseStatus(body.status);
    const ownerId = this.toOptionalNumber(body.owner_id ?? body.ownerId);

    if (body.external_id !== undefined || body.externalId !== undefined) {
      course.external_id = body.external_id ?? body.externalId;
    }

    if (body.title !== undefined) {
      course.title = body.title;
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

    return this.coursesRepository.save(course);
  }

  async changeUserRole(
    courseId: string | number,
    userId: string | number,
    role: string,
  ): Promise<Enrollment> {
    const normalizedCourseId = this.toCourseId(courseId);
    const enrollment = await this.findCourseEnrollment(
      normalizedCourseId,
      userId,
    );

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    enrollment.role = this.normalizeCourseRole(role);

    return this.enrollmentRepository.save(enrollment);
  }

  async removeCourse(id: string | number): Promise<void> {
    const result = await this.coursesRepository.delete(this.toCourseId(id));

    if (result.affected === 0) {
      throw new Error('Course not found');
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
    material.title = title;
    material.description = description;
    material.type = type;
    material.url = url;
    material.filePath = filePath;
    material.createdBy = createdBy;
    material.updatedBy = createdBy;
    material.isPublished = false;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    material.course = course;

    return this.learningMaterialRepository.save(material);
  }

  async getLearningMaterialsByCourse(courseId: string): Promise<LearningMaterial[]> {
    return this.learningMaterialRepository.find({
      where: { course: { id: courseId } },
    });
  }

  async getLearningMaterialById(id: string): Promise<LearningMaterial> {
    return this.learningMaterialRepository.findOne({
      where: { id },
    });
  }

  async updateLearningMaterial(
    id: string,
    title: string,
    description: string,
    type: string,
    url: string,
    filePath: string,
    isPublished: boolean,
    updatedBy: string,
  ): Promise<LearningMaterial> {
    const material = await this.learningMaterialRepository.findOne({
      where: { id },
    });

    if (!material) {
      throw new Error('Learning material not found');
    }

    material.title = title;
    material.description = description;
    material.type = type;
    material.url = url;
    material.filePath = filePath;
    material.isPublished = isPublished;
    material.updatedBy = updatedBy;

    return this.learningMaterialRepository.save(material);
  }

  async deleteLearningMaterial(id: string): Promise<void> {
    await this.learningMaterialRepository.delete(id);
  }

  async publishLearningMaterial(id: string, updatedBy: string): Promise<LearningMaterial> {
    const material = await this.learningMaterialRepository.findOne({
      where: { id },
    });

    if (!material) {
      throw new Error('Learning material not found');
    }

    material.isPublished = true;
    material.updatedBy = updatedBy;

    return this.learningMaterialRepository.save(material);
  }

  async unpublishLearningMaterial(id: string, updatedBy: string): Promise<LearningMaterial> {
    const material = await this.learningMaterialRepository.findOne({
      where: { id },
    });

    if (!material) {
      throw new Error('Learning material not found');
    }

    material.isPublished = false;
    material.updatedBy = updatedBy;

    return this.learningMaterialRepository.save(material);
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

  // Task methods
  async createTask(
    courseId: string,
    title: string,
    description: string,
    type: string,
    order: number,
    prerequisiteTaskId: string,
    completionCriteria: any,
    createdBy: string,
  ): Promise<Task> {
    const task = new Task();
    task.title = title;
    task.description = description;
    task.type = type;
    task.order = order;
    task.prerequisiteTaskId = prerequisiteTaskId;
    task.completionCriteria = completionCriteria;
    task.createdBy = createdBy;
    task.updatedBy = createdBy;
    task.isPublished = false;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    task.course = course;

    return this.taskRepository.save(task);
  }

  async getTasksByCourse(courseId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { course: { id: courseId } },
      order: { order: 'ASC' },
    });
  }

  async getTaskById(id: string): Promise<Task> {
    return this.taskRepository.findOne({
      where: { id },
    });
  }

  async updateTask(
    id: string,
    title: string,
    description: string,
    type: string,
    order: number,
    prerequisiteTaskId: string,
    completionCriteria: any,
    isPublished: boolean,
    updatedBy: string,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    task.title = title;
    task.description = description;
    task.type = type as any;
    task.order = order;
    task.prerequisiteTaskId = prerequisiteTaskId;
    task.completionCriteria = completionCriteria;
    task.isPublished = isPublished;
    task.updatedBy = updatedBy;

    return this.taskRepository.save(task);
  }

  async deleteTask(id: string): Promise<void> {
    await this.taskRepository.delete(id);
  }

  async publishTask(id: string, updatedBy: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    task.isPublished = true;
    task.updatedBy = updatedBy;

    return this.taskRepository.save(task);
  }

  async unpublishTask(id: string, updatedBy: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    task.isPublished = false;
    task.updatedBy = updatedBy;

    return this.taskRepository.save(task);
  }

  // Task Progress methods
  async createTaskProgress(
    taskId: string,
    enrollmentId: string,
    createdBy: string,
  ): Promise<TaskProgress> {
    const progress = new TaskProgress();
    progress.status = 'LOCKED';
    progress.completionPercentage = 0;
    progress.createdBy = createdBy;
    progress.updatedBy = createdBy;

    // Set the task relation
    const task = new Task();
    task.id = taskId;
    progress.task = task;

    // Set the enrollment relation
    const enrollment = new Enrollment();
    enrollment.id = enrollmentId;
    progress.enrollment = enrollment;

    return this.taskProgressRepository.save(progress);
  }

  async getTaskProgressById(id: string): Promise<TaskProgress> {
    return this.taskProgressRepository.findOne({
      where: { id },
      relations: ['task', 'enrollment'],
    });
  }

  async getTaskProgressByTaskAndEnrollment(
    taskId: string,
    enrollmentId: string,
  ): Promise<TaskProgress> {
    return this.taskProgressRepository.findOne({
      where: { task: { id: taskId }, enrollment: { id: enrollmentId } },
      relations: ['task', 'enrollment'],
    });
  }

  async getTaskProgressByEnrollment(enrollmentId: string): Promise<TaskProgress[]> {
    return this.taskProgressRepository.find({
      where: { enrollment: { id: enrollmentId } },
      relations: ['task'],
      order: { task: { order: 'ASC' } },
    });
  }

  async updateTaskProgress(
    id: string,
    status: string,
    completionPercentage: number,
    progressData: any,
    updatedBy: string,
  ): Promise<TaskProgress> {
    const progress = await this.taskProgressRepository.findOne({
      where: { id },
    });

    if (!progress) {
      throw new Error('Task progress not found');
    }

    progress.status = status;
    progress.completionPercentage = completionPercentage;
    progress.progressData = progressData;
    progress.updatedBy = updatedBy;

    // Update timestamps based on status
    if (status === 'IN_PROGRESS' && !progress.startedAt) {
      progress.startedAt = new Date();
    }

    if (status === 'COMPLETED') {
      progress.completedAt = new Date();
    }

    return this.taskProgressRepository.save(progress);
  }

  async startTaskProgress(id: string, updatedBy: string): Promise<TaskProgress> {
    return this.updateTaskProgress(id, 'IN_PROGRESS', 0, {}, updatedBy);
  }

  async completeTaskProgress(id: string, updatedBy: string): Promise<TaskProgress> {
    return this.updateTaskProgress(id, 'COMPLETED', 100, {}, updatedBy);
  }

  async unlockTaskProgress(id: string, updatedBy: string): Promise<TaskProgress> {
    return this.updateTaskProgress(id, 'NOT_STARTED', 0, {}, updatedBy);
  }

  async checkTaskPrerequisites(
    taskId: string,
    enrollmentId: string,
  ): Promise<{ canAccess: boolean; missingPrerequisites: string[] }> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // If no prerequisite, task can be accessed
    if (!task.prerequisiteTaskId) {
      return { canAccess: true, missingPrerequisites: [] };
    }

    // Check if prerequisite task is completed
    const prerequisiteProgress = await this.taskProgressRepository.findOne({
      where: {
        task: { id: task.prerequisiteTaskId },
        enrollment: { id: enrollmentId },
      },
    });

    if (!prerequisiteProgress) {
      return {
        canAccess: false,
        missingPrerequisites: [`Task ${task.prerequisiteTaskId} not started`],
      };
    }

    if (prerequisiteProgress.status !== 'COMPLETED') {
      return {
        canAccess: false,
        missingPrerequisites: [`Task ${task.prerequisiteTaskId} not completed`],
      };
    }

    return { canAccess: true, missingPrerequisites: [] };
  }

  async unlockNextTasks(
    completedTaskId: string,
    enrollmentId: string,
  ): Promise<TaskProgress[]> {
    // Find all tasks that have the completed task as prerequisite
    const nextTasks = await this.taskRepository.find({
      where: { prerequisiteTaskId: completedTaskId },
    });

    const updatedProgresses = [];

    for (const task of nextTasks) {
      // Check if progress already exists
      let progress = await this.taskProgressRepository.findOne({
        where: {
          task: { id: task.id },
          enrollment: { id: enrollmentId },
        },
      });

      if (!progress) {
        // Create new progress if it doesn't exist
        progress = await this.createTaskProgress(task.id, enrollmentId, 'system');
      }

      // Check if all prerequisites are met
      const prerequisitesCheck = await this.checkTaskPrerequisites(task.id, enrollmentId);

      if (prerequisitesCheck.canAccess && progress.status === 'LOCKED') {
        // Unlock the task
        progress.status = 'NOT_STARTED' as any;
        progress.updatedBy = 'system';
        const updatedProgress = await this.taskProgressRepository.save(progress);
        updatedProgresses.push(updatedProgress);
      }
    }

    return updatedProgresses;
  }

  async getLearningPathProgress(
    courseId: string,
    enrollmentId: string,
  ): Promise<{
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    lockedTasks: number;
    progressPercentage: number;
    taskDetails: any[];
  }> {
    // Get all tasks for the course
    const tasks = await this.taskRepository.find({
      where: { course: { id: courseId } },
      order: { order: 'ASC' },
    });

    // Get all task progress for the enrollment
    const progressList = await this.taskProgressRepository.find({
      where: { enrollment: { id: enrollmentId } },
      relations: ['task'],
    });

    let completedTasks = 0;
    let inProgressTasks = 0;
    let lockedTasks = 0;

    const taskDetails = [];

    for (const task of tasks) {
      const progress = progressList.find(p => p.task.id === task.id);
      
      const taskInfo = {
        taskId: task.id,
        title: task.title,
        type: task.type,
        order: task.order,
        status: progress ? progress.status : 'LOCKED',
        completionPercentage: progress ? progress.completionPercentage : 0,
        isLocked: !progress || progress.status === 'LOCKED',
      };

      taskDetails.push(taskInfo);

      if (progress) {
        if (progress.status === 'COMPLETED') {
          completedTasks++;
        } else if (progress.status === 'IN_PROGRESS') {
          inProgressTasks++;
        } else if (progress.status === 'LOCKED') {
          lockedTasks++;
        }
      } else {
        lockedTasks++;
      }
    }

    const progressPercentage =
      tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    return {
      totalTasks: tasks.length,
      completedTasks,
      inProgressTasks,
      lockedTasks,
      progressPercentage,
      taskDetails,
    };
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
                const task = await this.createTask(
                  courseId,
                  taskData.title,
                  taskData.description || '',
                  taskData.type || 'OTHER',
                  taskData.order || 1,
                  taskData.prerequisiteTaskId || null,
                  taskData.completionCriteria || {},
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

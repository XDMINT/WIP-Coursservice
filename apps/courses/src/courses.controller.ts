/**
 * Courses Controller - Handles all HTTP requests related to course management
 * 
 * This controller provides endpoints for managing courses, learning materials,
 * assignments, grades, tasks, content releases, templates, groups, and calendar events.
 * 
 * @module CoursesController
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';

import { LearningMaterial } from './entities/learning-material.entity';
import { Assignment } from './entities/assignment.entity';
import { Grade } from './entities/grade.entity';
import { Task } from './entities/task.entity';
import { TaskProgress } from './entities/task-progress.entity';
import { ContentRelease } from './entities/content-release.entity';
import { ContentTemplate } from './entities/content-template.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { CalendarEvent } from './entities/calendar-event.entity';
import { Course } from './entities/course.entity';

/**
 * Courses Controller class
 * 
 * Handles all course-related API endpoints and delegates business logic to CoursesService
 */
@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    // =========================
    // COURSE CRUD
    // =========================

    @Get()
    getCourses(@Query('userId') userId?: string) {
        return this.coursesService.findAll(
            userId != null ? userId : undefined,
        );
    }

    @Get(':id')
    getCourse(@Param('id') id: string) {
        return this.coursesService.findOne(id);
    }

    @Get(':id/user/:userId/role')
    getUserRoleInCourse(
        @Param('id') id: string,
        @Param('userId') userId: string,
    ) {
        return this.coursesService.getUserRoleInCourse(
            id,
            userId,
        );
    }

    @Get(':id/members')
    getCourseMembers(@Param('id') id: string) {
        return this.coursesService.getCourseMembers(id);
    }

    @Post()
    createCourse(@Body() body: any) {
        return this.coursesService.createCourse(body);
    }

    @Post(':id/join')
    joinCourse(
        @Param('id') id: string,
        @Body() body: { key?: string; userId: number | string },
    ) {
        return this.coursesService.joinCourse(
            id,
            body.userId,
            body.key,
        );
    }

    @Post(':id/leave')
    leaveCourse(
        @Param('id') id: string,
        @Body() body: { userId?: number | string },
    ) {
        return this.coursesService.leaveCourse(
            id,
            body.userId != null ? body.userId : undefined,
        );
    }

    @Put(':id')
    updateCourse(@Param('id') id: string, @Body() body: any) {
        return this.coursesService.updateCourse(id, body);
    }

    @Put(':id/user/:userId/role')
    changeUserRole(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @Body() body: { role: string },
    ) {
        return this.coursesService.changeUserRole(
            id,
            userId,
            body.role,
        );
    }

    @Delete(':id')
    deleteCourse(@Param('id') id: string) {
        return this.coursesService.removeCourse(id);
    }
  /**
   * Create a new learning material for a course
   * 
   * @param {string} courseId - The ID of the course to add the learning material to
   * @param {Object} body - Learning material data
   * @param {string} body.title - Title of the learning material
   * @param {string} body.description - Description of the learning material
   * @param {string} body.type - Type of learning material (e.g., 'PRESENTATION', 'DOCUMENT', 'VIDEO')
   * @param {string} body.url - URL to the learning material
   * @param {string} body.filePath - File path for uploaded materials
   * @param {string} body.createdBy - User ID of the creator
   * @returns {Promise<LearningMaterial>} The created learning material
   * @example
   * POST /courses/{courseId}/learning-materials
   * {
   *   "title": "Introduction to Computer Science",
   *   "description": "Week 1 lecture slides",
   *   "type": "PRESENTATION",
   *   "url": "https://example.com/slides.pdf",
   *   "filePath": "/uploads/course-123/slides.pdf",
   *   "createdBy": "teacher-123"
   * }
   */
  @Post(':courseId/learning-materials')
  async createLearningMaterial(
    @Param('courseId') courseId: string,
    @Body() body: {
      title: string;
      description: string;
      type: string;
      url: string;
      filePath: string;
      createdBy: string;
    },
  ): Promise<LearningMaterial> {
    return this.coursesService.createLearningMaterial(
      courseId,
      body.title,
      body.description,
      body.type,
      body.url,
      body.filePath,
      body.createdBy,
    );
  }

  @Get(':courseId/learning-materials')
  async getLearningMaterialsByCourse(
    @Param('courseId') courseId: string,
  ): Promise<LearningMaterial[]> {
    return this.coursesService.getLearningMaterialsByCourse(courseId);
  }

  @Get('learning-materials/:id')
  async getLearningMaterialById(@Param('id') id: string): Promise<LearningMaterial> {
    return this.coursesService.getLearningMaterialById(id);
  }

  @Put('learning-materials/:id')
  async updateLearningMaterial(
    @Param('id') id: string,
    @Body() body: {
      title: string;
      description: string;
      type: string;
      url: string;
      filePath: string;
      isPublished: boolean;
      updatedBy: string;
    },
  ): Promise<LearningMaterial> {
    return this.coursesService.updateLearningMaterial(
      id,
      body.title,
      body.description,
      body.type,
      body.url,
      body.filePath,
      body.isPublished,
      body.updatedBy,
    );
  }

  @Delete('learning-materials/:id')
  async deleteLearningMaterial(@Param('id') id: string): Promise<void> {
    return this.coursesService.deleteLearningMaterial(id);
  }

  @Post('learning-materials/:id/publish')
  async publishLearningMaterial(
    @Param('id') id: string,
    @Body() body: { updatedBy: string },
  ): Promise<LearningMaterial> {
    return this.coursesService.publishLearningMaterial(id, body.updatedBy);
  }

  @Post('learning-materials/:id/unpublish')
  async unpublishLearningMaterial(
    @Param('id') id: string,
    @Body() body: { updatedBy: string },
  ): Promise<LearningMaterial> {
    return this.coursesService.unpublishLearningMaterial(id, body.updatedBy);
  }

  // Assignment endpoints
  @Post(':courseId/assignments')
  async createAssignment(
    @Param('courseId') courseId: string,
    @Body() body: {
      title: string;
      description: string;
      type: string;
      maxPoints: number;
      weight: number;
      dueDate: Date;
      createdBy: string;
    },
  ): Promise<Assignment> {
    return this.coursesService.createAssignment(
      courseId,
      body.title,
      body.description,
      body.type,
      body.maxPoints,
      body.weight,
      body.dueDate,
      body.createdBy,
    );
  }

  @Get(':courseId/assignments')
  async getAssignmentsByCourse(
    @Param('courseId') courseId: string,
  ): Promise<Assignment[]> {
    return this.coursesService.getAssignmentsByCourse(courseId);
  }

  @Get('assignments/:id')
  async getAssignmentById(@Param('id') id: string): Promise<Assignment> {
    return this.coursesService.getAssignmentById(id);
  }

  @Put('assignments/:id')
  async updateAssignment(
    @Param('id') id: string,
    @Body() body: {
      title: string;
      description: string;
      type: string;
      maxPoints: number;
      weight: number;
      dueDate: Date;
      isPublished: boolean;
      isGraded: boolean;
      updatedBy: string;
    },
  ): Promise<Assignment> {
    return this.coursesService.updateAssignment(
      id,
      body.title,
      body.description,
      body.type,
      body.maxPoints,
      body.weight,
      body.dueDate,
      body.isPublished,
      body.isGraded,
      body.updatedBy,
    );
  }

  @Delete('assignments/:id')
  async deleteAssignment(@Param('id') id: string): Promise<void> {
    return this.coursesService.deleteAssignment(id);
  }

  @Post('assignments/:id/publish')
  async publishAssignment(
    @Param('id') id: string,
    @Body() body: { updatedBy: string },
  ): Promise<Assignment> {
    return this.coursesService.publishAssignment(id, body.updatedBy);
  }

  @Post('assignments/:id/unpublish')
  async unpublishAssignment(
    @Param('id') id: string,
    @Body() body: { updatedBy: string },
  ): Promise<Assignment> {
    return this.coursesService.unpublishAssignment(id, body.updatedBy);
  }

  // Grade endpoints
  @Post('assignments/:assignmentId/grades')
  async createGrade(
    @Param('assignmentId') assignmentId: string,
    @Body() body: {
      enrollmentId: string;
      pointsAchieved: number;
      feedback: string;
      gradedBy: string;
      isFinal: boolean;
    },
  ): Promise<Grade> {
    return this.coursesService.createGrade(
      assignmentId,
      body.enrollmentId,
      body.pointsAchieved,
      body.feedback,
      body.gradedBy,
      body.isFinal,
    );
  }

  @Get('assignments/:assignmentId/grades')
  async getGradesByAssignment(
    @Param('assignmentId') assignmentId: string,
  ): Promise<Grade[]> {
    return this.coursesService.getGradesByAssignment(assignmentId);
  }

  @Get('enrollments/:enrollmentId/grades')
  async getGradesByEnrollment(
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<Grade[]> {
    return this.coursesService.getGradesByEnrollment(enrollmentId);
  }

  @Get('grades/:id')
  async getGradeById(@Param('id') id: string): Promise<Grade> {
    return this.coursesService.getGradeById(id);
  }

  @Put('grades/:id')
  async updateGrade(
    @Param('id') id: string,
    @Body() body: {
      pointsAchieved: number;
      feedback: string;
      gradedBy: string;
      isFinal: boolean;
      updatedBy: string;
    },
  ): Promise<Grade> {
    return this.coursesService.updateGrade(
      id,
      body.pointsAchieved,
      body.feedback,
      body.gradedBy,
      body.isFinal,
      body.updatedBy,
    );
  }

  @Delete('grades/:id')
  async deleteGrade(@Param('id') id: string): Promise<void> {
    return this.coursesService.deleteGrade(id);
  }

  @Get('courses/:courseId/enrollments/:enrollmentId/grade')
  async calculateCourseGrade(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<{ grade: number; passed: boolean }> {
    return this.coursesService.calculateCourseGrade(courseId, enrollmentId);
  }

  @Get('courses/:courseId/performance')
  async getCoursePerformance(
    @Param('courseId') courseId: string,
  ): Promise<any> {
    return this.coursesService.getCoursePerformance(courseId);
  }

  // Task endpoints
  @Post(':courseId/tasks')
  async createTask(
    @Param('courseId') courseId: string,
    @Body() body: {
      title: string;
      description: string;
      type: string;
      order: number;
      prerequisiteTaskId: string;
      completionCriteria: any;
      createdBy: string;
    },
  ): Promise<Task> {
    return this.coursesService.createTask(
      courseId,
      body.title,
      body.description,
      body.type,
      body.order,
      body.prerequisiteTaskId,
      body.completionCriteria,
      body.createdBy,
    );
  }

  @Get(':courseId/tasks')
  async getTasksByCourse(@Param('courseId') courseId: string): Promise<Task[]> {
    return this.coursesService.getTasksByCourse(courseId);
  }

  @Get('tasks/:id')
  async getTaskById(@Param('id') id: string): Promise<Task> {
    return this.coursesService.getTaskById(id);
  }

  @Put('tasks/:id')
  async updateTask(
    @Param('id') id: string,
    @Body() body: {
      title: string;
      description: string;
      type: string;
      order: number;
      prerequisiteTaskId: string;
      completionCriteria: any;
      isPublished: boolean;
      updatedBy: string;
    },
  ): Promise<Task> {
    return this.coursesService.updateTask(
      id,
      body.title,
      body.description,
      body.type,
      body.order,
      body.prerequisiteTaskId,
      body.completionCriteria,
      body.isPublished,
      body.updatedBy,
    );
  }

  @Delete('tasks/:id')
  async deleteTask(@Param('id') id: string): Promise<void> {
    return this.coursesService.deleteTask(id);
  }

  @Post('tasks/:id/publish')
  async publishTask(
    @Param('id') id: string,
    @Body() body: { updatedBy: string },
  ): Promise<Task> {
    return this.coursesService.publishTask(id, body.updatedBy);
  }

  @Post('tasks/:id/unpublish')
  async unpublishTask(
    @Param('id') id: string,
    @Body() body: { updatedBy: string },
  ): Promise<Task> {
    return this.coursesService.unpublishTask(id, body.updatedBy);
  }

  // Task Progress endpoints
  @Post('tasks/:taskId/progress')
  async createTaskProgress(
    @Param('taskId') taskId: string,
    @Body() body: {
      enrollmentId: string;
      createdBy: string;
    },
  ): Promise<TaskProgress> {
    return this.coursesService.createTaskProgress(
      taskId,
      body.enrollmentId,
      body.createdBy,
    );
  }

  @Get('task-progress/:id')
  async getTaskProgressById(@Param('id') id: string): Promise<TaskProgress> {
    return this.coursesService.getTaskProgressById(id);
  }

  @Get('tasks/:taskId/enrollments/:enrollmentId/progress')
  async getTaskProgressByTaskAndEnrollment(
    @Param('taskId') taskId: string,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<TaskProgress> {
    return this.coursesService.getTaskProgressByTaskAndEnrollment(
      taskId,
      enrollmentId,
    );
  }

  @Get('enrollments/:enrollmentId/task-progress')
  async getTaskProgressByEnrollment(
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<TaskProgress[]> {
    return this.coursesService.getTaskProgressByEnrollment(enrollmentId);
  }

  @Put('task-progress/:id')
  async updateTaskProgress(
    @Param('id') id: string,
    @Body() body: {
      status: string;
      completionPercentage: number;
      progressData: any;
      updatedBy: string;
    },
  ): Promise<TaskProgress> {
    return this.coursesService.updateTaskProgress(
      id,
      body.status,
      body.completionPercentage,
      body.progressData,
      body.updatedBy,
    );
  }

  @Post('task-progress/:id/start')
  async startTaskProgress(
    @Param('id') id: string,
    @Body() body: { updatedBy: string },
  ): Promise<TaskProgress> {
    return this.coursesService.startTaskProgress(id, body.updatedBy);
  }

  @Post('task-progress/:id/complete')
  async completeTaskProgress(
    @Param('id') id: string,
    @Body() body: { updatedBy: string },
  ): Promise<TaskProgress> {
    return this.coursesService.completeTaskProgress(id, body.updatedBy);
  }

  @Post('task-progress/:id/unlock')
  async unlockTaskProgress(
    @Param('id') id: string,
    @Body() body: { updatedBy: string },
  ): Promise<TaskProgress> {
    return this.coursesService.unlockTaskProgress(id, body.updatedBy);
  }

  @Get('tasks/:taskId/enrollments/:enrollmentId/prerequisites')
  async checkTaskPrerequisites(
    @Param('taskId') taskId: string,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<{ canAccess: boolean; missingPrerequisites: string[] }> {
    return this.coursesService.checkTaskPrerequisites(taskId, enrollmentId);
  }

  @Post('tasks/:completedTaskId/enrollments/:enrollmentId/unlock-next')
  async unlockNextTasks(
    @Param('completedTaskId') completedTaskId: string,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<TaskProgress[]> {
    return this.coursesService.unlockNextTasks(completedTaskId, enrollmentId);
  }

  @Get('courses/:courseId/enrollments/:enrollmentId/learning-path')
  async getLearningPathProgress(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<{
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    lockedTasks: number;
    progressPercentage: number;
    taskDetails: any[];
  }> {
    return this.coursesService.getLearningPathProgress(courseId, enrollmentId);
  }

  // Content Release endpoints
  @Post(':courseId/content-releases')
  async createContentRelease(
    @Param('courseId') courseId: string,
    @Body() body: {
      contentType: string;
      contentId: string;
      releaseType: string;
      releaseDate: Date;
      releaseConditions: any;
      createdBy: string;
    },
  ): Promise<ContentRelease> {
    return this.coursesService.createContentRelease(
      courseId,
      body.contentType,
      body.contentId,
      body.releaseType,
      body.releaseDate,
      body.releaseConditions,
      body.createdBy,
    );
  }

  @Get(':courseId/content-releases')
  async getContentReleasesByCourse(
    @Param('courseId') courseId: string,
  ): Promise<ContentRelease[]> {
    return this.coursesService.getContentReleasesByCourse(courseId);
  }

  @Get('content-releases/:id')
  async getContentReleaseById(@Param('id') id: string): Promise<ContentRelease> {
    return this.coursesService.getContentReleaseById(id);
  }

  @Put('content-releases/:id')
  async updateContentRelease(
    @Param('id') id: string,
    @Body() body: {
      contentType: string;
      contentId: string;
      releaseType: string;
      releaseDate: Date;
      releaseConditions: any;
      isActive: boolean;
      updatedBy: string;
    },
  ): Promise<ContentRelease> {
    return this.coursesService.updateContentRelease(
      id,
      body.contentType,
      body.contentId,
      body.releaseType,
      body.releaseDate,
      body.releaseConditions,
      body.isActive,
      body.updatedBy,
    );
  }

  @Delete('content-releases/:id')
  async deleteContentRelease(@Param('id') id: string): Promise<void> {
    return this.coursesService.deleteContentRelease(id);
  }

  @Post('content-releases/:id/release')
  async releaseContentManually(
    @Param('id') id: string,
    @Body() body: { releasedBy: string },
  ): Promise<ContentRelease> {
    return this.coursesService.releaseContentManually(id, body.releasedBy);
  }

  @Post('courses/:courseId/check-automatic-releases')
  async checkAutomaticReleases(
    @Param('courseId') courseId: string,
  ): Promise<ContentRelease[]> {
    return this.coursesService.checkAutomaticReleases(courseId);
  }

  @Post('courses/:courseId/enrollments/:enrollmentId/check-progress-releases')
  async checkProgressBasedReleases(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<ContentRelease[]> {
    return this.coursesService.checkProgressBasedReleases(courseId, enrollmentId);
  }

  @Get('courses/:courseId/enrollments/:enrollmentId/released-content')
  async getReleasedContentForEnrollment(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<any[]> {
    return this.coursesService.getReleasedContentForEnrollment(
      courseId,
      enrollmentId,
    );
  }

  @Get('courses/:courseId/content-release-status')
  async getContentReleaseStatus(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<any> {
    return this.coursesService.getContentReleaseStatus(courseId, enrollmentId);
  }

  // Content Template endpoints
  @Post(':courseId/content-templates')
  async createContentTemplate(
    @Param('courseId') courseId: string,
    @Body() body: {
      name: string;
      description: string;
      templateType: string;
      templateData: any;
      placeholders: any;
      isGlobal: boolean;
      createdBy: string;
    },
  ): Promise<ContentTemplate> {
    return this.coursesService.createContentTemplate(
      courseId,
      body.name,
      body.description,
      body.templateType,
      body.templateData,
      body.placeholders,
      body.isGlobal,
      body.createdBy,
    );
  }

  @Get(':courseId/content-templates')
  async getContentTemplatesByCourse(
    @Param('courseId') courseId: string,
  ): Promise<ContentTemplate[]> {
    return this.coursesService.getContentTemplatesByCourse(courseId);
  }

  @Get('content-templates/global')
  async getGlobalContentTemplates(): Promise<ContentTemplate[]> {
    return this.coursesService.getGlobalContentTemplates();
  }

  @Get('content-templates/:id')
  async getContentTemplateById(@Param('id') id: string): Promise<ContentTemplate> {
    return this.coursesService.getContentTemplateById(id);
  }

  @Put('content-templates/:id')
  async updateContentTemplate(
    @Param('id') id: string,
    @Body() body: {
      name: string;
      description: string;
      templateType: string;
      templateData: any;
      placeholders: any;
      isActive: boolean;
      isGlobal: boolean;
      updatedBy: string;
    },
  ): Promise<ContentTemplate> {
    return this.coursesService.updateContentTemplate(
      id,
      body.name,
      body.description,
      body.templateType,
      body.templateData,
      body.placeholders,
      body.isActive,
      body.isGlobal,
      body.updatedBy,
    );
  }

  @Delete('content-templates/:id')
  async deleteContentTemplate(@Param('id') id: string): Promise<void> {
    return this.coursesService.deleteContentTemplate(id);
  }

  @Post('courses/:courseId/templates/:templateId/apply')
  async applyTemplateToCourse(
    @Param('courseId') courseId: string,
    @Param('templateId') templateId: string,
    @Body() body: { appliedBy: string },
  ): Promise<any> {
    return this.coursesService.applyTemplateToCourse(
      templateId,
      courseId,
      body.appliedBy,
    );
  }

  @Get('courses/:courseId/available-templates')
  async getAvailableTemplatesForCourse(
    @Param('courseId') courseId: string,
  ): Promise<ContentTemplate[]> {
    return this.coursesService.getAvailableTemplatesForCourse(courseId);
  }

  // Search endpoints
  @Get('search/courses')
  async searchCourses(
    @Query('query') query: string,
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ): Promise<Course[]> {
    return this.coursesService.searchCourses(query, limit, offset);
  }

  @Get('courses/:courseId/search')
  async searchWithinCourse(
    @Param('courseId') courseId: string,
    @Query('query') query: string,
    @Query('contentTypes') contentTypes: string[] = ['LEARNING_MATERIAL', 'ASSIGNMENT', 'TASK'],
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ): Promise<any> {
    return this.coursesService.searchWithinCourse(
      courseId,
      query,
      contentTypes,
      limit,
      offset,
    );
  }

  @Get('search/advanced')
  async advancedSearch(
    @Query('query') query: string,
    @Query('contentTypes') contentTypes: string[] = ['COURSE', 'LEARNING_MATERIAL', 'ASSIGNMENT', 'TASK'],
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ): Promise<any> {
    return this.coursesService.advancedSearch(
      query,
      contentTypes,
      limit,
      offset,
    );
  }

  @Get('search/templates')
  async searchContentTemplates(
    @Query('query') query: string,
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ): Promise<ContentTemplate[]> {
    return this.coursesService.searchContentTemplates(query, limit, offset);
  }

  // Workgroup endpoints
  @Post(':courseId/groups')
  async createCourseGroup(
    @Param('courseId') courseId: string,
    @Body() body: {
      name: string;
      description: string;
      groupType: string;
      createdBy: string;
    },
  ): Promise<CourseGroup> {
    return this.coursesService.createCourseGroup(
      courseId,
      body.name,
      body.description,
      body.groupType,
      body.createdBy,
    );
  }

  @Get(':courseId/groups')
  async getCourseGroupsByCourse(
    @Param('courseId') courseId: string,
  ): Promise<CourseGroup[]> {
    return this.coursesService.getCourseGroupsByCourse(courseId);
  }

  @Get('groups/:id')
  async getCourseGroupById(@Param('id') id: string): Promise<CourseGroup> {
    return this.coursesService.getCourseGroupById(id);
  }

  @Put('groups/:id')
  async updateCourseGroup(
    @Param('id') id: string,
    @Body() body: {
      name: string;
      description: string;
      groupType: string;
      isActive: boolean;
      groupGrade: number;
      groupFeedback: string;
      updatedBy: string;
    },
  ): Promise<CourseGroup> {
    return this.coursesService.updateCourseGroup(
      id,
      body.name,
      body.description,
      body.groupType,
      body.isActive,
      body.groupGrade,
      body.groupFeedback,
      body.updatedBy,
    );
  }

  @Delete('groups/:id')
  async deleteCourseGroup(@Param('id') id: string): Promise<void> {
    return this.coursesService.deleteCourseGroup(id);
  }

  @Post('groups/:groupId/members')
  async addMemberToGroup(
    @Param('groupId') groupId: string,
    @Body() body: {
      userId: string;
      role: string;
      addedBy: string;
    },
  ): Promise<GroupMembership> {
    return this.coursesService.addMemberToGroup(
      groupId,
      body.userId,
      body.role,
      body.addedBy,
    );
  }

  @Delete('groups/:groupId/members/:userId')
  async removeMemberFromGroup(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.coursesService.removeMemberFromGroup(groupId, userId);
  }

  @Put('groups/:groupId/members/:userId/role')
  async updateGroupMembershipRole(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Body() body: { role: string },
  ): Promise<GroupMembership> {
    return this.coursesService.updateGroupMembershipRole(
      groupId,
      userId,
      body.role,
    );
  }

  @Get('groups/:groupId/members')
  async getGroupMembers(@Param('groupId') groupId: string): Promise<GroupMembership[]> {
    return this.coursesService.getGroupMembers(groupId);
  }

  @Get('courses/:courseId/users/:userId/groups')
  async getGroupsForUser(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
  ): Promise<CourseGroup[]> {
    return this.coursesService.getGroupsForUser(courseId, userId);
  }

  @Get('groups/:groupId/members/:userId')
  async getGroupMembership(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ): Promise<GroupMembership> {
    return this.coursesService.getGroupMembership(groupId, userId);
  }

  @Post('groups/:groupId/grade')
  async assignGroupGrade(
    @Param('groupId') groupId: string,
    @Body() body: {
      grade: number;
      feedback: string;
      updatedBy: string;
    },
  ): Promise<CourseGroup> {
    return this.coursesService.assignGroupGrade(
      groupId,
      body.grade,
      body.feedback,
      body.updatedBy,
    );
  }

  @Post('groups/:groupId/members/:userId/grade')
  async assignIndividualGrade(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Body() body: {
      grade: number;
      feedback: string;
    },
  ): Promise<GroupMembership> {
    return this.coursesService.assignIndividualGrade(
      groupId,
      userId,
      body.grade,
      body.feedback,
    );
  }

  @Get('groups/:groupId/performance')
  async getGroupPerformance(@Param('groupId') groupId: string): Promise<any> {
    return this.coursesService.getGroupPerformance(groupId);
  }

  @Post('courses/:courseId/groups/auto-create')
  async autoCreateWorkgroups(
    @Param('courseId') courseId: string,
    @Body() body: {
      groupSize: number;
      groupPrefix: string;
      createdBy: string;
    },
  ): Promise<CourseGroup[]> {
    return this.coursesService.autoCreateWorkgroups(
      courseId,
      body.groupSize,
      body.groupPrefix,
      body.createdBy,
    );
  }

  @Get('groups/:groupId/courses/:courseId/progress')
  async getGroupLearningProgress(
    @Param('groupId') groupId: string,
    @Param('courseId') courseId: string,
  ): Promise<any> {
    return this.coursesService.getGroupLearningProgress(groupId, courseId);
  }

  // Calendar endpoints
  @Post(':courseId/calendar/events')
  async createCalendarEvent(
    @Param('courseId') courseId: string,
    @Body() body: {
      title: string;
      description: string;
      eventType: string;
      startTime: Date;
      endTime: Date;
      location: string;
      onlineLink: string;
      isAllDay: boolean;
      isRecurring: boolean;
      recurrencePattern: any;
      relatedContentId: string;
      relatedContentType: string;
      createdBy: string;
    },
  ): Promise<CalendarEvent> {
    return this.coursesService.createCalendarEvent(
      courseId,
      body.title,
      body.description,
      body.eventType,
      body.startTime,
      body.endTime,
      body.location,
      body.onlineLink,
      body.isAllDay,
      body.isRecurring,
      body.recurrencePattern,
      body.relatedContentId,
      body.relatedContentType,
      body.createdBy,
    );
  }

  @Get(':courseId/calendar/events')
  async getCalendarEventsByCourse(
    @Param('courseId') courseId: string,
    @Param('startDate') startDate: Date,
    @Param('endDate') endDate: Date,
  ): Promise<CalendarEvent[]> {
    return this.coursesService.getCalendarEventsByCourse(
      courseId,
      startDate,
      endDate,
    );
  }

  @Get('calendar/events/:id')
  async getCalendarEventById(@Param('id') id: string): Promise<CalendarEvent> {
    return this.coursesService.getCalendarEventById(id);
  }

  @Put('calendar/events/:id')
  async updateCalendarEvent(
    @Param('id') id: string,
    @Body() body: {
      title: string;
      description: string;
      eventType: string;
      startTime: Date;
      endTime: Date;
      location: string;
      onlineLink: string;
      isAllDay: boolean;
      isRecurring: boolean;
      recurrencePattern: any;
      relatedContentId: string;
      relatedContentType: string;
      updatedBy: string;
    },
  ): Promise<CalendarEvent> {
    return this.coursesService.updateCalendarEvent(
      id,
      body.title,
      body.description,
      body.eventType,
      body.startTime,
      body.endTime,
      body.location,
      body.onlineLink,
      body.isAllDay,
      body.isRecurring,
      body.recurrencePattern,
      body.relatedContentId,
      body.relatedContentType,
      body.updatedBy,
    );
  }

  @Delete('calendar/events/:id')
  async deleteCalendarEvent(@Param('id') id: string): Promise<void> {
    return this.coursesService.deleteCalendarEvent(id);
  }

  @Post('courses/:courseId/calendar/assignment-events')
  async createAssignmentDueDateEvents(
    @Param('courseId') courseId: string,
    @Body() body: { createdBy: string },
  ): Promise<CalendarEvent[]> {
    return this.coursesService.createAssignmentDueDateEvents(
      courseId,
      body.createdBy,
    );
  }

  @Get('courses/:courseId/calendar/upcoming')
  async getUpcomingEvents(
    @Param('courseId') courseId: string,
    @Param('limit') limit: number = 5,
  ): Promise<CalendarEvent[]> {
    return this.coursesService.getUpcomingEvents(courseId, limit);
  }

  @Get('courses/:courseId/calendar/range')
  async getEventsByDateRange(
    @Param('courseId') courseId: string,
    @Param('startDate') startDate: Date,
    @Param('endDate') endDate: Date,
  ): Promise<CalendarEvent[]> {
    return this.coursesService.getEventsByDateRange(courseId, startDate, endDate);
  }

  @Get('courses/:courseId/calendar/daily')
  async getDailyEvents(
    @Param('courseId') courseId: string,
    @Param('date') date: Date,
  ): Promise<CalendarEvent[]> {
    return this.coursesService.getDailyEvents(courseId, date);
  }

  @Get('courses/:courseId/calendar/monthly')
  async getMonthlyEvents(
    @Param('courseId') courseId: string,
    @Param('year') year: number,
    @Param('month') month: number,
  ): Promise<CalendarEvent[]> {
    return this.coursesService.getMonthlyEvents(courseId, year, month);
  }

  @Post('courses/:courseId/calendar/sync-assignments')
  async syncAssignmentDueDates(
    @Param('courseId') courseId: string,
    @Body() body: { createdBy: string },
  ): Promise<{ created: CalendarEvent[]; deleted: number }> {
    return this.coursesService.syncAssignmentDueDates(courseId, body.createdBy);
  }
}

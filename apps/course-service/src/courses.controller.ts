/**
 * Courses Controller - Handles all HTTP requests related to course management
 * 
 * This controller provides endpoints for managing courses, learning materials,
 * assignments, grades, tasks, content releases, templates, groups, and calendar events.
 * 
 * @module CoursesController
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { CoursesService } from './courses.service';
import { getRequestActor } from './common/request-actor';
import { ApiUnauthorizedError, ApiValidationError } from './common/api-errors';

import { Assignment } from './entities/assignment.entity';
import { Grade } from './entities/grade.entity';
import { ContentRelease } from './entities/content-release.entity';
import { ContentTemplate } from './entities/content-template.entity';
import { CalendarEvent } from './entities/calendar-event.entity';
import { Course } from './entities/course.entity';
import {
  AuditEventListQueryDto,
  AuditEventResponseDto,
} from './dto/audit-event.dto';
import {
  CourseCatalogItemResponseDto,
  CourseRunDeletionResponseDto,
  CourseRunPlanResponseDto,
  CourseRunResponseDto,
  CourseVersionResponseDto,
  CreateCourseRunDto,
  CreateCourseVersionDto,
  EnrollmentResponseDto,
  UpdateCourseRunPlanTemplateDto,
} from './dto/course.dto';
import {
  CreateLearningTaskDto,
  LearningPathResponseDto,
  LearningTaskResponseDto,
  ManualTaskAssessmentDto,
  ManualUnlockLearningTaskDto,
  MockEvaluateLearningTaskDto,
  StudentProgressOverviewDto,
  SubmitLearningTaskDto,
  TaskAssessmentResponseDto,
  UpdateLearningTaskDto,
  UpdateLearningTaskReleaseConfigDto,
  UpdateLearningTaskSortDto,
} from './dto/learning-process.dto';
import {
  AddStudyGroupMemberDto,
  CreateStudyGroupDto,
  ManualGroupTaskAssessmentDto,
  StudyGroupResponseDto,
  UpdateStudyGroupDto,
} from './dto/study-group.dto';
const maxMaterialUploadBytes = () =>
  Number(process.env.COURSE_MATERIAL_MAX_FILE_SIZE_BYTES ?? 50 * 1024 * 1024);

const contentDispositionFileName = (fileName: string): string =>
  fileName.replace(/["\\\r\n]/g, '_');

/**
 * Courses Controller class
 * 
 * Handles all course-related API endpoints and delegates business logic to CoursesService
 */
@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) {}

    private getActorUserId(request: Request): string {
        const actorUserId = getRequestActor(request).userId;

        if (!actorUserId) {
            throw new ApiUnauthorizedError();
        }

        return actorUserId;
    }

    // =========================
    // COURSE CRUD
    // =========================

    @Get()
    getCourses(@Query('userId') userId?: string) {
        return this.coursesService.findAll(
            userId != null ? userId : undefined,
        );
    }

    @Get('available')
    getAvailableCourses(
        @Req() request: Request,
    ): Promise<CourseCatalogItemResponseDto[]> {
        return this.coursesService.getAvailableCourses(
            getRequestActor(request).userId,
        );
    }

    @Get('enrolled')
    getEnrolledCourses(
        @Req() request: Request,
    ): Promise<CourseCatalogItemResponseDto[]> {
        return this.coursesService.getEnrolledCourses(
            getRequestActor(request).userId,
        );
    }

    @Get(':id')
    getCourse(@Param('id') id: string) {
        return this.coursesService.findOne(id);
    }

    @Get(':id/context')
    getCourseContext(
        @Param('id') id: string,
        @Req() request: Request,
    ) {
        return this.coursesService.getCourseContext(
            id,
            getRequestActor(request).userId,
        );
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
    getCourseMembers(
        @Param('id') id: string,
        @Req() request: Request,
    ) {
        return this.coursesService.getCourseMembers(
            id,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/audit-events')
    listAuditEvents(
        @Param('id') id: string,
        @Query() query: AuditEventListQueryDto,
        @Req() request: Request,
    ): Promise<AuditEventResponseDto[]> {
        return this.coursesService.listAuditEvents(
            id,
            query,
            getRequestActor(request).userId,
        );
    }

    @Post()
    createCourse(
        @Body() body: any,
        @Req() request: Request,
    ) {
        return this.coursesService.createCourse(
            body,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/join')
    joinCourse(
        @Param('id') id: string,
        @Body() body: { key?: string; userId: number | string },
    ): Promise<EnrollmentResponseDto> {
        return this.coursesService.joinCourse(
            id,
            body.userId,
            body.key,
        );
    }

    @Post(':id/enroll')
    enrollCourse(
        @Param('id') id: string,
        @Body() body: { key?: string },
        @Req() request: Request,
    ): Promise<EnrollmentResponseDto> {
        return this.coursesService.enrollInCourse(
            id,
            getRequestActor(request).userId,
            body?.key,
        );
    }

    @Post(':id/leave')
    leaveCourse(
        @Param('id') id: string,
        @Body() body: { userId?: number | string },
        @Req() request: Request,
    ) {
        return this.coursesService.leaveCourse(
            id,
            body.userId != null ? body.userId : undefined,
            getRequestActor(request).userId,
        );
    }

    @Delete(':id/enrollment')
    deleteOwnEnrollment(
        @Param('id') id: string,
        @Req() request: Request,
    ): Promise<void> {
        const actorId = getRequestActor(request).userId;

        return this.coursesService.leaveCourse(
            id,
            actorId,
            actorId,
        );
    }

    @Get(':id/runs')
    listCourseRuns(
        @Param('id') id: string,
        @Req() request: Request,
    ): Promise<CourseRunResponseDto[]> {
        return this.coursesService.listCourseRuns(
            id,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/current')
    getCurrentCourseRun(
        @Param('id') id: string,
        @Req() request: Request,
    ): Promise<CourseRunResponseDto> {
        return this.coursesService.getCurrentCourseRun(
            id,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId/materials')
    getLearningMaterialsByCourseRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Req() request: Request,
    ) {
        return this.coursesService.getLearningMaterialsByCourseRun(
            id,
            runId,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId/tasks')
    getTasksByCourseRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Req() request: Request,
    ): Promise<LearningTaskResponseDto[]> {
        return this.coursesService.getTasksByCourseRun(
            id,
            runId,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId/enrollments')
    getCourseMembersByRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Req() request: Request,
    ): Promise<EnrollmentResponseDto[]> {
        return this.coursesService.getCourseMembersByRun(
            id,
            runId,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId/progress')
    getLearningTaskProgressOverviewByRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Req() request: Request,
    ): Promise<StudentProgressOverviewDto[]> {
        return this.coursesService.getLearningTaskProgressOverviewByRun(
            id,
            runId,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId/assessments')
    getTaskAssessmentsByRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Req() request: Request,
    ): Promise<TaskAssessmentResponseDto[]> {
        return this.coursesService.listTaskAssessmentsByRun(
            id,
            runId,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId/audit-events')
    listAuditEventsByRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Query() query: AuditEventListQueryDto,
        @Req() request: Request,
    ): Promise<AuditEventResponseDto[]> {
        return this.coursesService.listAuditEvents(
            id,
            { ...query, courseRunId: runId },
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId/tasks/:taskId/assessments')
    getTaskAssessmentsByTask(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Param('taskId') taskId: string,
        @Req() request: Request,
    ): Promise<TaskAssessmentResponseDto[]> {
        return this.coursesService.listTaskAssessmentsByTask(
            id,
            runId,
            taskId,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/runs/:runId/tasks/:taskId/assessments/:studentId/manual')
    setManualTaskAssessment(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Param('taskId') taskId: string,
        @Param('studentId') studentId: string,
        @Body() body: ManualTaskAssessmentDto,
        @Req() request: Request,
    ): Promise<TaskAssessmentResponseDto> {
        return this.coursesService.setManualTaskAssessment(
            id,
            runId,
            taskId,
            studentId,
            body,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/runs/:runId/tasks/:taskId/assessments/:studentId/reset')
    resetTaskAssessment(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Param('taskId') taskId: string,
        @Param('studentId') studentId: string,
        @Req() request: Request,
    ): Promise<TaskAssessmentResponseDto> {
        return this.coursesService.resetTaskAssessment(
            id,
            runId,
            taskId,
            studentId,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId/versions')
    listCourseVersionsByRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Req() request: Request,
    ): Promise<CourseVersionResponseDto[]> {
        return this.coursesService.listCourseVersionsByRun(
            id,
            runId,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId/versions/:versionId/materials')
    getLearningMaterialsByCourseVersion(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Param('versionId') versionId: string,
        @Req() request: Request,
    ) {
        return this.coursesService.getLearningMaterialsByCourseVersion(
            id,
            runId,
            versionId,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId/versions/:versionId/tasks')
    getTasksByCourseVersion(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Param('versionId') versionId: string,
        @Req() request: Request,
    ): Promise<LearningTaskResponseDto[]> {
        return this.coursesService.getTasksByCourseVersion(
            id,
            runId,
            versionId,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/runs/:runId/versions')
    createCourseVersionForRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Body() body: CreateCourseVersionDto,
        @Req() request: Request,
    ): Promise<CourseVersionResponseDto> {
        return this.coursesService.createCourseVersionForRun(
            id,
            runId,
            body,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/runs/:runId/versions/:versionId/activate')
    activateCourseVersionForRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Param('versionId') versionId: string,
        @Req() request: Request,
    ): Promise<CourseVersionResponseDto> {
        return this.coursesService.activateCourseVersionForRun(
            id,
            runId,
            versionId,
            getRequestActor(request).userId,
        );
    }

    @Delete(':id/runs/:runId/versions/:versionId')
    deleteCourseVersion(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Param('versionId') versionId: string,
        @Req() request: Request,
    ): Promise<void> {
        return this.coursesService.deleteCourseVersion(
            id,
            runId,
            versionId,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/run-plan')
    getCourseRunPlan(
        @Param('id') id: string,
        @Req() request: Request,
    ): Promise<CourseRunPlanResponseDto> {
        return this.coursesService.getCourseRunPlan(
            id,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/run-plan/template')
    updateCourseRunPlanTemplate(
        @Param('id') id: string,
        @Body() body: UpdateCourseRunPlanTemplateDto,
        @Req() request: Request,
    ): Promise<CourseRunPlanResponseDto> {
        return this.coursesService.updateCourseRunPlanTemplate(
            id,
            body,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/runs/next')
    createNextCourseRun(
        @Param('id') id: string,
        @Body() body: CreateCourseRunDto,
        @Req() request: Request,
    ): Promise<CourseRunResponseDto> {
        return this.coursesService.createCourseRun(
            id,
            body,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/runs/special')
    createSpecialCourseRun(
        @Param('id') id: string,
        @Body() body: CreateCourseRunDto,
        @Req() request: Request,
    ): Promise<CourseRunResponseDto> {
        return this.coursesService.createSpecialCourseRun(
            id,
            body,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/runs/:runId')
    getCourseRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Req() request: Request,
    ): Promise<CourseRunResponseDto> {
        return this.coursesService.getCourseRun(
            id,
            runId,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/runs')
    createCourseRun(
        @Param('id') id: string,
        @Body() body: CreateCourseRunDto,
        @Req() request: Request,
    ): Promise<CourseRunResponseDto> {
        return this.coursesService.createSpecialCourseRun(
            id,
            body,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/runs/:runId/activate')
    activateCourseRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Req() request: Request,
    ): Promise<CourseRunResponseDto> {
        return this.coursesService.activateCourseRun(
            id,
            runId,
            getRequestActor(request).userId,
        );
    }

    @Delete(':id/runs/:runId')
    deleteOrArchiveCourseRun(
        @Param('id') id: string,
        @Param('runId') runId: string,
        @Req() request: Request,
    ): Promise<CourseRunDeletionResponseDto> {
        return this.coursesService.deleteOrArchiveCourseRun(
            id,
            runId,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/content-version-templates')
    listContentVersionTemplates(
        @Param('id') id: string,
        @Req() request: Request,
    ): Promise<CourseVersionResponseDto[]> {
        return this.coursesService.listCourseVersionTemplates(
            id,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/version-templates')
    listCourseVersionTemplates(
        @Param('id') id: string,
        @Req() request: Request,
    ): Promise<CourseVersionResponseDto[]> {
        return this.coursesService.listCourseVersionTemplates(
            id,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/versions')
    listCourseVersions(
        @Param('id') id: string,
        @Req() request: Request,
    ): Promise<CourseVersionResponseDto[]> {
        return this.coursesService.listCourseVersions(
            id,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/versions')
    createCourseVersion(
        @Param('id') id: string,
        @Body() body: CreateCourseVersionDto,
        @Req() request: Request,
    ): Promise<CourseVersionResponseDto> {
        return this.coursesService.createCourseVersion(
            id,
            body,
            getRequestActor(request).userId,
        );
    }

    @Get(':id/versions/:versionId')
    getCourseVersion(
        @Param('id') id: string,
        @Param('versionId') versionId: string,
        @Req() request: Request,
    ): Promise<CourseVersionResponseDto> {
        return this.coursesService.getCourseVersion(
            id,
            versionId,
            getRequestActor(request).userId,
        );
    }

    @Post(':id/versions/:versionId/activate')
    activateCourseVersion(
        @Param('id') id: string,
        @Param('versionId') versionId: string,
        @Req() request: Request,
    ): Promise<CourseVersionResponseDto> {
        return this.coursesService.activateCourseVersion(
            id,
            versionId,
            getRequestActor(request).userId,
        );
    }

    @Put(':id')
    updateCourse(
        @Param('id') id: string,
        @Body() body: any,
        @Req() request: Request,
    ) {
        return this.coursesService.updateCourse(
            id,
            body,
            getRequestActor(request).userId,
        );
    }

    @Put(':id/user/:userId/role')
    changeUserRole(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @Body() body: { role: string },
        @Req() request: Request,
    ) {
        return this.coursesService.changeUserRole(
            id,
            userId,
            body.role,
            getRequestActor(request).userId,
        );
    }

    @Delete(':id')
    deleteCourse(
        @Param('id') id: string,
        @Req() request: Request,
    ) {
        return this.coursesService.removeCourse(
            id,
            getRequestActor(request).userId,
        );
    }
  @Get(':courseId/materials')
  async listLearningMaterials(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ) {
    return this.coursesService.getLearningMaterialsByCourse(
      courseId,
      getRequestActor(request).userId,
    );
  }

  @Get('materials/:id')
  async getLearningMaterialById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.coursesService.getLearningMaterialById(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post(':courseId/materials/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: maxMaterialUploadBytes(),
      },
    }),
  )
  async uploadLearningMaterial(
    @Param('courseId') courseId: string,
    @Body() body: any,
    @UploadedFile() file: any,
    @Req() request: Request,
  ) {
    return this.coursesService.createLearningMaterialFile(
      courseId,
      body,
      file,
      getRequestActor(request).userId,
    );
  }

  @Post(':courseId/materials/link')
  async createExternalLearningMaterial(
    @Param('courseId') courseId: string,
    @Body() body: any,
    @Req() request: Request,
  ) {
    return this.coursesService.createExternalLearningMaterial(
      courseId,
      body,
      getRequestActor(request).userId,
    );
  }

  @Put(':courseId/materials/sort-order')
  async updateLearningMaterialSortOrder(
    @Param('courseId') courseId: string,
    @Body() body: any,
    @Req() request: Request,
  ) {
    return this.coursesService.updateLearningMaterialSortOrder(
      courseId,
      body,
      getRequestActor(request).userId,
    );
  }

  @Put('materials/:id')
  async updateLearningMaterial(
    @Param('id') id: string,
    @Body() body: any,
    @Req() request: Request,
  ) {
    return this.coursesService.updateLearningMaterialMetadata(
      id,
      body,
      getRequestActor(request).userId,
    );
  }

  @Post('materials/:id/publish')
  async publishLearningMaterial(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.coursesService.publishLearningMaterial(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post('materials/:id/withdraw')
  async withdrawLearningMaterial(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.coursesService.unpublishLearningMaterial(
      id,
      getRequestActor(request).userId,
    );
  }

  @Delete('materials/:id')
  async deleteLearningMaterial(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.coursesService.deleteLearningMaterial(
      id,
      getRequestActor(request).userId,
    );
  }

  @Get('materials/:id/download')
  async downloadLearningMaterial(
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const download = await this.coursesService.downloadLearningMaterial(
      id,
      getRequestActor(request).userId,
    );

    response.set({
      'Content-Disposition': `attachment; filename="${contentDispositionFileName(
        download.fileName,
      )}"`,
      'Content-Type': download.mimeType,
      ...(download.fileSize ? { 'Content-Length': String(download.fileSize) } : {}),
    });

    return new StreamableFile(download.stream);
  }

  @Post(':courseId/learning-materials')
  async createLearningMaterial(
    @Param('courseId') courseId: string,
    @Body() body: any,
    @Req() request: Request,
  ) {
    return this.coursesService.createExternalLearningMaterial(
      courseId,
      body,
      getRequestActor(request).userId,
    );
  }

  @Get(':courseId/learning-materials')
  async getLearningMaterialsByCourse(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ) {
    return this.coursesService.getLearningMaterialsByCourse(
      courseId,
      getRequestActor(request).userId,
    );
  }

  @Get('learning-materials/:id')
  async getLegacyLearningMaterialById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.coursesService.getLearningMaterialById(
      id,
      getRequestActor(request).userId,
    );
  }

  @Put('learning-materials/:id')
  async updateLegacyLearningMaterial(
    @Param('id') id: string,
    @Body() body: any,
    @Req() request: Request,
  ) {
    return this.coursesService.updateLearningMaterialMetadata(
      id,
      body,
      getRequestActor(request).userId,
    );
  }

  @Delete('learning-materials/:id')
  async deleteLegacyLearningMaterial(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.coursesService.deleteLearningMaterial(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post('learning-materials/:id/publish')
  async publishLegacyLearningMaterial(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.coursesService.publishLearningMaterial(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post('learning-materials/:id/unpublish')
  async unpublishLegacyLearningMaterial(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.coursesService.unpublishLearningMaterial(
      id,
      getRequestActor(request).userId,
    );
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
    @Req() request: Request,
  ): Promise<Assignment> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.createAssignment(
      courseId,
      body.title,
      body.description,
      body.type,
      body.maxPoints,
      body.weight,
      body.dueDate,
      actorUserId,
      actorUserId,
    );
  }

  @Get(':courseId/assignments')
  async getAssignmentsByCourse(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<Assignment[]> {
    return this.coursesService.getAssignmentsByCourse(
      courseId,
      this.getActorUserId(request),
    );
  }

  @Get('assignments/:id')
  async getAssignmentById(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Assignment> {
    return this.coursesService.getAssignmentById(
      id,
      this.getActorUserId(request),
    );
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
    @Req() request: Request,
  ): Promise<Assignment> {
    const actorUserId = this.getActorUserId(request);

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
      actorUserId,
      actorUserId,
    );
  }

  @Delete('assignments/:id')
  async deleteAssignment(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.coursesService.deleteAssignment(
      id,
      this.getActorUserId(request),
    );
  }

  @Post('assignments/:id/publish')
  async publishAssignment(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Assignment> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.publishAssignment(
      id,
      actorUserId,
      actorUserId,
    );
  }

  @Post('assignments/:id/unpublish')
  async unpublishAssignment(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Assignment> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.unpublishAssignment(
      id,
      actorUserId,
      actorUserId,
    );
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
    @Req() request: Request,
  ): Promise<Grade> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.createGrade(
      assignmentId,
      body.enrollmentId,
      body.pointsAchieved,
      body.feedback,
      actorUserId,
      body.isFinal,
      actorUserId,
    );
  }

  @Get('assignments/:assignmentId/grades')
  async getGradesByAssignment(
    @Param('assignmentId') assignmentId: string,
    @Req() request: Request,
  ): Promise<Grade[]> {
    return this.coursesService.getGradesByAssignment(
      assignmentId,
      this.getActorUserId(request),
    );
  }

  @Get('enrollments/:enrollmentId/grades')
  async getGradesByEnrollment(
    @Param('enrollmentId') enrollmentId: string,
    @Req() request: Request,
  ): Promise<Grade[]> {
    return this.coursesService.getGradesByEnrollment(
      enrollmentId,
      this.getActorUserId(request),
    );
  }

  @Get('grades/:id')
  async getGradeById(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Grade> {
    return this.coursesService.getGradeById(
      id,
      this.getActorUserId(request),
    );
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
    @Req() request: Request,
  ): Promise<Grade> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.updateGrade(
      id,
      body.pointsAchieved,
      body.feedback,
      actorUserId,
      body.isFinal,
      actorUserId,
      actorUserId,
    );
  }

  @Delete('grades/:id')
  async deleteGrade(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.coursesService.deleteGrade(
      id,
      this.getActorUserId(request),
    );
  }

  @Get('courses/:courseId/enrollments/:enrollmentId/grade')
  async calculateCourseGrade(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Req() request: Request,
  ): Promise<{ grade: number; passed: boolean }> {
    return this.coursesService.calculateCourseGrade(
      courseId,
      enrollmentId,
      this.getActorUserId(request),
    );
  }

  @Get('courses/:courseId/performance')
  async getCoursePerformance(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<any> {
    return this.coursesService.getCoursePerformance(
      courseId,
      this.getActorUserId(request),
    );
  }

  // Task and learning process endpoints
  @Get(':courseId/tasks/my-progress')
  async getMyLearningPathProgress(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<LearningPathResponseDto> {
    return this.coursesService.getLearningPathProgress(
      courseId,
      getRequestActor(request).userId,
    );
  }

  @Get(':courseId/tasks/progress-overview')
  async getLearningTaskProgressOverview(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<StudentProgressOverviewDto[]> {
    return this.coursesService.getLearningTaskProgressOverview(
      courseId,
      getRequestActor(request).userId,
    );
  }

  @Get(':courseId/tasks/progress/:studentId')
  async getLearningTaskProgressForStudent(
    @Param('courseId') courseId: string,
    @Param('studentId') studentId: string,
    @Req() request: Request,
  ): Promise<StudentProgressOverviewDto> {
    return this.coursesService.getLearningTaskProgressForStudent(
      courseId,
      studentId,
      getRequestActor(request).userId,
    );
  }

  @Put(':courseId/tasks/sort-order')
  async updateLearningTaskSortOrder(
    @Param('courseId') courseId: string,
    @Body() body: UpdateLearningTaskSortDto,
    @Req() request: Request,
  ): Promise<LearningTaskResponseDto[]> {
    return this.coursesService.updateLearningTaskSortOrder(
      courseId,
      body,
      getRequestActor(request).userId,
    );
  }

  @Post(':courseId/tasks')
  async createTask(
    @Param('courseId') courseId: string,
    @Body() body: CreateLearningTaskDto,
    @Req() request: Request,
  ): Promise<LearningTaskResponseDto> {
    return this.coursesService.createLearningTask(
      courseId,
      body,
      getRequestActor(request).userId,
    );
  }

  @Get(':courseId/tasks')
  async getTasksByCourse(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<LearningTaskResponseDto[]> {
    return this.coursesService.getTasksByCourse(
      courseId,
      getRequestActor(request).userId,
    );
  }

  @Get('tasks/:id')
  async getTaskById(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<LearningTaskResponseDto> {
    return this.coursesService.getTaskById(
      id,
      getRequestActor(request).userId,
    );
  }

  @Put('tasks/:id')
  async updateTask(
    @Param('id') id: string,
    @Body() body: UpdateLearningTaskDto,
    @Req() request: Request,
  ): Promise<LearningTaskResponseDto> {
    return this.coursesService.updateLearningTask(
      id,
      body,
      getRequestActor(request).userId,
    );
  }

  @Put('tasks/:id/release-config')
  async updateLearningTaskReleaseConfig(
    @Param('id') id: string,
    @Body() body: UpdateLearningTaskReleaseConfigDto,
    @Req() request: Request,
  ): Promise<LearningTaskResponseDto> {
    return this.coursesService.updateLearningTaskReleaseConfig(
      id,
      body,
      getRequestActor(request).userId,
    );
  }

  @Delete('tasks/:id')
  async deleteTask(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.coursesService.deleteTask(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:id/publish')
  async publishTask(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<LearningTaskResponseDto> {
    return this.coursesService.publishTask(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:id/unpublish')
  async unpublishTask(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<LearningTaskResponseDto> {
    return this.coursesService.unpublishTask(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:id/start')
  async startLearningTask(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<LearningPathResponseDto> {
    return this.coursesService.startLearningTask(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:id/submit')
  async submitLearningTask(
    @Param('id') id: string,
    @Body() body: SubmitLearningTaskDto,
    @Req() request: Request,
  ): Promise<LearningPathResponseDto> {
    return this.coursesService.submitLearningTask(
      id,
      body,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:id/submit-upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: maxMaterialUploadBytes(),
      },
    }),
  )
  async submitLearningTaskWithUpload(
    @Param('id') id: string,
    @Body() body: SubmitLearningTaskDto & Record<string, unknown>,
    @UploadedFile() file: any,
    @Req() request: Request,
  ): Promise<LearningPathResponseDto> {
    return this.coursesService.submitLearningTaskWithUpload(
      id,
      body,
      file,
      getRequestActor(request).userId,
    );
  }

  @Get('task-assessments/:assessmentId/submission-file')
  async downloadTaskSubmissionFile(
    @Param('assessmentId') assessmentId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const download = await this.coursesService.downloadTaskSubmissionFile(
      assessmentId,
      getRequestActor(request).userId,
    );

    response.set({
      'Content-Disposition': `attachment; filename="${contentDispositionFileName(
        download.fileName,
      )}"`,
      'Content-Type': download.mimeType,
      ...(download.fileSize ? { 'Content-Length': String(download.fileSize) } : {}),
    });

    return new StreamableFile(download.stream);
  }

  @Post('tasks/:id/self-confirm')
  async selfConfirmLearningTask(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<LearningPathResponseDto> {
    return this.coursesService.selfConfirmLearningTask(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:id/mock-evaluate')
  async mockEvaluateLearningTask(
    @Param('id') id: string,
    @Body() body: MockEvaluateLearningTaskDto,
    @Req() request: Request,
  ): Promise<LearningPathResponseDto> {
    return this.coursesService.mockEvaluateLearningTask(
      id,
      body,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:id/complete')
  async completeLearningTask(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<LearningPathResponseDto> {
    return this.coursesService.completeLearningTask(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:id/fail')
  async failLearningTask(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<LearningPathResponseDto> {
    return this.coursesService.failLearningTask(
      id,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:id/manual-unlock')
  async manuallyUnlockLearningTask(
    @Param('id') id: string,
    @Body() body: ManualUnlockLearningTaskDto,
    @Req() request: Request,
  ): Promise<StudentProgressOverviewDto> {
    return this.coursesService.manuallyUnlockLearningTask(
      id,
      body,
      getRequestActor(request).userId,
    );
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
    @Req() request: Request,
  ): Promise<ContentRelease> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.createContentRelease(
      courseId,
      body.contentType,
      body.contentId,
      body.releaseType,
      body.releaseDate,
      body.releaseConditions,
      actorUserId,
      actorUserId,
    );
  }

  @Get(':courseId/content-releases')
  async getContentReleasesByCourse(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<ContentRelease[]> {
    return this.coursesService.getContentReleasesByCourse(
      courseId,
      this.getActorUserId(request),
    );
  }

  @Get('content-releases/:id')
  async getContentReleaseById(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<ContentRelease> {
    return this.coursesService.getContentReleaseById(
      id,
      this.getActorUserId(request),
    );
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
    @Req() request: Request,
  ): Promise<ContentRelease> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.updateContentRelease(
      id,
      body.contentType,
      body.contentId,
      body.releaseType,
      body.releaseDate,
      body.releaseConditions,
      body.isActive,
      actorUserId,
      actorUserId,
    );
  }

  @Delete('content-releases/:id')
  async deleteContentRelease(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.coursesService.deleteContentRelease(
      id,
      this.getActorUserId(request),
    );
  }

  @Post('content-releases/:id/release')
  async releaseContentManually(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<ContentRelease> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.releaseContentManually(
      id,
      actorUserId,
      actorUserId,
    );
  }

  @Post('courses/:courseId/check-automatic-releases')
  async checkAutomaticReleases(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<ContentRelease[]> {
    return this.coursesService.checkAutomaticReleases(
      courseId,
      this.getActorUserId(request),
    );
  }

  @Post('courses/:courseId/enrollments/:enrollmentId/check-progress-releases')
  async checkProgressBasedReleases(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Req() request: Request,
  ): Promise<ContentRelease[]> {
    return this.coursesService.checkProgressBasedReleases(
      courseId,
      enrollmentId,
      this.getActorUserId(request),
    );
  }

  @Get('courses/:courseId/enrollments/:enrollmentId/released-content')
  async getReleasedContentForEnrollment(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Req() request: Request,
  ): Promise<any[]> {
    return this.coursesService.getReleasedContentForEnrollment(
      courseId,
      enrollmentId,
      this.getActorUserId(request),
    );
  }

  @Get('courses/:courseId/enrollments/:enrollmentId/content-release-status')
  async getContentReleaseStatusForEnrollment(
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Req() request: Request,
  ): Promise<any> {
    return this.coursesService.getContentReleaseStatus(
      courseId,
      enrollmentId,
      this.getActorUserId(request),
    );
  }

  @Get('courses/:courseId/content-release-status')
  async getContentReleaseStatus(
    @Param('courseId') courseId: string,
    @Query('enrollmentId') enrollmentId: string | undefined,
    @Req() request: Request,
  ): Promise<any> {
    if (!enrollmentId) {
      throw new ApiValidationError('enrollmentId query parameter is required');
    }

    return this.coursesService.getContentReleaseStatus(
      courseId,
      enrollmentId,
      this.getActorUserId(request),
    );
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
    @Req() request: Request,
  ): Promise<ContentTemplate> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.createContentTemplate(
      courseId,
      body.name,
      body.description,
      body.templateType,
      body.templateData,
      body.placeholders,
      body.isGlobal,
      actorUserId,
      actorUserId,
    );
  }

  @Get(':courseId/content-templates')
  async getContentTemplatesByCourse(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<ContentTemplate[]> {
    return this.coursesService.getContentTemplatesByCourse(
      courseId,
      this.getActorUserId(request),
    );
  }

  @Get('content-templates/global')
  async getGlobalContentTemplates(
    @Req() request: Request,
  ): Promise<ContentTemplate[]> {
    return this.coursesService.getGlobalContentTemplates(
      this.getActorUserId(request),
    );
  }

  @Get('content-templates/:id')
  async getContentTemplateById(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<ContentTemplate> {
    return this.coursesService.getContentTemplateById(
      id,
      this.getActorUserId(request),
    );
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
    @Req() request: Request,
  ): Promise<ContentTemplate> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.updateContentTemplate(
      id,
      body.name,
      body.description,
      body.templateType,
      body.templateData,
      body.placeholders,
      body.isActive,
      body.isGlobal,
      actorUserId,
      actorUserId,
    );
  }

  @Delete('content-templates/:id')
  async deleteContentTemplate(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.coursesService.deleteContentTemplate(
      id,
      this.getActorUserId(request),
    );
  }

  @Post('courses/:courseId/templates/:templateId/apply')
  async applyTemplateToCourse(
    @Param('courseId') courseId: string,
    @Param('templateId') templateId: string,
    @Req() request: Request,
  ): Promise<any> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.applyTemplateToCourse(
      templateId,
      courseId,
      actorUserId,
      actorUserId,
    );
  }

  @Get('courses/:courseId/available-templates')
  async getAvailableTemplatesForCourse(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<ContentTemplate[]> {
    return this.coursesService.getAvailableTemplatesForCourse(
      courseId,
      this.getActorUserId(request),
    );
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

  // Study group endpoints
  @Get(':courseId/runs/:runId/groups')
  async listStudyGroups(
    @Param('courseId') courseId: string,
    @Param('runId') runId: string,
    @Req() request: Request,
  ): Promise<StudyGroupResponseDto[]> {
    return this.coursesService.listStudyGroups(
      courseId,
      runId,
      getRequestActor(request).userId,
    );
  }

  @Post(':courseId/runs/:runId/groups')
  async createStudyGroup(
    @Param('courseId') courseId: string,
    @Param('runId') runId: string,
    @Body() body: CreateStudyGroupDto,
    @Req() request: Request,
  ): Promise<StudyGroupResponseDto> {
    return this.coursesService.createStudyGroup(
      courseId,
      runId,
      body,
      getRequestActor(request).userId,
    );
  }

  @Get(':courseId/runs/:runId/groups/my')
  async getMyStudyGroup(
    @Param('courseId') courseId: string,
    @Param('runId') runId: string,
    @Req() request: Request,
  ): Promise<StudyGroupResponseDto | null> {
    return this.coursesService.getMyStudyGroup(
      courseId,
      runId,
      getRequestActor(request).userId,
    );
  }

  @Put(':courseId/runs/:runId/groups/:groupId')
  async updateStudyGroup(
    @Param('courseId') courseId: string,
    @Param('runId') runId: string,
    @Param('groupId') groupId: string,
    @Body() body: UpdateStudyGroupDto,
    @Req() request: Request,
  ): Promise<StudyGroupResponseDto> {
    return this.coursesService.updateStudyGroup(
      courseId,
      runId,
      groupId,
      body,
      getRequestActor(request).userId,
    );
  }

  @Delete(':courseId/runs/:runId/groups/:groupId')
  async deleteStudyGroup(
    @Param('courseId') courseId: string,
    @Param('runId') runId: string,
    @Param('groupId') groupId: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.coursesService.deleteStudyGroup(
      courseId,
      runId,
      groupId,
      getRequestActor(request).userId,
    );
  }

  @Post(':courseId/runs/:runId/groups/:groupId/members')
  async addStudyGroupMember(
    @Param('courseId') courseId: string,
    @Param('runId') runId: string,
    @Param('groupId') groupId: string,
    @Body() body: AddStudyGroupMemberDto,
    @Req() request: Request,
  ): Promise<StudyGroupResponseDto> {
    return this.coursesService.addStudyGroupMember(
      courseId,
      runId,
      groupId,
      body,
      getRequestActor(request).userId,
    );
  }

  @Delete(':courseId/runs/:runId/groups/:groupId/members/:studentId')
  async removeStudyGroupMember(
    @Param('courseId') courseId: string,
    @Param('runId') runId: string,
    @Param('groupId') groupId: string,
    @Param('studentId') studentId: string,
    @Req() request: Request,
  ): Promise<StudyGroupResponseDto> {
    return this.coursesService.removeStudyGroupMember(
      courseId,
      runId,
      groupId,
      studentId,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:taskId/group/start')
  async startGroupLearningTask(
    @Param('taskId') taskId: string,
    @Req() request: Request,
  ): Promise<LearningPathResponseDto> {
    return this.coursesService.startGroupLearningTask(
      taskId,
      getRequestActor(request).userId,
    );
  }

  @Post('tasks/:taskId/group/submit')
  async submitGroupLearningTask(
    @Param('taskId') taskId: string,
    @Body() body: SubmitLearningTaskDto,
    @Req() request: Request,
  ): Promise<LearningPathResponseDto> {
    return this.coursesService.submitGroupLearningTask(
      taskId,
      body,
      getRequestActor(request).userId,
    );
  }

  @Put(':courseId/runs/:runId/tasks/:taskId/groups/:groupId/manual-assessment')
  async setManualGroupTaskAssessment(
    @Param('courseId') courseId: string,
    @Param('runId') runId: string,
    @Param('taskId') taskId: string,
    @Param('groupId') groupId: string,
    @Body() body: ManualGroupTaskAssessmentDto,
    @Req() request: Request,
  ): Promise<TaskAssessmentResponseDto> {
    return this.coursesService.setManualGroupTaskAssessment(
      courseId,
      runId,
      taskId,
      groupId,
      body,
      getRequestActor(request).userId,
    );
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
    @Req() request: Request,
  ): Promise<CalendarEvent> {
    const actorUserId = this.getActorUserId(request);

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
      actorUserId,
      actorUserId,
    );
  }

  @Get(':courseId/calendar/events')
  async getCalendarEventsByCourse(
    @Param('courseId') courseId: string,
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Req() request: Request,
  ): Promise<CalendarEvent[]> {
    return this.coursesService.getCalendarEventsByCourse(
      courseId,
      startDate,
      endDate,
      this.getActorUserId(request),
    );
  }

  @Get('calendar/events/:id')
  async getCalendarEventById(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<CalendarEvent> {
    return this.coursesService.getCalendarEventById(
      id,
      this.getActorUserId(request),
    );
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
    @Req() request: Request,
  ): Promise<CalendarEvent> {
    const actorUserId = this.getActorUserId(request);

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
      actorUserId,
      actorUserId,
    );
  }

  @Delete('calendar/events/:id')
  async deleteCalendarEvent(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.coursesService.deleteCalendarEvent(
      id,
      this.getActorUserId(request),
    );
  }

  @Post('courses/:courseId/calendar/assignment-events')
  async createAssignmentDueDateEvents(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<CalendarEvent[]> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.createAssignmentDueDateEvents(
      courseId,
      actorUserId,
      actorUserId,
    );
  }

  @Get('courses/:courseId/calendar/upcoming')
  async getUpcomingEvents(
    @Param('courseId') courseId: string,
    @Query('limit') limit: number = 5,
    @Req() request: Request,
  ): Promise<CalendarEvent[]> {
    return this.coursesService.getUpcomingEvents(
      courseId,
      limit,
      this.getActorUserId(request),
    );
  }

  @Get('courses/:courseId/calendar/range')
  async getEventsByDateRange(
    @Param('courseId') courseId: string,
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Req() request: Request,
  ): Promise<CalendarEvent[]> {
    return this.coursesService.getEventsByDateRange(
      courseId,
      startDate,
      endDate,
      this.getActorUserId(request),
    );
  }

  @Get('courses/:courseId/calendar/daily')
  async getDailyEvents(
    @Param('courseId') courseId: string,
    @Query('date') date: Date,
    @Req() request: Request,
  ): Promise<CalendarEvent[]> {
    return this.coursesService.getDailyEvents(
      courseId,
      date,
      this.getActorUserId(request),
    );
  }

  @Get('courses/:courseId/calendar/monthly')
  async getMonthlyEvents(
    @Param('courseId') courseId: string,
    @Query('year') year: number,
    @Query('month') month: number,
    @Req() request: Request,
  ): Promise<CalendarEvent[]> {
    return this.coursesService.getMonthlyEvents(
      courseId,
      year,
      month,
      this.getActorUserId(request),
    );
  }

  @Post('courses/:courseId/calendar/sync-assignments')
  async syncAssignmentDueDates(
    @Param('courseId') courseId: string,
    @Req() request: Request,
  ): Promise<{ created: CalendarEvent[]; deleted: number }> {
    const actorUserId = this.getActorUserId(request);

    return this.coursesService.syncAssignmentDueDates(
      courseId,
      actorUserId,
      actorUserId,
    );
  }
}

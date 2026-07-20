/**
 * Courses Service - API facade for course management
 * 
 * This service keeps the public controller-facing API stable and delegates course catalog,
 * run/version, material, task, assessment, result, workgroup, search, and calendar behavior
 * to focused domain services through a shared domain context.
 * 
 * @module CoursesService
 */
import { Injectable, Optional } from '@nestjs/common';
import {
  CourseResultListQueryDto,
  CourseResultListResponseDto,
  CourseResultResponseDto,
  ManualCourseResultDto,
} from './dto/course-result.dto';
import { LocalMaterialStorage } from './storage/material-storage';
import { TaskEvaluationClient } from './task-evaluation.client';
import { TaskServiceClient } from './task-service.client';
import { AuditLogService } from './audit-log.service';
import {
  CourseDomainContext,
  CourseDomainFacade,
  createCourseDomainFacade,
} from './domain/course-domain.context';
import { CourseDomainServices } from './domain/course-domain.composition';
import { CourseRepositories } from './persistence/course-repositories';

export type UploadedLearningMaterialFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

/**
 * Courses Service Class
 * 
 * Main facade class for course management functionality
 */
@Injectable()
export class CoursesService {
  constructor(
    repositories: CourseRepositories,
    materialStorage: LocalMaterialStorage,
    @Optional()
    auditLogService?: AuditLogService,
    @Optional()
    taskServiceClient?: TaskServiceClient,
    @Optional()
    taskEvaluationClient?: TaskEvaluationClient,
  ) {
    this.domainContext = new CourseDomainContext({
      repositories,
      materialStorage,
      auditLogService,
      taskServiceClient,
      taskEvaluationClient,
    });
    this.domainFacade = createCourseDomainFacade(this.domainContext);
    this.domainServices = CourseDomainServices.create(
      this.domainContext,
      this.domainFacade,
    );
  }

  private readonly domainContext: CourseDomainContext;
  private readonly domainFacade: CourseDomainFacade;
  private readonly domainServices: CourseDomainServices;

  /**
   * Get hello message for testing
   *
   * @returns {string} A simple hello message
   */
  getHello(): string {
    return 'Hello World!';
  }

  private delegateTo(
    serviceName: string,
    service: Record<string, unknown>,
    methodName: string,
    args: unknown[],
  ): any {
    const method = service[methodName];

    if (typeof method !== 'function') {
      throw new Error(`${serviceName}.${methodName} is not available`);
    }

    return method(...args);
  }

  private delegateCourseCatalog(methodName: string, args: unknown[]): any {
    return this.delegateTo(
      'CourseCatalogService',
      this.domainServices.courseCatalog,
      methodName,
      args,
    );
  }

  private delegateAssignmentGrade(methodName: string, args: unknown[]): any {
    return this.delegateTo(
      'AssignmentGradeService',
      this.domainServices.assignmentGrade,
      methodName,
      args,
    );
  }

  private delegateContentReleaseTemplate(methodName: string, args: unknown[]): any {
    return this.delegateTo(
      'ContentReleaseTemplateService',
      this.domainServices.contentReleaseTemplate,
      methodName,
      args,
    );
  }

  private delegateCourseSearch(methodName: string, args: unknown[]): any {
    return this.delegateTo(
      'CourseSearchService',
      this.domainServices.courseSearch,
      methodName,
      args,
    );
  }

  private delegateLegacyWorkgroup(methodName: string, args: unknown[]): any {
    return this.delegateTo(
      'LegacyWorkgroupService',
      this.domainServices.legacyWorkgroup,
      methodName,
      args,
    );
  }

  private delegateCalendarEvent(methodName: string, args: unknown[]): any {
    return this.delegateTo(
      'CalendarEventService',
      this.domainServices.calendarEvent,
      methodName,
      args,
    );
  }

  // Course run and content version methods are implemented in the domain service.
  private delegateCourseRunVersion(methodName: string, args: unknown[]): any {
    return this.delegateTo(
      'CourseRunVersionService',
      this.domainServices.courseRunVersion,
      methodName,
      args,
    );
  }

  // Learning material methods are implemented in the domain service.
  private delegateLearningMaterial(methodName: string, args: unknown[]): any {
    return this.delegateTo(
      'LearningMaterialService',
      this.domainServices.learningMaterial,
      methodName,
      args,
    );
  }

  async findAll(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('findAll', args);
  }

  async getAvailableCourses(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getAvailableCourses', args);
  }

  async getEnrolledCourses(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getEnrolledCourses', args);
  }

  async findOne(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('findOne', args);
  }

  async getUserRoleInCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getUserRoleInCourse', args);
  }

  async getCourseContext(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getCourseContext', args);
  }

  async getCourseMembers(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getCourseMembers', args);
  }

  async getCourseMembersByRun(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('getCourseMembersByRun', args);
  }

  async listAuditEvents(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('listAuditEvents', args);
  }

  async createCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('createCourse', args);
  }

  async joinCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('joinCourse', args);
  }

  async enrollInCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('enrollInCourse', args);
  }

  async leaveCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('leaveCourse', args);
  }

  async updateCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('updateCourse', args);
  }

  async changeUserRole(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('changeUserRole', args);
  }

  async removeCourse(...args: any[]): Promise<any> {
    return this.delegateCourseCatalog('removeCourse', args);
  }

  async createLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('createLearningMaterial', args);
  }

  async createLearningMaterialFile(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('createLearningMaterialFile', args);
  }

  async createExternalLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('createExternalLearningMaterial', args);
  }

  async getLearningMaterialsByCourse(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('getLearningMaterialsByCourse', args);
  }

  async getLearningMaterialsByCourseRun(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('getLearningMaterialsByCourseRun', args);
  }

  async getLearningMaterialsByCourseVersion(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('getLearningMaterialsByCourseVersion', args);
  }

  async getLearningMaterialById(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('getLearningMaterialById', args);
  }

  async updateLearningMaterialMetadata(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('updateLearningMaterialMetadata', args);
  }

  async updateLearningMaterialSortOrder(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('updateLearningMaterialSortOrder', args);
  }

  async deleteLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('deleteLearningMaterial', args);
  }

  async publishLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('publishLearningMaterial', args);
  }

  async unpublishLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('unpublishLearningMaterial', args);
  }

  async downloadLearningMaterial(...args: any[]): Promise<any> {
    return this.delegateLearningMaterial('downloadLearningMaterial', args);
  }

  async getMyCourseResult(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    return this.domainServices.courseResult.getMyCourseResult(courseId, actorUserId);
  }

  async getCourseResults(
    courseId: string,
    query: CourseResultListQueryDto = {},
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    return this.domainServices.courseResult.getCourseResults(courseId, query, actorUserId);
  }

  async getCourseResultsByRun(
    courseId: string,
    runId: string,
    query: CourseResultListQueryDto = {},
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    return this.domainServices.courseResult.getCourseResultsByRun(courseId, runId, query, actorUserId);
  }

  async setManualCourseResult(
    courseId: string,
    studentId: string,
    body: ManualCourseResultDto,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    return this.domainServices.courseResult.setManualCourseResult(courseId, studentId, body, actorUserId);
  }

  async recalculateCourseResult(
    courseId: string,
    studentId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultResponseDto> {
    return this.domainServices.courseResult.recalculateCourseResult(courseId, studentId, actorUserId);
  }

  async recalculateAllCourseResults(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<CourseResultListResponseDto> {
    return this.domainServices.courseResult.recalculateAllCourseResults(courseId, actorUserId);
  }

  // Assignment methods
  async createAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('createAssignment', args);
  }

  async getAssignmentsByCourse(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getAssignmentsByCourse', args);
  }

  async getAssignmentById(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getAssignmentById', args);
  }

  async updateAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('updateAssignment', args);
  }

  async deleteAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('deleteAssignment', args);
  }

  async publishAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('publishAssignment', args);
  }

  async unpublishAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('unpublishAssignment', args);
  }

  // Grade methods
  async createGrade(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('createGrade', args);
  }

  async getGradesByAssignment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getGradesByAssignment', args);
  }

  async getGradesByEnrollment(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getGradesByEnrollment', args);
  }

  async getGradeById(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getGradeById', args);
  }

  async updateGrade(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('updateGrade', args);
  }

  async deleteGrade(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('deleteGrade', args);
  }

  async calculateCourseGrade(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('calculateCourseGrade', args);
  }

  async getCoursePerformance(...args: any[]): Promise<any> {
    return this.delegateAssignmentGrade('getCoursePerformance', args);
  }

  async listCourseVersions(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('listCourseVersions', args);
  }

  async listCourseVersionsByRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('listCourseVersionsByRun', args);
  }

  async listCourseVersionTemplates(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('listCourseVersionTemplates', args);
  }

  async getCourseVersion(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('getCourseVersion', args);
  }

  async createCourseVersion(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('createCourseVersion', args);
  }

  async createCourseVersionForRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('createCourseVersionForRun', args);
  }

  async activateCourseVersion(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('activateCourseVersion', args);
  }

  async activateCourseVersionForRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('activateCourseVersionForRun', args);
  }

  async deleteCourseVersion(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('deleteCourseVersion', args);
  }

  async listCourseRuns(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('listCourseRuns', args);
  }

  async getCurrentCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('getCurrentCourseRun', args);
  }

  async getCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('getCourseRun', args);
  }

  async getCourseRunPlan(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('getCourseRunPlan', args);
  }

  async updateCourseRunPlanTemplate(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('updateCourseRunPlanTemplate', args);
  }

  async createCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('createCourseRun', args);
  }

  async createSpecialCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('createSpecialCourseRun', args);
  }

  async activateCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('activateCourseRun', args);
  }

  async deleteOrArchiveCourseRun(...args: any[]): Promise<any> {
    return this.delegateCourseRunVersion('deleteOrArchiveCourseRun', args);
  }

  // Learning task and progress methods are implemented in the domain service.
  private delegateLearningTask(methodName: string, args: unknown[]): any {
    return this.delegateTo(
      'LearningTaskService',
      this.domainServices.learningTask,
      methodName,
      args,
    );
  }

  async createLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('createLearningTask', args);
  }

  async getTasksByCourse(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getTasksByCourse', args);
  }

  async getTasksByCourseRun(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getTasksByCourseRun', args);
  }

  async getTasksByCourseVersion(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getTasksByCourseVersion', args);
  }

  async getTaskById(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getTaskById', args);
  }

  async updateLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('updateLearningTask', args);
  }

  async updateLearningTaskReleaseConfig(...args: any[]): Promise<any> {
    return this.delegateLearningTask('updateLearningTaskReleaseConfig', args);
  }

  async updateLearningTaskSortOrder(...args: any[]): Promise<any> {
    return this.delegateLearningTask('updateLearningTaskSortOrder', args);
  }

  async deleteTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('deleteTask', args);
  }

  async publishTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('publishTask', args);
  }

  async unpublishTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('unpublishTask', args);
  }

  async getLearningPathProgress(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getLearningPathProgress', args);
  }

  async startLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('startLearningTask', args);
  }

  async recordTaskResult(...args: any[]): Promise<any> {
    return this.delegateLearningTask('recordTaskResult', args);
  }

  async selfConfirmLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('selfConfirmLearningTask', args);
  }

  async submitLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('submitLearningTask', args);
  }

  async submitLearningTaskWithUpload(...args: any[]): Promise<any> {
    return this.delegateLearningTask('submitLearningTaskWithUpload', args);
  }

  async downloadTaskSubmissionFile(...args: any[]): Promise<any> {
    return this.delegateLearningTask('downloadTaskSubmissionFile', args);
  }

  async mockEvaluateLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('mockEvaluateLearningTask', args);
  }

  async completeLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('completeLearningTask', args);
  }

  async failLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('failLearningTask', args);
  }

  async setManualTaskAssessment(...args: any[]): Promise<any> {
    return this.delegateLearningTask('setManualTaskAssessment', args);
  }

  async resetTaskAssessment(...args: any[]): Promise<any> {
    return this.delegateLearningTask('resetTaskAssessment', args);
  }

  async listTaskAssessmentsByRun(...args: any[]): Promise<any> {
    return this.delegateLearningTask('listTaskAssessmentsByRun', args);
  }

  async listTaskAssessmentsByTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('listTaskAssessmentsByTask', args);
  }

  async manuallyUnlockLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('manuallyUnlockLearningTask', args);
  }

  async getLearningTaskProgressForStudent(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getLearningTaskProgressForStudent', args);
  }

  async getLearningTaskProgressOverview(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getLearningTaskProgressOverview', args);
  }

  async getLearningTaskProgressOverviewByRun(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getLearningTaskProgressOverviewByRun', args);
  }

  async createStudyGroup(...args: any[]): Promise<any> {
    return this.delegateLearningTask('createStudyGroup', args);
  }

  async listStudyGroups(...args: any[]): Promise<any> {
    return this.delegateLearningTask('listStudyGroups', args);
  }

  async getMyStudyGroup(...args: any[]): Promise<any> {
    return this.delegateLearningTask('getMyStudyGroup', args);
  }

  async updateStudyGroup(...args: any[]): Promise<any> {
    return this.delegateLearningTask('updateStudyGroup', args);
  }

  async deleteStudyGroup(...args: any[]): Promise<any> {
    return this.delegateLearningTask('deleteStudyGroup', args);
  }

  async addStudyGroupMember(...args: any[]): Promise<any> {
    return this.delegateLearningTask('addStudyGroupMember', args);
  }

  async removeStudyGroupMember(...args: any[]): Promise<any> {
    return this.delegateLearningTask('removeStudyGroupMember', args);
  }

  async startGroupLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('startGroupLearningTask', args);
  }

  async submitGroupLearningTask(...args: any[]): Promise<any> {
    return this.delegateLearningTask('submitGroupLearningTask', args);
  }

  async setManualGroupTaskAssessment(...args: any[]): Promise<any> {
    return this.delegateLearningTask('setManualGroupTaskAssessment', args);
  }

  // Content Release methods
  async createContentRelease(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('createContentRelease', args);
  }

  async getContentReleasesByCourse(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getContentReleasesByCourse', args);
  }

  async getContentReleaseById(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getContentReleaseById', args);
  }

  async updateContentRelease(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('updateContentRelease', args);
  }

  async deleteContentRelease(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('deleteContentRelease', args);
  }

  async releaseContentManually(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('releaseContentManually', args);
  }

  async checkAutomaticReleases(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('checkAutomaticReleases', args);
  }

  async checkProgressBasedReleases(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('checkProgressBasedReleases', args);
  }

  async getReleasedContentForEnrollment(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getReleasedContentForEnrollment', args);
  }

  async getContentReleaseStatus(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getContentReleaseStatus', args);
  }

  // Content Template methods
  async createContentTemplate(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('createContentTemplate', args);
  }

  async getContentTemplatesByCourse(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getContentTemplatesByCourse', args);
  }

  async getGlobalContentTemplates(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getGlobalContentTemplates', args);
  }

  async getContentTemplateById(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getContentTemplateById', args);
  }

  async updateContentTemplate(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('updateContentTemplate', args);
  }

  async deleteContentTemplate(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('deleteContentTemplate', args);
  }

  async applyTemplateToCourse(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('applyTemplateToCourse', args);
  }

  async getAvailableTemplatesForCourse(...args: any[]): Promise<any> {
    return this.delegateContentReleaseTemplate('getAvailableTemplatesForCourse', args);
  }

  // Search methods
  async searchCourses(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchCourses', args);
  }

  async searchLearningMaterials(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchLearningMaterials', args);
  }

  async searchAssignments(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchAssignments', args);
  }

  async searchTasks(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchTasks', args);
  }

  async searchContentTemplates(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchContentTemplates', args);
  }

  async advancedSearch(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('advancedSearch', args);
  }

  async searchWithinCourse(...args: any[]): Promise<any> {
    return this.delegateCourseSearch('searchWithinCourse', args);
  }

  // Workgroup methods
  async createCourseGroup(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('createCourseGroup', args);
  }

  async getCourseGroupsByCourse(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getCourseGroupsByCourse', args);
  }

  async getCourseGroupById(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getCourseGroupById', args);
  }

  async updateCourseGroup(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('updateCourseGroup', args);
  }

  async deleteCourseGroup(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('deleteCourseGroup', args);
  }

  async addMemberToGroup(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('addMemberToGroup', args);
  }

  async removeMemberFromGroup(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('removeMemberFromGroup', args);
  }

  async updateGroupMembershipRole(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('updateGroupMembershipRole', args);
  }

  async getGroupMembers(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getGroupMembers', args);
  }

  async getGroupsForUser(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getGroupsForUser', args);
  }

  async getGroupMembership(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getGroupMembership', args);
  }

  async assignGroupGrade(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('assignGroupGrade', args);
  }

  async assignIndividualGrade(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('assignIndividualGrade', args);
  }

  async getGroupPerformance(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getGroupPerformance', args);
  }

  async autoCreateWorkgroups(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('autoCreateWorkgroups', args);
  }

  async getGroupLearningProgress(...args: any[]): Promise<any> {
    return this.delegateLegacyWorkgroup('getGroupLearningProgress', args);
  }

  // Calendar Event methods
  async createCalendarEvent(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('createCalendarEvent', args);
  }

  async getCalendarEventsByCourse(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getCalendarEventsByCourse', args);
  }

  async getCalendarEventById(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getCalendarEventById', args);
  }

  async updateCalendarEvent(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('updateCalendarEvent', args);
  }

  async deleteCalendarEvent(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('deleteCalendarEvent', args);
  }

  async createAssignmentDueDateEvents(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('createAssignmentDueDateEvents', args);
  }

  async getUpcomingEvents(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getUpcomingEvents', args);
  }

  async getEventsByDateRange(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getEventsByDateRange', args);
  }

  async getDailyEvents(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getDailyEvents', args);
  }

  async getMonthlyEvents(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('getMonthlyEvents', args);
  }

  async syncAssignmentDueDates(...args: any[]): Promise<any> {
    return this.delegateCalendarEvent('syncAssignmentDueDates', args);
  }
}

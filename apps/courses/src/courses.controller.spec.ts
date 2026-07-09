import { Test, TestingModule } from '@nestjs/testing';
import { CoursesController } from './courses.controller';
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

describe('CoursesController', () => {
  let controller: CoursesController;
  let service: CoursesService;

  const mockService = {
    // Learning Materials
    createLearningMaterial: jest.fn(),
    getLearningMaterialsByCourse: jest.fn(),
    getLearningMaterialById: jest.fn(),
    updateLearningMaterial: jest.fn(),
    deleteLearningMaterial: jest.fn(),
    publishLearningMaterial: jest.fn(),
    unpublishLearningMaterial: jest.fn(),
    
    // Assignments
    createAssignment: jest.fn(),
    getAssignmentsByCourse: jest.fn(),
    getAssignmentById: jest.fn(),
    updateAssignment: jest.fn(),
    deleteAssignment: jest.fn(),
    publishAssignment: jest.fn(),
    unpublishAssignment: jest.fn(),
    
    // Grades
    createGrade: jest.fn(),
    getGradesByAssignment: jest.fn(),
    getGradesByEnrollment: jest.fn(),
    getGradeById: jest.fn(),
    updateGrade: jest.fn(),
    deleteGrade: jest.fn(),
    calculateCourseGrade: jest.fn(),
    getCoursePerformance: jest.fn(),
    
    // Tasks
    createTask: jest.fn(),
    getTasksByCourse: jest.fn(),
    getTaskById: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    publishTask: jest.fn(),
    unpublishTask: jest.fn(),
    
    // Task Progress
    createTaskProgress: jest.fn(),
    getTaskProgressById: jest.fn(),
    getTaskProgressByTaskAndEnrollment: jest.fn(),
    getTaskProgressByEnrollment: jest.fn(),
    updateTaskProgress: jest.fn(),
    startTaskProgress: jest.fn(),
    completeTaskProgress: jest.fn(),
    unlockTaskProgress: jest.fn(),
    checkTaskPrerequisites: jest.fn(),
    unlockNextTasks: jest.fn(),
    getLearningPathProgress: jest.fn(),
    
    // Content Release
    createContentRelease: jest.fn(),
    getContentReleasesByCourse: jest.fn(),
    getContentReleaseById: jest.fn(),
    updateContentRelease: jest.fn(),
    deleteContentRelease: jest.fn(),
    releaseContentManually: jest.fn(),
    checkAutomaticReleases: jest.fn(),
    checkProgressBasedReleases: jest.fn(),
    getReleasedContentForEnrollment: jest.fn(),
    getContentReleaseStatus: jest.fn(),
    
    // Templates
    createContentTemplate: jest.fn(),
    getContentTemplatesByCourse: jest.fn(),
    getGlobalContentTemplates: jest.fn(),
    getContentTemplateById: jest.fn(),
    updateContentTemplate: jest.fn(),
    deleteContentTemplate: jest.fn(),
    applyTemplateToCourse: jest.fn(),
    getAvailableTemplatesForCourse: jest.fn(),
    
    // Workgroups
    createCourseGroup: jest.fn(),
    getCourseGroupsByCourse: jest.fn(),
    getCourseGroupById: jest.fn(),
    updateCourseGroup: jest.fn(),
    deleteCourseGroup: jest.fn(),
    addMemberToGroup: jest.fn(),
    removeMemberFromGroup: jest.fn(),
    updateGroupMembershipRole: jest.fn(),
    getGroupMembers: jest.fn(),
    getGroupsForUser: jest.fn(),
    getGroupMembership: jest.fn(),
    assignGroupGrade: jest.fn(),
    assignIndividualGrade: jest.fn(),
    getGroupPerformance: jest.fn(),
    autoCreateWorkgroups: jest.fn(),
    getGroupLearningProgress: jest.fn(),
    
    // Calendar
    createCalendarEvent: jest.fn(),
    getCalendarEventsByCourse: jest.fn(),
    getCalendarEventById: jest.fn(),
    updateCalendarEvent: jest.fn(),
    deleteCalendarEvent: jest.fn(),
    createAssignmentDueDateEvents: jest.fn(),
    getUpcomingEvents: jest.fn(),
    getEventsByDateRange: jest.fn(),
    getDailyEvents: jest.fn(),
    getMonthlyEvents: jest.fn(),
    syncAssignmentDueDates: jest.fn(),
    
    // Search
    searchCourses: jest.fn(),
    searchLearningMaterials: jest.fn(),
    searchAssignments: jest.fn(),
    searchTasks: jest.fn(),
    searchContentTemplates: jest.fn(),
    advancedSearch: jest.fn(),
    searchWithinCourse: jest.fn(),
    
    // Basic method
    getHello: jest.fn().mockReturnValue('Hello World!')
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        {
          provide: CoursesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
    service = module.get<CoursesService>(CoursesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Basic Endpoint', () => {
    it('should return "Hello World!"', () => {
      expect(controller.getHello()).toBe('Hello World!');
    });
  });

  describe('Learning Materials Endpoints', () => {
    it('should create learning material', async () => {
      const mockMaterial: LearningMaterial = {
        id: 'test-id',
        course_id: 'course-123',
        title: 'Test Material',
        description: 'Description',
        type: 'DOCUMENT' as any,
        url: 'http://example.com',
        file_path: '/path/to/file',
        is_published: true,
        created_by: 'teacher-123',
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: 'teacher-123'
      };

      mockService.createLearningMaterial.mockResolvedValue(mockMaterial);

      const result = await controller.createLearningMaterial('course-123', {
        title: 'Test Material',
        description: 'Description',
        type: 'DOCUMENT',
        url: 'http://example.com',
        filePath: '/path/to/file',
        createdBy: 'teacher-123'
      });

      expect(result).toEqual(mockMaterial);
      expect(mockService.createLearningMaterial).toHaveBeenCalled();
    });

    it('should get learning materials by course', async () => {
      const mockMaterials: LearningMaterial[] = [{
        id: '1',
        course_id: 'course-123',
        title: 'Material 1',
        description: 'Description',
        type: 'DOCUMENT' as any,
        url: 'http://example.com',
        file_path: '/path/to/file',
        is_published: true,
        created_by: 'teacher-123',
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: 'teacher-123'
      }];

      mockService.getLearningMaterialsByCourse.mockResolvedValue(mockMaterials);

      const result = await controller.getLearningMaterialsByCourse('course-123');

      expect(result).toEqual(mockMaterials);
      expect(mockService.getLearningMaterialsByCourse).toHaveBeenCalledWith('course-123');
    });
  });

  describe('Assignment Endpoints', () => {
    it('should create assignment', async () => {
      const mockAssignment: Assignment = {
        id: 'test-id',
        course_id: 'course-123',
        title: 'Test Assignment',
        description: 'Description',
        type: 'HOMEWORK' as any,
        max_points: 100,
        weight: 1.0,
        due_date: new Date(),
        is_published: true,
        is_graded: true,
        created_by: 'teacher-123',
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: 'teacher-123',
        grades: []
      };

      mockService.createAssignment.mockResolvedValue(mockAssignment);

      const result = await controller.createAssignment('course-123', {
        title: 'Test Assignment',
        description: 'Description',
        type: 'HOMEWORK',
        maxPoints: 100,
        weight: 1.0,
        dueDate: new Date(),
        createdBy: 'teacher-123'
      });

      expect(result).toEqual(mockAssignment);
      expect(mockService.createAssignment).toHaveBeenCalled();
    });
  });

  describe('Grade Endpoints', () => {
    it('should create grade', async () => {
      const mockGrade: Grade = {
        id: 'test-id',
        assignment_id: 'assignment-123',
        enrollment_id: 'enrollment-123',
        points_achieved: 85,
        feedback: 'Good work',
        graded_by: 'teacher-123',
        graded_at: new Date(),
        is_final: true,
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: 'teacher-123'
      };

      mockService.createGrade.mockResolvedValue(mockGrade);

      const result = await controller.createGrade('assignment-123', {
        enrollmentId: 'enrollment-123',
        pointsAchieved: 85,
        feedback: 'Good work',
        gradedBy: 'teacher-123',
        isFinal: true
      });

      expect(result).toEqual(mockGrade);
      expect(mockService.createGrade).toHaveBeenCalled();
    });

    it('should calculate course grade', async () => {
      const mockGradeResult = { grade: 0.875, passed: true };
      mockService.calculateCourseGrade.mockResolvedValue(mockGradeResult);

      const result = await controller.calculateCourseGrade('course-123', 'enrollment-123');

      expect(result).toEqual(mockGradeResult);
      expect(mockService.calculateCourseGrade).toHaveBeenCalledWith('course-123', 'enrollment-123');
    });
  });

  describe('Task Endpoints', () => {
    it('should create task', async () => {
      const mockTask: Task = {
        id: 'test-id',
        course_id: 'course-123',
        title: 'Test Task',
        description: 'Description',
        type: 'LESSON' as any,
        order: 1,
        prerequisite_task_id: null,
        completion_criteria: {},
        is_published: true,
        created_by: 'teacher-123',
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: 'teacher-123',
        progress: []
      };

      mockService.createTask.mockResolvedValue(mockTask);

      const result = await controller.createTask('course-123', {
        title: 'Test Task',
        description: 'Description',
        type: 'LESSON',
        order: 1,
        prerequisiteTaskId: null,
        completionCriteria: {},
        createdBy: 'teacher-123'
      });

      expect(result).toEqual(mockTask);
      expect(mockService.createTask).toHaveBeenCalled();
    });

    it('should check task prerequisites', async () => {
      const mockPrereqResult = { canAccess: true, missingPrerequisites: [] };
      mockService.checkTaskPrerequisites.mockResolvedValue(mockPrereqResult);

      const result = await controller.checkTaskPrerequisites('task-123', 'enrollment-123');

      expect(result).toEqual(mockPrereqResult);
      expect(mockService.checkTaskPrerequisites).toHaveBeenCalledWith('task-123', 'enrollment-123');
    });
  });

  describe('Content Release Endpoints', () => {
    it('should create content release', async () => {
      const mockRelease: ContentRelease = {
        id: 'test-id',
        course_id: 'course-123',
        content_type: 'LEARNING_MATERIAL' as any,
        content_id: 'material-123',
        release_type: 'TIME_BASED' as any,
        release_date: new Date(),
        release_conditions: {},
        is_released: false,
        is_active: true,
        created_by: 'teacher-123',
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: 'teacher-123'
      };

      mockService.createContentRelease.mockResolvedValue(mockRelease);

      const result = await controller.createContentRelease('course-123', {
        contentType: 'LEARNING_MATERIAL',
        contentId: 'material-123',
        releaseType: 'TIME_BASED',
        releaseDate: new Date(),
        releaseConditions: {},
        createdBy: 'teacher-123'
      });

      expect(result).toEqual(mockRelease);
      expect(mockService.createContentRelease).toHaveBeenCalled();
    });
  });

  describe('Template Endpoints', () => {
    it('should create content template', async () => {
      const mockTemplate: ContentTemplate = {
        id: 'test-id',
        course_id: 'course-123',
        name: 'Test Template',
        description: 'Description',
        template_type: 'COURSE_STRUCTURE' as any,
        template_data: {},
        placeholders: {},
        is_active: true,
        is_global: false,
        created_by: 'teacher-123',
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: 'teacher-123'
      };

      mockService.createContentTemplate.mockResolvedValue(mockTemplate);

      const result = await controller.createContentTemplate('course-123', {
        name: 'Test Template',
        description: 'Description',
        templateType: 'COURSE_STRUCTURE',
        templateData: {},
        placeholders: {},
        isGlobal: false,
        createdBy: 'teacher-123'
      });

      expect(result).toEqual(mockTemplate);
      expect(mockService.createContentTemplate).toHaveBeenCalled();
    });
  });

  describe('Workgroup Endpoints', () => {
    it('should create course group', async () => {
      const mockGroup: CourseGroup = {
        id: 'test-id',
        course_id: 'course-123',
        name: 'Test Group',
        description: 'Description',
        group_type: 'PROJECT_GROUP' as any,
        is_active: true,
        group_grade: 0,
        group_feedback: null,
        created_by: 'teacher-123',
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: 'teacher-123',
        memberships: []
      };

      mockService.createCourseGroup.mockResolvedValue(mockGroup);

      const result = await controller.createCourseGroup('course-123', {
        name: 'Test Group',
        description: 'Description',
        groupType: 'PROJECT_GROUP',
        createdBy: 'teacher-123'
      });

      expect(result).toEqual(mockGroup);
      expect(mockService.createCourseGroup).toHaveBeenCalled();
    });

    it('should add member to group', async () => {
      const mockMembership: GroupMembership = {
        group_id: 'group-123',
        user_id: 'student-123',
        role: 'MEMBER' as any,
        joined_at: new Date(),
        left_at: null,
        individual_grade: 0,
        individual_feedback: null,
        added_by: 'teacher-123',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockService.addMemberToGroup.mockResolvedValue(mockMembership);

      const result = await controller.addMemberToGroup('group-123', {
        userId: 'student-123',
        role: 'MEMBER',
        addedBy: 'teacher-123'
      });

      expect(result).toEqual(mockMembership);
      expect(mockService.addMemberToGroup).toHaveBeenCalled();
    });
  });

  describe('Calendar Endpoints', () => {
    it('should create calendar event', async () => {
      const mockEvent: CalendarEvent = {
        id: 'test-id',
        course_id: 'course-123',
        title: 'Test Event',
        description: 'Description',
        event_type: 'LECTURE' as any,
        start_time: new Date(),
        end_time: new Date(),
        location: 'Room 101',
        online_link: null,
        is_all_day: false,
        is_recurring: false,
        recurrence_pattern: null,
        related_content_id: null,
        related_content_type: null,
        created_by: 'teacher-123',
        created_at: new Date(),
        updated_at: new Date(),
        updated_by: 'teacher-123'
      };

      mockService.createCalendarEvent.mockResolvedValue(mockEvent);

      const result = await controller.createCalendarEvent('course-123', {
        title: 'Test Event',
        description: 'Description',
        eventType: 'LECTURE',
        startTime: new Date(),
        endTime: new Date(),
        location: 'Room 101',
        onlineLink: '',
        isAllDay: false,
        isRecurring: false,
        recurrencePattern: null,
        relatedContentId: '',
        relatedContentType: '',
        createdBy: 'teacher-123'
      });

      expect(result).toEqual(mockEvent);
      expect(mockService.createCalendarEvent).toHaveBeenCalled();
    });
  });

  describe('Search Endpoints', () => {
    it('should search courses', async () => {
      const mockCourses = [{
        id: '1',
        external_id: 'CS101',
        title: 'Computer Science 101',
        description: 'Introduction to Computer Science',
        semester: 'WS2026',
        status: 'PUBLISHED' as any,
        created_at: new Date(),
        updated_at: new Date()
      }];

      mockService.searchCourses.mockResolvedValue(mockCourses);

      const result = await controller.searchCourses('computer', 10, 0);

      expect(result).toEqual(mockCourses);
      expect(mockService.searchCourses).toHaveBeenCalledWith('computer', 10, 0);
    });
  });
});

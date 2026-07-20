import { LessThanOrEqual } from 'typeorm';
import { ApiNotFoundError, ApiValidationError } from '../common/api-errors';
import { CoursePermission } from '../courses.permissions';
import { Assignment } from '../entities/assignment.entity';
import { ContentRelease, ReleaseType } from '../entities/content-release.entity';
import { ContentTemplate } from '../entities/content-template.entity';
import { Course } from '../entities/course.entity';
import { LearningMaterial } from '../entities/learning-material.entity';
import { Task, TaskUnlockMode } from '../entities/task.entity';

type CourseServiceFacade = any;

export class ContentReleaseTemplateService {
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

  private async findReleaseWithCourseOrThrow(id: string): Promise<ContentRelease> {
    const release = await this.contentReleaseRepository.findOne({
      where: { id },
      relations: ['course'],
    });

    if (!release?.course?.id) {
      throw new ApiNotFoundError('Content release not found');
    }

    return release;
  }

  private async findTemplateWithCourseOrThrow(id: string): Promise<ContentTemplate> {
    const template = await this.contentTemplateRepository.findOne({
      where: { id },
      relations: ['course'],
    });

    if (!template) {
      throw new ApiNotFoundError('Content template not found');
    }

    return template;
  }

  private async assertTemplateReadable(
    template: ContentTemplate,
    actorUserId?: string | number,
  ): Promise<void> {
    if (actorUserId === undefined) {
      return;
    }

    if (template.course?.id) {
      await this.assertCourseReadable(template.course.id, actorUserId);
      return;
    }

    this.requireActorUserId(actorUserId);
  }

  private async assertTemplateManageable(
    template: ContentTemplate,
    actorUserId?: string | number,
  ): Promise<string | undefined> {
    if (actorUserId === undefined) {
      return undefined;
    }

    if (template.course?.id) {
      return this.assertCourseManageable(template.course.id, actorUserId);
    }

    return this.requireActorUserId(actorUserId);
  }

  private async assertEnrollmentContentReadable(
    courseId: string,
    enrollmentId: string,
    actorUserId?: string | number,
  ): Promise<void> {
    if (!enrollmentId) {
      throw new ApiValidationError('enrollmentId is required');
    }

    if (actorUserId === undefined) {
      return;
    }

    const enrollment = await this.enrollmentRepository.findOne({
      where: { id: enrollmentId },
    });

    if (!enrollment || enrollment.courseId !== courseId) {
      throw new ApiNotFoundError('Enrollment not found');
    }

    const actorId = this.toUserId(actorUserId);
    await this.assertCoursePermission(
      courseId,
      actorId,
      enrollment.userId === actorId
        ? CoursePermission.ReadCourseContent
        : CoursePermission.ReadAllResults,
    );
  }

  async createContentRelease(
    courseId: string,
    contentType: string,
    contentId: string,
    releaseType: string,
    releaseDate: Date,
    releaseConditions: any,
    createdBy: string,
    actorUserId?: string | number,
  ): Promise<ContentRelease> {
    const actorId = await this.assertCourseManageable(courseId, actorUserId);
    const creatorId = actorId ?? createdBy;
    const release = new ContentRelease();
    release.contentType = contentType;
    release.contentId = contentId;
    release.releaseType = releaseType as ReleaseType;
    release.releaseDate = releaseDate;
    release.releaseConditions = releaseConditions;
    release.isActive = true;
    release.isReleased = false;
    release.createdBy = creatorId;
    release.updatedBy = creatorId;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    release.course = course;

    return this.contentReleaseRepository.save(release);
  }

  async getContentReleasesByCourse(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<ContentRelease[]> {
    await this.assertCourseReadable(courseId, actorUserId);

    return this.contentReleaseRepository.find({
      where: { course: { id: courseId } },
      order: { releaseDate: 'ASC' },
    });
  }

  async getContentReleaseById(
    id: string,
    actorUserId?: string | number,
  ): Promise<ContentRelease> {
    const release = await this.findReleaseWithCourseOrThrow(id);
    await this.assertCourseReadable(release.course.id, actorUserId);

    return release;
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
    actorUserId?: string | number,
  ): Promise<ContentRelease> {
    const release = await this.findReleaseWithCourseOrThrow(id);
    const actorId = await this.assertCourseManageable(release.course.id, actorUserId);

    release.contentType = contentType;
    release.contentId = contentId;
    release.releaseType = releaseType as ReleaseType;
    release.releaseDate = releaseDate;
    release.releaseConditions = releaseConditions;
    release.isActive = isActive;
    release.updatedBy = actorId ?? updatedBy;

    return this.contentReleaseRepository.save(release);
  }

  async deleteContentRelease(
    id: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const release = await this.findReleaseWithCourseOrThrow(id);
    await this.assertCourseManageable(release.course.id, actorUserId);

    await this.contentReleaseRepository.delete(id);
  }

  async releaseContentManually(
    id: string,
    releasedBy: string,
    actorUserId?: string | number,
  ): Promise<ContentRelease> {
    const release = await this.findReleaseWithCourseOrThrow(id);
    const actorId = await this.assertCourseManageable(release.course.id, actorUserId);

    if (release.isReleased) {
      throw new Error('Content already released');
    }

    release.isReleased = true;
    release.releasedAt = new Date();
    release.releasedBy = actorId ?? releasedBy;

    return this.contentReleaseRepository.save(release);
  }

  async checkAutomaticReleases(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<ContentRelease[]> {
    await this.assertCourseReadable(courseId, actorUserId);

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
    actorUserId?: string | number,
  ): Promise<ContentRelease[]> {
    await this.assertEnrollmentContentReadable(courseId, enrollmentId, actorUserId);

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
    actorUserId?: string | number,
  ): Promise<any[]> {
    await this.assertEnrollmentContentReadable(courseId, enrollmentId, actorUserId);

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
    actorUserId?: string | number,
  ): Promise<any> {
    await this.assertEnrollmentContentReadable(courseId, enrollmentId, actorUserId);

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

  async createContentTemplate(
    courseId: string,
    name: string,
    description: string,
    templateType: string,
    templateData: any,
    placeholders: any,
    isGlobal: boolean,
    createdBy: string,
    actorUserId?: string | number,
  ): Promise<ContentTemplate> {
    const actorId = await this.assertCourseManageable(courseId, actorUserId);
    const creatorId = actorId ?? createdBy;
    const template = new ContentTemplate();
    template.name = name;
    template.description = description;
    template.templateType = templateType;
    template.templateData = templateData;
    template.placeholders = placeholders;
    template.isGlobal = isGlobal;
    template.createdBy = creatorId;
    template.updatedBy = creatorId;
    template.isActive = true;

    // Set the course relation
    const course = new Course();
    course.id = courseId;
    template.course = course;

    return this.contentTemplateRepository.save(template);
  }

  async getContentTemplatesByCourse(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<ContentTemplate[]> {
    await this.assertCourseReadable(courseId, actorUserId);

    return this.contentTemplateRepository.find({
      where: { course: { id: courseId } },
      order: { name: 'ASC' },
    });
  }

  async getGlobalContentTemplates(
    actorUserId?: string | number,
  ): Promise<ContentTemplate[]> {
    if (actorUserId !== undefined) {
      this.requireActorUserId(actorUserId);
    }

    return this.contentTemplateRepository.find({
      where: { isGlobal: true },
      order: { name: 'ASC' },
    });
  }

  async getContentTemplateById(
    id: string,
    actorUserId?: string | number,
  ): Promise<ContentTemplate> {
    const template = await this.findTemplateWithCourseOrThrow(id);
    await this.assertTemplateReadable(template, actorUserId);

    return template;
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
    actorUserId?: string | number,
  ): Promise<ContentTemplate> {
    const template = await this.findTemplateWithCourseOrThrow(id);
    const actorId = await this.assertTemplateManageable(template, actorUserId);

    template.name = name;
    template.description = description;
    template.templateType = templateType;
    template.templateData = templateData;
    template.placeholders = placeholders;
    template.isActive = isActive;
    template.isGlobal = isGlobal;
    template.updatedBy = actorId ?? updatedBy;

    return this.contentTemplateRepository.save(template);
  }

  async deleteContentTemplate(
    id: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const template = await this.findTemplateWithCourseOrThrow(id);
    await this.assertTemplateManageable(template, actorUserId);

    await this.contentTemplateRepository.delete(id);
  }

  async applyTemplateToCourse(
    templateId: string,
    courseId: string,
    appliedBy: string,
    actorUserId?: string | number,
  ): Promise<any> {
    const actorId = await this.assertCourseManageable(courseId, actorUserId);
    const applierId = actorId ?? appliedBy;
    const template = await this.contentTemplateRepository.findOne({
      where: { id: templateId },
      relations: ['course'],
    });

    if (!template) {
      throw new Error('Template not found');
    }

    await this.assertTemplateReadable(template, actorUserId);

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
                  applierId,
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
                  applierId,
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
                const task = await this.createLearningTask(
                  courseId,
                  {
                    title: taskData.title,
                    description: taskData.description || '',
                    type: taskData.type || 'OTHER',
                    order: taskData.order || 1,
                    unlockMode: taskData.prerequisiteTaskId
                      ? TaskUnlockMode.AUTOMATIC
                      : TaskUnlockMode.IMMEDIATE,
                    prerequisiteTaskId: taskData.prerequisiteTaskId || null,
                    completionCriteria: taskData.completionCriteria || {},
                    isPublished: false,
                  },
                  applierId,
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
            applierId,
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
            applierId,
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
            applierId,
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

  async getAvailableTemplatesForCourse(
    courseId: string,
    actorUserId?: string | number,
  ): Promise<ContentTemplate[]> {
    await this.assertCourseReadable(courseId, actorUserId);

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
}

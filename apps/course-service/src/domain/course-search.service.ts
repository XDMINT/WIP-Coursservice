import { CourseDomainService } from './course-domain.service';
import { Assignment } from '../entities/assignment.entity';
import { ContentTemplate } from '../entities/content-template.entity';
import { Course } from '../entities/course.entity';
import { LearningMaterial, LearningMaterialPublicationStatus } from '../entities/learning-material.entity';
import { Task } from '../entities/task.entity';


export class CourseSearchService extends CourseDomainService {

  async searchCourses(
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<Course[]> {
    return this.repositories.courses.find({
      where: [
        { title: this.repositories.ilike(`%${query}%`) },
        { description: this.repositories.ilike(`%${query}%`) },
        { external_id: this.repositories.ilike(`%${query}%`) },
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
    const { run, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));

    return this.repositories.learningMaterials.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
        courseVersionId: version.id,
        publicationStatus: this.repositories.not(LearningMaterialPublicationStatus.ARCHIVED),
        title: this.repositories.ilike(`%${query}%`),
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
    return this.repositories.assignments.find({
      where: {
        course: { id: courseId },
        title: this.repositories.ilike(`%${query}%`),
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
    const { run, version } =
      await this.getActiveCourseVersionForCurrentRunOrThrow(this.toCourseId(courseId));

    return this.repositories.tasks.find({
      where: {
        courseId: this.toCourseId(courseId),
        courseRunId: run.id,
        courseVersionId: version.id,
        title: this.repositories.ilike(`%${query}%`),
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
    return this.repositories.contentTemplates.find({
      where: [
        { name: this.repositories.ilike(`%${query}%`) },
        { description: this.repositories.ilike(`%${query}%`) },
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
      results.learningMaterials = await this.repositories.learningMaterials.find({
        where: {
          title: this.repositories.ilike(`%${query}%`),
        },
        take: limit,
        skip: offset,
        relations: ['course'],
      });
    }

    if (contentTypes.includes('ASSIGNMENT')) {
      // Search across all courses for assignments
      results.assignments = await this.repositories.assignments.find({
        where: {
          title: this.repositories.ilike(`%${query}%`),
        },
        take: limit,
        skip: offset,
        relations: ['course'],
      });
    }

    if (contentTypes.includes('TASK')) {
      // Search across all courses for tasks
      results.tasks = await this.repositories.tasks.find({
        where: {
          title: this.repositories.ilike(`%${query}%`),
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
}

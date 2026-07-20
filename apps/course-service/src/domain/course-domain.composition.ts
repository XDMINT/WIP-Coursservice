import {
  CourseDomainContext,
  CourseDomainFacade,
} from './course-domain.context';
import { AssessmentService } from './assessment.service';
import { AssignmentGradeService } from './assignment-grade.service';
import { CalendarEventService } from './calendar-event.service';
import { ContentReleaseTemplateService } from './content-release-template.service';
import { CourseCatalogService } from './course-catalog.service';
import { CourseResultService } from './course-result.service';
import { CourseRunVersionService } from './course-run-version.service';
import { CourseSearchService } from './course-search.service';
import { LearningMaterialService } from './learning-material.service';
import { LearningTaskService } from './learning-task.service';
import { LegacyWorkgroupService } from './legacy-workgroup.service';

export class CourseDomainServices {
  readonly assessment: AssessmentService;
  readonly assignmentGrade: any;
  readonly calendarEvent: any;
  readonly contentReleaseTemplate: any;
  readonly courseCatalog: any;
  readonly courseResult: CourseResultService;
  readonly courseRunVersion: any;
  readonly courseSearch: any;
  readonly learningMaterial: any;
  readonly learningTask: any;
  readonly legacyWorkgroup: any;

  private constructor(input: {
    assessment: AssessmentService;
    assignmentGrade: any;
    calendarEvent: any;
    contentReleaseTemplate: any;
    courseCatalog: any;
    courseResult: CourseResultService;
    courseRunVersion: any;
    courseSearch: any;
    learningMaterial: any;
    learningTask: any;
    legacyWorkgroup: any;
  }) {
    Object.assign(this, input);
  }

  static create(
    domainContext: CourseDomainContext,
    domainFacade: CourseDomainFacade,
  ): CourseDomainServices {
    const courseResult = new CourseResultService(domainFacade);
    const assessment = new AssessmentService(domainFacade);
    const learningMaterialService = new LearningMaterialService(domainFacade);
    const courseRunVersionService = new CourseRunVersionService(domainFacade);
    const courseCatalogService = new CourseCatalogService(domainFacade);
    const assignmentGradeService = new AssignmentGradeService(domainFacade);
    const contentReleaseTemplateService = new ContentReleaseTemplateService(domainFacade);
    const courseSearchService = new CourseSearchService(domainFacade);
    const legacyWorkgroupService = new LegacyWorkgroupService(domainFacade);
    const calendarEventService = new CalendarEventService(domainFacade);
    const learningTaskService = new LearningTaskService(domainFacade);

    domainContext.registerDomainServices(
      courseResult,
      assessment,
      learningMaterialService,
      courseRunVersionService,
      courseCatalogService,
      assignmentGradeService,
      contentReleaseTemplateService,
      courseSearchService,
      legacyWorkgroupService,
      calendarEventService,
      learningTaskService,
    );

    return new CourseDomainServices({
      assessment,
      assignmentGrade: assignmentGradeService.api,
      calendarEvent: calendarEventService.api,
      contentReleaseTemplate: contentReleaseTemplateService.api,
      courseCatalog: courseCatalogService.api,
      courseResult,
      courseRunVersion: courseRunVersionService.api,
      courseSearch: courseSearchService.api,
      learningMaterial: learningMaterialService.api,
      learningTask: learningTaskService.api,
      legacyWorkgroup: legacyWorkgroupService.api,
    });
  }
}

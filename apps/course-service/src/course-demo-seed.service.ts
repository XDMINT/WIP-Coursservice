import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Course, CourseStatus } from './entities/course.entity';
import {
  CourseRecurrenceType,
  CourseRun,
  CourseRunStatus,
} from './entities/course-run.entity';
import { CourseVersion, CourseVersionStatus } from './entities/course-version.entity';
import { CourseMemberRole, Enrollment } from './entities/enrollment.entity';
import {
  LearningMaterial,
  LearningMaterialPublicationStatus,
  LearningMaterialReleaseMode,
  LearningMaterialType,
} from './entities/learning-material.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership, MembershipRole } from './entities/group-membership.entity';
import {
  Task,
  TaskGradingMode,
  TaskLearningPathType,
  TaskUnlockMode,
  TaskWorkMode,
} from './entities/task.entity';
import {
  TaskDependency,
  TaskDependencyCondition,
  TaskDependencyOperator,
} from './entities/task-dependency.entity';
import {
  TaskAssessment,
  TaskAssessmentStatus,
  TaskAssessmentTargetType,
} from './entities/task-assessment.entity';
import {
  TaskProgress,
  TaskProgressStatus,
  TaskUnlockSource,
} from './entities/task-progress.entity';
import { GroupTaskProgress } from './entities/group-task-progress.entity';
import {
  CoursePassStatus,
  CourseResult,
  CourseResultMode,
  CourseResultSource,
} from './entities/course-result.entity';
import { LocalMaterialStorage } from './storage/material-storage';
import { TaskServiceClient, TaskServiceTask, TaskServiceTaskPayload } from './task-service.client';

const DEMO_COURSE_EXTERNAL_ID = 'demo-learning-process';
const DEMO_ENROLLABLE_COURSE_EXTERNAL_ID = 'demo-enrollable-course';
const WEB_TECH_COURSE_EXTERNAL_ID = 'demo-webtechnologien';
const DEMO_TEACHER_ID = '1';
const DEMO_STUDENT_ID = '3';
const DEMO_GROUP_STUDENT_ID = '4';
const DEMO_UNGROUPED_STUDENT_ID = '5';
const DEMO_SEED_USER = 'demo-seed';
const DEMO_ACTIVE_SEMESTER_RUN_LABEL = 'Wintersemester 2026/27';
const DEMO_PREVIOUS_SEMESTER_RUN_LABEL = 'Sommersemester 2026';
const WEB_TECH_ACTIVE_RUN_LABEL = 'Wintersemester 2026/27';
const WEB_TECH_PREVIOUS_RUN_LABEL = 'Sommersemester 2026';

type DemoTaskDependencySeed = {
  prerequisiteDemoKey: string;
  condition?: TaskDependencyCondition;
};

type DemoTaskSeed = {
  demoKey: string;
  title: string;
  description: string;
  order: number;
  unlockMode: TaskUnlockMode;
  gradingMode: TaskGradingMode;
  workMode?: TaskWorkMode;
  maxPoints?: number;
  passThreshold?: number;
  prerequisiteDemoKey?: string;
  dependencies?: DemoTaskDependencySeed[];
  dependencyOperator?: TaskDependencyOperator;
  learningPathType?: TaskLearningPathType;
  allowRetries?: boolean;
  feedbackRequired?: boolean;
};

type DemoRunSeed = {
  label: string;
  startDate?: string;
  endDate?: string;
  status: CourseRunStatus;
  active: boolean;
  sourceLabel?: string;
};

type DemoMaterialSeed = {
  title: string;
  description: string;
  type?: LearningMaterialType;
  url?: string;
  originalFileName?: string;
  mimeType?: string;
  fileContent?: string;
  previewMetadata?: Record<string, unknown>;
  tags: string[];
  sortOrder: number;
  releaseMode?: LearningMaterialReleaseMode;
  releaseAt?: Date;
  releaseAfterDemoKey?: string;
};

type DemoGroupSeed = {
  name: string;
  description: string;
  memberIds: string[];
};

const demoTaskSeeds: DemoTaskSeed[] = [
  {
    demoKey: 'learning-process-basics',
    title: 'Grundlagen kennenlernen',
    description: 'Ein kurzer einführender Lernschritt für den Demo-Ablauf.',
    order: 1,
    unlockMode: TaskUnlockMode.IMMEDIATE,
    gradingMode: TaskGradingMode.SELF_CONFIRMATION,
  },
  {
    demoKey: 'learning-process-apply-basics',
    title: 'Grundlagen anwenden',
    description: 'Eine manuell bewertete Demo-Aufgabe mit Abgabe und Lehrendenfeedback.',
    order: 2,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    gradingMode: TaskGradingMode.MANUAL,
    workMode: TaskWorkMode.GROUP,
    maxPoints: 10,
    passThreshold: 50,
    prerequisiteDemoKey: 'learning-process-basics',
  },
  {
    demoKey: 'learning-process-final-task',
    title: 'Automatische Demo-Bewertung auslösen',
    description: 'Eine automatisch bewertete Demo-Aufgabe, die im Mini-Projekt durch einen Mock bewertet wird.',
    order: 3,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    gradingMode: TaskGradingMode.AUTOMATIC_MOCK,
    maxPoints: 10,
    passThreshold: 50,
    prerequisiteDemoKey: 'learning-process-apply-basics',
  },
];

const webTechnologiesTaskSeeds: DemoTaskSeed[] = [
  {
    demoKey: 'webtech-http-dom-basics',
    title: 'HTTP und DOM einordnen',
    description: 'Kurzer Einstieg in Request/Response, HTML-Dokumentstruktur und Browser-DOM.',
    order: 1,
    unlockMode: TaskUnlockMode.IMMEDIATE,
    gradingMode: TaskGradingMode.SELF_CONFIRMATION,
    learningPathType: TaskLearningPathType.STANDARD,
    allowRetries: true,
  },
  {
    demoKey: 'webtech-html-css-page',
    title: 'HTML/CSS Landingpage umsetzen',
    description: 'Eine kleine responsive Seite mit semantischem HTML, CSS-Layout und nachvollziehbarer Struktur abgeben.',
    order: 2,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    gradingMode: TaskGradingMode.MANUAL,
    learningPathType: TaskLearningPathType.PRACTICE,
    maxPoints: 10,
    passThreshold: 50,
    prerequisiteDemoKey: 'webtech-http-dom-basics',
    feedbackRequired: true,
    allowRetries: true,
  },
  {
    demoKey: 'webtech-remedial-html-css',
    title: 'Wiederholung: HTML/CSS Grundlagen sichern',
    description: 'Gezielte Wiederholungsaufgabe mit Fokus auf semantische Struktur, Box-Modell und einfache Responsiveness.',
    order: 3,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    gradingMode: TaskGradingMode.SELF_CONFIRMATION,
    learningPathType: TaskLearningPathType.REMEDIAL,
    dependencies: [
      {
        prerequisiteDemoKey: 'webtech-html-css-page',
        condition: TaskDependencyCondition.FAILED,
      },
    ],
    allowRetries: true,
  },
  {
    demoKey: 'webtech-js-interaction',
    title: 'JavaScript-Interaktion implementieren',
    description: 'DOM-Events nutzen, Formularzustand auswerten und ein kleines interaktives UI-Verhalten implementieren.',
    order: 4,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    gradingMode: TaskGradingMode.AUTOMATIC_MOCK,
    learningPathType: TaskLearningPathType.PRACTICE,
    maxPoints: 10,
    passThreshold: 50,
    prerequisiteDemoKey: 'webtech-html-css-page',
    allowRetries: true,
  },
  {
    demoKey: 'webtech-accessibility-performance',
    title: 'Vertiefung: Barrierefreiheit und Performance',
    description: 'Optionale Vertiefung zu Tastaturbedienung, Kontrasten, Ladezeiten und einfachen Lighthouse-Hinweisen.',
    order: 5,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    gradingMode: TaskGradingMode.SELF_CONFIRMATION,
    learningPathType: TaskLearningPathType.DEEPENING,
    dependencies: [
      {
        prerequisiteDemoKey: 'webtech-js-interaction',
        condition: TaskDependencyCondition.PASSED,
      },
      {
        prerequisiteDemoKey: 'webtech-remedial-html-css',
        condition: TaskDependencyCondition.COMPLETED,
      },
    ],
    dependencyOperator: TaskDependencyOperator.ANY_OF,
    allowRetries: true,
  },
  {
    demoKey: 'webtech-team-mini-project',
    title: 'Mini-Projekt: REST-Frontend im Team',
    description: 'Als Gruppe eine kleine Oberfläche bauen, die Daten aus einer JSON-API lädt und Fehlerzustände verständlich darstellt.',
    order: 6,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    gradingMode: TaskGradingMode.MANUAL,
    workMode: TaskWorkMode.GROUP,
    learningPathType: TaskLearningPathType.PRACTICE,
    maxPoints: 20,
    passThreshold: 50,
    prerequisiteDemoKey: 'webtech-js-interaction',
    feedbackRequired: true,
    allowRetries: true,
  },
];

const webTechnologiesMaterialSeeds: DemoMaterialSeed[] = [
  {
    title: 'Syllabus Webtechnologien',
    description: 'Vereinfachte Moduluebersicht mit Lernzielen, Ablauf und Bewertungskriterien.',
    type: LearningMaterialType.DOCUMENT,
    originalFileName: 'webtechnologien-syllabus.pdf',
    mimeType: 'application/pdf',
    fileContent: `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 140] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 83 >>
stream
BT /F1 12 Tf 24 100 Td (Webtechnologien Demo: HTTP, HTML, CSS, JavaScript, Projekt) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000204 00000 n
trailer
<< /Root 1 0 R /Size 5 >>
startxref
337
%%EOF`,
    tags: ['syllabus', 'lernziele', 'organisation'],
    sortOrder: 1,
  },
  {
    title: 'Foliensatz: HTTP, HTML und CSS',
    description: 'Kompakte Vorlesungsnotizen zu Web-Grundlagen, Dokumentstruktur und Layout.',
    type: LearningMaterialType.PRESENTATION,
    originalFileName: 'folien-http-html-css.md',
    mimeType: 'text/markdown',
    fileContent: '# HTTP, HTML und CSS\n\n- Request/Response\n- Semantisches HTML\n- CSS Layout\n- Responsive Grundlagen\n',
    tags: ['folien', 'http', 'html', 'css'],
    sortOrder: 2,
  },
  {
    title: 'MDN Web Docs: Einstieg in Webtechnologien',
    description: 'Externe Referenz zum Nachschlagen von HTML, CSS, JavaScript und HTTP.',
    type: LearningMaterialType.EXTERNAL_LINK,
    url: 'https://developer.mozilla.org/de/docs/Learn',
    tags: ['link', 'referenz', 'mdn'],
    sortOrder: 3,
  },
  {
    title: 'Video-Demo: Browser DevTools Workflow',
    description: 'Kleine Demo-Datei, um Video-Material und autorisierten Download im Kurs zu zeigen.',
    type: LearningMaterialType.VIDEO,
    originalFileName: 'devtools-workflow-demo.mp4',
    mimeType: 'video/mp4',
    fileContent: 'Demo-Platzhalter fuer ein kurzes DevTools-Video.',
    tags: ['video', 'devtools'],
    sortOrder: 4,
  },
  {
    title: 'Starterprojekt Landingpage',
    description: 'Minimales Starterpaket fuer die HTML/CSS-Aufgabe.',
    type: LearningMaterialType.OTHER_FILE,
    originalFileName: 'starterprojekt-webtechnologien.txt',
    mimeType: 'text/plain',
    fileContent: 'index.html\nstyles.css\nREADME.md\n\nDemo-Starterprojekt fuer den Kurs Webtechnologien.',
    tags: ['starter', 'projekt', 'datei'],
    sortOrder: 5,
    releaseMode: LearningMaterialReleaseMode.AFTER_TASK_COMPLETION,
    releaseAfterDemoKey: 'webtech-http-dom-basics',
  },
  {
    title: 'Deployment-Checkliste',
    description: 'Geplantes Material fuer die Projektphase mit Build-, Accessibility- und Deployment-Checks.',
    type: LearningMaterialType.DOCUMENT,
    originalFileName: 'deployment-checkliste.md',
    mimeType: 'text/markdown',
    fileContent: '# Deployment-Checkliste\n\n- Build erfolgreich\n- Responsiveness geprueft\n- Tastaturbedienung geprueft\n- Fehlerzustand sichtbar\n',
    tags: ['deployment', 'checkliste', 'geplant'],
    sortOrder: 6,
    releaseMode: LearningMaterialReleaseMode.SCHEDULED,
    releaseAt: new Date('2026-11-15T08:00:00.000Z'),
  },
];

const parseBoolean = (value?: string): boolean =>
  value != null && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

@Injectable()
export class CourseDemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CourseDemoSeedService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseRun)
    private readonly courseRunRepository: Repository<CourseRun>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(LearningMaterial)
    private readonly learningMaterialRepository: Repository<LearningMaterial>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(TaskDependency)
    private readonly taskDependencyRepository: Repository<TaskDependency>,
    @InjectRepository(TaskAssessment)
    private readonly taskAssessmentRepository: Repository<TaskAssessment>,
    @InjectRepository(TaskProgress)
    private readonly taskProgressRepository: Repository<TaskProgress>,
    @InjectRepository(GroupTaskProgress)
    private readonly groupTaskProgressRepository: Repository<GroupTaskProgress>,
    @InjectRepository(CourseResult)
    private readonly courseResultRepository: Repository<CourseResult>,
    @InjectRepository(CourseVersion)
    private readonly courseVersionRepository: Repository<CourseVersion>,
    @InjectRepository(CourseGroup)
    private readonly courseGroupRepository: Repository<CourseGroup>,
    @InjectRepository(GroupMembership)
    private readonly groupMembershipRepository: Repository<GroupMembership>,
    private readonly materialStorage: LocalMaterialStorage,
    private readonly taskServiceClient?: TaskServiceClient,
  ) {}

  private localTaskContent(payload: TaskServiceTaskPayload & { id: string }): TaskServiceTask {
    return {
      id: payload.id,
      title: payload.title,
      description: payload.description ?? '',
      type: payload.type ?? 'DEMO_TASK',
      content: payload.content ?? {},
      defaultMaxScore: payload.defaultMaxScore ?? null,
      defaultPassThreshold: payload.defaultPassThreshold ?? null,
      mockEvaluationMode: payload.mockEvaluationMode ?? null,
    };
  }

  private async upsertTaskContent(
    payload: TaskServiceTaskPayload & { id: string },
  ): Promise<TaskServiceTask> {
    if (this.taskServiceClient) {
      return this.taskServiceClient.createTask(payload);
    }

    return this.localTaskContent(payload);
  }

  private async loadTaskContents(tasks: Task[]): Promise<Map<string, TaskServiceTask>> {
    if (this.taskServiceClient) {
      return this.taskServiceClient.getTasks(tasks.map((task) => task.externalTaskId));
    }

    return new Map(tasks.map((task) => {
      const id = task.externalTaskId ?? task.id;

      return [id, this.localTaskContent({
        id,
        title: task.title ?? 'Aufgabe',
        description: task.description ?? '',
        type: task.type ?? 'DEMO_TASK',
        content: task.content ?? task.completionCriteria ?? {},
        defaultMaxScore: task.maxPoints ?? null,
        defaultPassThreshold: task.passThreshold ?? null,
        mockEvaluationMode: task.gradingMode ?? null,
      })];
    }));
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.shouldSeedDemoData()) {
      this.logger.log(
        JSON.stringify({
          level: 'info',
          event: 'demo_seed_skipped',
          reason: 'disabled_or_non_demo_environment',
        }),
      );
      return;
    }

    this.logger.log(
      JSON.stringify({
        level: 'info',
        event: 'demo_seed_started',
      }),
    );

    try {
      await this.seedLearningProcessDemo();
      await this.seedWebTechnologiesDemo();
      this.logger.log(
        JSON.stringify({
          level: 'info',
          event: 'demo_seed_completed',
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          event: 'demo_seed_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }),
      );
      throw error;
    }
  }

  private shouldSeedDemoData(): boolean {
    if (parseBoolean(this.configService.get<string>('COURSE_DEMO_SEED_DISABLED'))) {
      return false;
    }

    const appEnv = (
      this.configService.get<string>('APP_ENV') ??
      process.env.NODE_ENV ??
      'development'
    ).toLowerCase();

    return ['development', 'demo', 'test'].includes(appEnv);
  }

  private async seedLearningProcessDemo(): Promise<void> {
    const course = await this.upsertDemoCourse();
    const enrollableCourse = await this.upsertDemoEnrollableCourse();
    const learningRuns = await this.upsertDemoRuns(course, [
      {
        label: DEMO_PREVIOUS_SEMESTER_RUN_LABEL,
        startDate: '2026-04-01',
        endDate: '2026-09-30',
        status: CourseRunStatus.ARCHIVED,
        active: false,
      },
      {
        label: DEMO_ACTIVE_SEMESTER_RUN_LABEL,
        startDate: '2026-10-01',
        endDate: '2027-03-31',
        status: CourseRunStatus.PUBLISHED,
        active: true,
        sourceLabel: DEMO_PREVIOUS_SEMESTER_RUN_LABEL,
      },
    ]);
    const enrollableRuns = await this.upsertDemoRuns(enrollableCourse, [
      {
        label: 'Fortlaufend',
        status: CourseRunStatus.PUBLISHED,
        active: true,
      },
    ]);
    const activeLearningRun =
      learningRuns.get(DEMO_ACTIVE_SEMESTER_RUN_LABEL) ??
      Array.from(learningRuns.values())[0];
    const previousLearningRun = learningRuns.get(DEMO_PREVIOUS_SEMESTER_RUN_LABEL);
    const activeEnrollableRun =
      enrollableRuns.get('Fortlaufend') ??
      Array.from(enrollableRuns.values())[0];

    if (!activeLearningRun || !activeEnrollableRun) {
      return;
    }

    await this.upsertDemoEnrollment(
      course,
      activeLearningRun,
      DEMO_TEACHER_ID,
      CourseMemberRole.TEACHER,
    );
    await this.upsertDemoEnrollment(
      course,
      activeLearningRun,
      DEMO_STUDENT_ID,
      CourseMemberRole.STUDENT,
    );
    await this.upsertDemoEnrollment(
      course,
      activeLearningRun,
      DEMO_GROUP_STUDENT_ID,
      CourseMemberRole.STUDENT,
    );
    await this.upsertDemoEnrollment(
      course,
      activeLearningRun,
      DEMO_UNGROUPED_STUDENT_ID,
      CourseMemberRole.STUDENT,
    );
    await this.upsertDemoEnrollment(
      enrollableCourse,
      activeEnrollableRun,
      DEMO_TEACHER_ID,
      CourseMemberRole.TEACHER,
    );
    if (previousLearningRun) {
      await this.upsertDemoTasks(course, previousLearningRun, [demoTaskSeeds[0]]);
      await this.upsertDemoMaterials(course, previousLearningRun, [
        {
          title: 'Material A',
          description: 'Historisches Demo-Material aus dem Sommersemester 2026.',
          url: 'https://example.com/demo/material-a',
          tags: ['demo', 'sommersemester'],
          sortOrder: 1,
        },
        {
          title: 'Material B',
          description: 'Weiteres historisches Demo-Material aus dem Sommersemester 2026.',
          url: 'https://example.com/demo/material-b',
          tags: ['demo', 'sommersemester'],
          sortOrder: 2,
        },
      ]);
    }
    await this.upsertDemoTasks(course, activeLearningRun);
    await this.upsertDemoGroups(course, activeLearningRun);
    await this.upsertDemoMaterials(course, activeLearningRun, [
      {
        title: 'Material C',
        description: 'Aktives Demo-Material aus dem Wintersemester 2026/27.',
        url: 'https://example.com/demo/material-c',
        tags: ['demo', 'wintersemester'],
        sortOrder: 1,
      },
      {
        title: 'Material D',
        description: 'Wird nach erfolgreichem Abschluss der Grundlagen sichtbar.',
        url: 'https://example.com/demo/material-d',
        tags: ['demo', 'freischaltung'],
        sortOrder: 2,
        releaseMode: LearningMaterialReleaseMode.AFTER_TASK_COMPLETION,
        releaseAfterDemoKey: 'learning-process-basics',
      },
      {
        title: 'Material E',
        description: 'Geplantes Demo-Material mit fester Freischaltung.',
        url: 'https://example.com/demo/material-e',
        tags: ['demo', 'geplant'],
        sortOrder: 3,
        releaseMode: LearningMaterialReleaseMode.SCHEDULED,
        releaseAt: new Date('2026-10-01T08:00:00.000Z'),
      },
    ]);
    await this.upsertDemoVersions(course, activeLearningRun, [
      {
        versionNumber: 1,
        changeSummary: 'Initiale Demo-Version',
        active: false,
        content: {
          course: {
            title: 'Demo-Kurs Lernprozess',
            description: 'Erste Version des Demo-Lernprozesses.',
          },
        },
      },
      {
        versionNumber: 2,
        changeSummary: 'Lernprozess mit Freischaltlogik ergänzt',
        active: true,
        content: {
          course: {
            title: 'Demo-Kurs Lernprozess',
            description: 'Aktive Version mit Aufgabenfreischaltung.',
          },
        },
      },
    ]);
    await this.upsertDemoVersions(enrollableCourse, activeEnrollableRun, [
      {
        versionNumber: 1,
        changeSummary: 'Veröffentlichter Einschreibedemo-Kurs',
        active: true,
        content: {
          course: {
            title: 'Demo-Kurs Einschreibung',
            description: 'Veröffentlichter Kurs für die Einschreibe-Demo.',
          },
        },
      },
    ]);
  }

  private async seedWebTechnologiesDemo(): Promise<void> {
    const course = await this.upsertWebTechnologiesCourse();
    const runs = await this.upsertDemoRuns(course, [
      {
        label: WEB_TECH_PREVIOUS_RUN_LABEL,
        startDate: '2026-04-01',
        endDate: '2026-09-30',
        status: CourseRunStatus.ARCHIVED,
        active: false,
      },
      {
        label: WEB_TECH_ACTIVE_RUN_LABEL,
        startDate: '2026-10-01',
        endDate: '2027-03-31',
        status: CourseRunStatus.PUBLISHED,
        active: true,
        sourceLabel: WEB_TECH_PREVIOUS_RUN_LABEL,
      },
    ]);
    const activeRun =
      runs.get(WEB_TECH_ACTIVE_RUN_LABEL) ??
      Array.from(runs.values()).find((run) => run.isActive);
    const previousRun = runs.get(WEB_TECH_PREVIOUS_RUN_LABEL);

    if (!activeRun) {
      return;
    }

    await this.upsertDemoEnrollment(
      course,
      activeRun,
      DEMO_TEACHER_ID,
      CourseMemberRole.TEACHER,
    );
    const studentEnrollment = await this.upsertDemoEnrollment(
      course,
      activeRun,
      DEMO_STUDENT_ID,
      CourseMemberRole.STUDENT,
    );
    const groupStudentEnrollment = await this.upsertDemoEnrollment(
      course,
      activeRun,
      DEMO_GROUP_STUDENT_ID,
      CourseMemberRole.STUDENT,
    );
    const ungroupedStudentEnrollment = await this.upsertDemoEnrollment(
      course,
      activeRun,
      DEMO_UNGROUPED_STUDENT_ID,
      CourseMemberRole.STUDENT,
    );

    if (previousRun) {
      const previousVersions = await this.upsertDemoVersions(course, previousRun, [
        {
          versionNumber: 1,
          changeSummary: 'Historische Basisversion mit statischen Webseiten',
          active: true,
          content: {
            course: {
              title: 'Webtechnologien',
              description: 'Historischer Durchlauf mit Fokus auf HTML und CSS.',
            },
          },
        },
      ]);
      const previousVersion = previousVersions.get(1);

      await this.upsertDemoTasks(course, previousRun, [
        webTechnologiesTaskSeeds[0],
        webTechnologiesTaskSeeds[1],
      ], previousVersion);
      await this.upsertDemoMaterials(course, previousRun, [
        {
          title: 'Archiv: HTML/CSS Uebungsblatt',
          description: 'Historisches Uebungsblatt aus dem Sommersemester 2026.',
          type: LearningMaterialType.DOCUMENT,
          originalFileName: 'archiv-html-css-uebung.md',
          mimeType: 'text/markdown',
          fileContent: '# Archivuebung\n\nSemantisches HTML und CSS-Grundlayout.',
          tags: ['archiv', 'html', 'css'],
          sortOrder: 1,
        },
      ], previousVersion);
      await this.upsertDemoVersions(course, previousRun, [
        {
          versionNumber: 1,
          changeSummary: 'Historische Basisversion mit statischen Webseiten',
          active: true,
          content: {
            course: {
              title: 'Webtechnologien',
              description: 'Historischer Durchlauf mit Fokus auf HTML und CSS.',
            },
          },
        },
      ]);
    }

    const versions = await this.upsertDemoVersions(course, activeRun, [
      {
        versionNumber: 1,
        changeSummary: 'Basisversion mit HTTP, HTML und CSS',
        active: false,
        content: {
          course: {
            title: 'Webtechnologien',
            description: 'Vereinfachter THM-naher Kurs mit Vorlesung und Uebung.',
          },
        },
      },
      {
        versionNumber: 2,
        changeSummary: 'Lernpfade, Gruppenprojekt, Materialien und Bewertungen ergänzt',
        active: true,
        content: {
          course: {
            title: 'Webtechnologien',
            description:
              'Demo-Kurs zu HTTP, HTML, CSS, JavaScript, REST und Projektarbeit.',
          },
        },
      },
    ]);
    const activeVersion = versions.get(2) ?? Array.from(versions.values()).find(
      (version) => version.is_active,
    );

    await this.upsertDemoTasks(course, activeRun, webTechnologiesTaskSeeds, activeVersion);
    const group = await this.upsertDemoGroups(course, activeRun, {
      name: 'Projektteam DOM',
      description: 'Demo-Gruppe fuer das REST-Frontend-Mini-Projekt.',
      memberIds: [DEMO_GROUP_STUDENT_ID, DEMO_UNGROUPED_STUDENT_ID],
    });
    await this.upsertDemoMaterials(
      course,
      activeRun,
      webTechnologiesMaterialSeeds,
      activeVersion,
    );
    await this.seedWebTechnologiesProgress(
      course,
      activeRun,
      activeVersion,
      {
        student: studentEnrollment,
        groupStudent: groupStudentEnrollment,
        ungroupedStudent: ungroupedStudentEnrollment,
      },
      group,
    );
    await this.upsertDemoVersions(course, activeRun, [
      {
        versionNumber: 1,
        changeSummary: 'Basisversion mit HTTP, HTML und CSS',
        active: false,
        content: {
          course: {
            title: 'Webtechnologien',
            description: 'Vereinfachter THM-naher Kurs mit Vorlesung und Uebung.',
          },
        },
      },
      {
        versionNumber: 2,
        changeSummary: 'Lernpfade, Gruppenprojekt, Materialien und Bewertungen ergänzt',
        active: true,
        content: {
          course: {
            title: 'Webtechnologien',
            description:
              'Demo-Kurs zu HTTP, HTML, CSS, JavaScript, REST und Projektarbeit.',
          },
        },
      },
    ]);
  }

  private async upsertDemoCourse(): Promise<Course> {
    const existingCourse = await this.courseRepository.findOne({
      where: { external_id: DEMO_COURSE_EXTERNAL_ID },
    });

    if (existingCourse) {
      await this.ensureCourseRecurrence(
        existingCourse,
        CourseRecurrenceType.SEMESTER,
      );
      return existingCourse;
    }

    const course = new Course();
    course.external_id = DEMO_COURSE_EXTERNAL_ID;
    course.created_by = DEMO_SEED_USER;
    course.title = 'Demo-Kurs Lernprozess';
    course.description = 'Deterministischer Demo-Kurs für Aufgaben, Fortschritt und Freischaltlogik.';
    course.semester = 'Demo';
    course.status = CourseStatus.PUBLISHED;
    course.location = 'Demo';
    course.owner_id = Number(DEMO_TEACHER_ID);
    course.recurrenceType = CourseRecurrenceType.SEMESTER;
    course.updated_by = DEMO_SEED_USER;

    return this.courseRepository.save(course);
  }

  private async upsertDemoEnrollableCourse(): Promise<Course> {
    const existingCourse = await this.courseRepository.findOne({
      where: { external_id: DEMO_ENROLLABLE_COURSE_EXTERNAL_ID },
    });

    if (existingCourse) {
      await this.ensureCourseRecurrence(
        existingCourse,
        CourseRecurrenceType.CONTINUOUS,
      );
      return existingCourse;
    }

    const course = new Course();
    course.external_id = DEMO_ENROLLABLE_COURSE_EXTERNAL_ID;
    course.created_by = DEMO_SEED_USER;
    course.title = 'Demo-Kurs Einschreibung';
    course.description = 'Veröffentlichter Demo-Kurs, in den sich Studierende einschreiben können.';
    course.semester = 'Demo';
    course.status = CourseStatus.PUBLISHED;
    course.location = 'Friedberg';
    course.owner_id = Number(DEMO_TEACHER_ID);
    course.recurrenceType = CourseRecurrenceType.CONTINUOUS;
    course.updated_by = DEMO_SEED_USER;

    return this.courseRepository.save(course);
  }

  private async upsertWebTechnologiesCourse(): Promise<Course> {
    const existingCourse = await this.courseRepository.findOne({
      where: { external_id: WEB_TECH_COURSE_EXTERNAL_ID },
    });

    if (existingCourse) {
      await this.ensureCourseRecurrence(
        existingCourse,
        CourseRecurrenceType.SEMESTER,
      );
      return existingCourse;
    }

    const course = new Course();
    course.external_id = WEB_TECH_COURSE_EXTERNAL_ID;
    course.created_by = DEMO_SEED_USER;
    course.title = 'Webtechnologien';
    course.description =
      'Vereinfachter Testkurs nach THM-Modulrahmen: Vorlesung und Uebung zu HTTP, HTML, CSS, JavaScript, REST und Webprojekt.';
    course.semester = WEB_TECH_ACTIVE_RUN_LABEL;
    course.status = CourseStatus.PUBLISHED;
    course.location = 'THM Gießen / online';
    course.owner_id = Number(DEMO_TEACHER_ID);
    course.recurrenceType = CourseRecurrenceType.SEMESTER;
    course.updated_by = DEMO_SEED_USER;

    return this.courseRepository.save(course);
  }

  private async ensureCourseRecurrence(
    course: Course,
    recurrenceType: CourseRecurrenceType,
  ): Promise<void> {
    if (course.recurrenceType === recurrenceType) {
      return;
    }

    course.recurrenceType = recurrenceType;
    await this.courseRepository.save(course);
  }

  private async upsertDemoRuns(
    course: Course,
    seeds: DemoRunSeed[],
  ): Promise<Map<string, CourseRun>> {
    let runs = await this.courseRunRepository.find({
      where: {
        courseId: course.id,
      },
    });
    const runByLabel = new Map(runs.map((run) => [run.label, run]));

    for (const seed of seeds) {
      let run = runByLabel.get(seed.label);

      if (!run) {
        run = new CourseRun();
        run.courseId = course.id;
        run.course = course;
        run.label = seed.label;
        run.startDate = seed.startDate;
        run.endDate = seed.endDate;
        run.status = seed.status;
        run.isActive = false;
        run.createdBy = DEMO_SEED_USER;

        run = await this.courseRunRepository.save(run);
        runByLabel.set(seed.label, run);
        runs.push(run);
      }

      if (seed.sourceLabel && !run.sourceRunId) {
        const sourceRun = runByLabel.get(seed.sourceLabel);

        if (sourceRun) {
          run.sourceRunId = sourceRun.id;
          run.sourceRun = sourceRun;
          await this.courseRunRepository.save(run);
        }
      }
    }

    const activeSeed = seeds.find((seed) => seed.active);
    const activeRun = activeSeed ? runByLabel.get(activeSeed.label) : undefined;

    if (activeRun) {
      const runsToDeactivate = runs.filter(
        (run) => run.id !== activeRun.id && run.isActive,
      );

      if (runsToDeactivate.length > 0) {
        runsToDeactivate.forEach((run) => {
          run.isActive = false;
        });
        await this.courseRunRepository.save(runsToDeactivate);
      }

      if (!activeRun.isActive) {
        activeRun.isActive = true;
        await this.courseRunRepository.save(activeRun);
      }
    }

    return runByLabel;
  }

  private async upsertDemoEnrollment(
    course: Course,
    courseRun: CourseRun,
    userId: string,
    role: CourseMemberRole,
  ): Promise<Enrollment> {
    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: {
        courseId: course.id,
        courseRunId: courseRun.id,
        userId,
      },
    });

    if (existingEnrollment) {
      return existingEnrollment;
    }

    const legacyEnrollment = await this.enrollmentRepository.findOne({
      where: {
        courseId: course.id,
        userId,
      },
    });

    if (legacyEnrollment && !legacyEnrollment.courseRunId) {
      legacyEnrollment.courseRunId = courseRun.id;
      legacyEnrollment.courseRun = courseRun;
      return this.enrollmentRepository.save(legacyEnrollment);
    }

    const enrollment = new Enrollment();
    enrollment.courseId = course.id;
    enrollment.course = course;
    enrollment.courseRunId = courseRun.id;
    enrollment.courseRun = courseRun;
    enrollment.userId = userId;
    enrollment.createdBy = DEMO_SEED_USER;
    enrollment.role = role;
    enrollment.updatedBy = DEMO_SEED_USER;

    return this.enrollmentRepository.save(enrollment);
  }

  private async upsertDemoVersions(
    course: Course,
    courseRun: CourseRun,
    versions: Array<{
      versionNumber: number;
      changeSummary: string;
      active: boolean;
      content: Record<string, unknown>;
    }>,
  ): Promise<Map<number, CourseVersion>> {
    const existingVersions = await this.courseVersionRepository.find({
      where: {
        course_id: course.id,
      },
    });
    for (const version of existingVersions) {
      if (!version.course_run_id) {
        version.course_run_id = courseRun.id;
        version.courseRun = courseRun;
        await this.courseVersionRepository.save(version);
      }
    }
    const versionsForRun = existingVersions.filter(
      (version) => version.course_run_id === courseRun.id,
    );
    const existingVersionsByNumber = new Map(
      versionsForRun.map((version) => [version.version_number, version]),
    );
    let hasActiveVersion = versionsForRun.some((version) => version.is_active);

    for (const seed of versions) {
      const existingVersion = existingVersionsByNumber.get(seed.versionNumber);

      if (existingVersion) {
        if (existingVersion.created_by === DEMO_SEED_USER) {
          existingVersion.content = await this.buildDemoVersionContent(
            course,
            courseRun,
            seed.content,
          );
          await this.courseVersionRepository.save(existingVersion);
        }
        continue;
      }

      const version = new CourseVersion();
      version.course_id = course.id;
      version.course = course;
      version.course_run_id = courseRun.id;
      version.courseRun = courseRun;
      version.version_number = seed.versionNumber;
      version.label = `Version ${seed.versionNumber}`;
      version.change_summary = seed.changeSummary;
      version.status = CourseVersionStatus.PUBLISHED;
      version.content = await this.buildDemoVersionContent(
        course,
        courseRun,
        seed.content,
      );
      version.created_by = DEMO_SEED_USER;
      version.is_active = seed.active && !hasActiveVersion;

      await this.courseVersionRepository.save(version);
      hasActiveVersion = hasActiveVersion || version.is_active;
      existingVersionsByNumber.set(seed.versionNumber, version);
    }

    return existingVersionsByNumber;
  }

  private async buildDemoVersionContent(
    course: Course,
    courseRun: CourseRun,
    content: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const [materials, taskReferences] = await Promise.all([
      this.learningMaterialRepository.find({
        where: {
          courseId: course.id,
          courseRunId: courseRun.id,
        },
      }),
      this.taskRepository.find({
        where: {
          courseId: course.id,
          courseRunId: courseRun.id,
        },
      }),
    ]);
    const taskContents = await this.loadTaskContents(taskReferences);
    const taskDependencyLists = await Promise.all(
      taskReferences.map((task) =>
        this.taskDependencyRepository.find({
          where: { taskId: task.id },
        }),
      ),
    );
    const dependenciesByTaskId = new Map<string, TaskDependency[]>();

    taskReferences.forEach((task, index) => {
      dependenciesByTaskId.set(task.id, taskDependencyLists[index] ?? []);
    });
    const tasks = taskReferences.map((task) => ({
      reference: task,
      content: taskContents.get(task.externalTaskId),
      dependencies: dependenciesByTaskId.get(task.id) ?? [],
    }));
    const courseOverride =
      content.course && typeof content.course === 'object'
        ? (content.course as Record<string, unknown>)
        : {};

    return {
      ...content,
      course: {
        id: course.id,
        externalId: course.external_id,
        title: course.title,
        description: course.description,
        semester: course.semester,
        status: course.status,
        location: course.location,
        ownerId: course.owner_id,
        ...courseOverride,
      },
      courseRun: {
        id: courseRun.id,
        label: courseRun.label,
        startDate: courseRun.startDate,
        endDate: courseRun.endDate,
        status: courseRun.status,
        isActive: courseRun.isActive,
      },
      learningMaterials: materials
        .filter(
          (material) =>
            material.publicationStatus !== LearningMaterialPublicationStatus.ARCHIVED,
        )
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((material) => ({
          id: material.id,
          title: material.title,
          description: material.description,
          type: material.type,
          url: material.url,
          originalFileName: material.originalFileName,
          mimeType: material.mimeType,
          fileSize: material.fileSize,
          tags: material.tags ?? [],
          sortOrder: material.sortOrder,
          publicationStatus: material.publicationStatus,
          isPublished: material.isPublished,
          releaseMode: material.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE,
          releaseAt: material.releaseAt instanceof Date
            ? material.releaseAt.toISOString()
            : undefined,
          releaseAfterTaskId: material.releaseAfterTaskId,
          publishedAt: material.publishedAt instanceof Date
            ? material.publishedAt.toISOString()
            : undefined,
        })),
      tasks: tasks
        .sort((left, right) => left.reference.order - right.reference.order)
        .map(({ reference, content, dependencies }) => ({
          id: reference.id,
          externalTaskId: reference.externalTaskId,
          title: content?.title ?? 'Aufgabe',
          description: content?.description ?? '',
          type: content?.type ?? 'DEMO_TASK',
          content: content?.content ?? {},
          order: reference.order,
          unlockMode: reference.unlockMode,
          prerequisiteTaskId: reference.prerequisiteTaskId,
          dependencyOperator: dependencies[0]?.operator,
          dependencies: dependencies.map((dependency) => ({
            id: dependency.id,
            prerequisiteTaskId: dependency.prerequisiteTaskId,
            condition: dependency.condition,
            operator: dependency.operator,
          })),
          demoKey: reference.demoKey,
          gradingMode: reference.gradingMode ?? TaskGradingMode.NOT_GRADED,
          workMode: reference.workMode ?? TaskWorkMode.INDIVIDUAL,
          learningPathType: reference.learningPathType ?? TaskLearningPathType.STANDARD,
          maxPoints: reference.maxPoints ?? content?.defaultMaxScore ?? null,
          passThreshold: reference.passThreshold ?? content?.defaultPassThreshold ?? null,
          feedbackRequired: reference.feedbackRequired === true,
          allowRetries: reference.allowRetries === true,
          isPublished: reference.isPublished,
        })),
    };
  }

  private async upsertDemoTasks(
    course: Course,
    courseRun: CourseRun,
    seeds: DemoTaskSeed[] = demoTaskSeeds,
    courseVersion?: CourseVersion,
  ): Promise<Map<string, Task>> {
    const tasksByDemoKey = new Map<string, Task>();

    for (const seed of seeds) {
      const taskServiceTask = await this.upsertTaskContent({
        id: seed.demoKey,
        title: seed.title,
        description: seed.description,
        type: 'DEMO_TASK',
        content: {
          demo: true,
          assessmentInterface: seed.gradingMode,
        },
        defaultMaxScore: seed.maxPoints ?? null,
        defaultPassThreshold: seed.passThreshold ?? null,
        mockEvaluationMode: seed.gradingMode,
      });
      let task = await this.taskRepository.findOne({
        where: {
          courseId: course.id,
          courseRunId: courseRun.id,
          externalTaskId: seed.demoKey,
        },
      });
      if (!task) {
        const existingRunTasks = await this.taskRepository.find({
          where: {
            courseId: course.id,
            courseRunId: courseRun.id,
          },
        });
        task = existingRunTasks.find((candidate) =>
          candidate.externalTaskId === seed.demoKey || candidate.demoKey === seed.demoKey,
        ) ?? null;
      }

      if (!task) {
        const legacyTasks = await this.taskRepository.find({
          where: {
            courseId: course.id,
          },
        });
        const legacyTask = legacyTasks.find((candidate) =>
          !candidate.courseRunId &&
          (candidate.externalTaskId === seed.demoKey || candidate.demoKey === seed.demoKey),
        ) ?? null;

        if (legacyTask && !legacyTask.courseRunId) {
          legacyTask.courseRunId = courseRun.id;
          legacyTask.courseRun = courseRun;
          task = await this.taskRepository.save(legacyTask);
        }
      }

      if (!task) {
        task = new Task();
        task.courseId = course.id;
        task.course = course;
        task.courseRunId = courseRun.id;
        task.courseRun = courseRun;
        task.externalTaskId = taskServiceTask.id;
        task.createdBy = DEMO_SEED_USER;
      }

      task.externalTaskId = taskServiceTask.id;
      task.courseVersionId = courseVersion?.id;
      task.courseVersion = courseVersion;
      task.title = taskServiceTask.title;
      task.description = taskServiceTask.description;
      task.type = taskServiceTask.type;
      task.content = taskServiceTask.content;
      task.completionCriteria = taskServiceTask.content;
      task.demoKey = seed.demoKey;
      task.order = seed.order;
      task.unlockMode = seed.unlockMode;
      task.prerequisiteTaskId = undefined;
      task.gradingMode = seed.gradingMode;
      task.workMode = seed.workMode ?? TaskWorkMode.INDIVIDUAL;
      task.learningPathType = seed.learningPathType ?? TaskLearningPathType.STANDARD;
      task.maxPoints = seed.maxPoints ?? null;
      task.passThreshold = seed.passThreshold ?? null;
      task.feedbackRequired = seed.feedbackRequired ?? seed.gradingMode === TaskGradingMode.MANUAL;
      task.allowRetries = seed.allowRetries ?? false;
      task.isPublished = true;
      task.updatedBy = DEMO_SEED_USER;

      const savedTask = await this.taskRepository.save(task);
      tasksByDemoKey.set(seed.demoKey, savedTask);
    }

    await this.syncDemoTaskDependencies(seeds, tasksByDemoKey);

    return tasksByDemoKey;
  }

  private async syncDemoTaskDependencies(
    seeds: DemoTaskSeed[],
    tasksByDemoKey: Map<string, Task>,
  ): Promise<void> {
    for (const seed of seeds) {
      const task = tasksByDemoKey.get(seed.demoKey);

      if (!task) {
        continue;
      }

      const dependencySeeds = seed.dependencies ??
        (seed.prerequisiteDemoKey
          ? [{
            prerequisiteDemoKey: seed.prerequisiteDemoKey,
            condition: TaskDependencyCondition.PASSED,
          }]
          : []);
      const operator = seed.dependencyOperator ?? TaskDependencyOperator.ALL_OF;
      const existingDependencies = await this.taskDependencyRepository.find({
        where: { taskId: task.id },
      });
      const desiredPrerequisiteIds = new Set<string>();
      const savedDependencies: TaskDependency[] = [];

      for (const dependencySeed of dependencySeeds) {
        const prerequisiteTask = tasksByDemoKey.get(dependencySeed.prerequisiteDemoKey);

        if (!prerequisiteTask) {
          continue;
        }

        desiredPrerequisiteIds.add(prerequisiteTask.id);
        let dependency = existingDependencies.find(
          (candidate) => candidate.prerequisiteTaskId === prerequisiteTask.id,
        );

        if (!dependency) {
          dependency = new TaskDependency();
          dependency.taskId = task.id;
          dependency.task = task;
          dependency.prerequisiteTaskId = prerequisiteTask.id;
          dependency.prerequisiteTask = prerequisiteTask;
          dependency.createdBy = DEMO_SEED_USER;
        }

        dependency.condition = dependencySeed.condition ?? TaskDependencyCondition.PASSED;
        dependency.operator = operator;
        dependency.updatedBy = DEMO_SEED_USER;
        savedDependencies.push(await this.taskDependencyRepository.save(dependency));
      }

      for (const existingDependency of existingDependencies) {
        if (!desiredPrerequisiteIds.has(existingDependency.prerequisiteTaskId)) {
          await this.taskDependencyRepository.delete(existingDependency.id);
        }
      }

      const firstDependency = savedDependencies[0];

      if (task.prerequisiteTaskId !== firstDependency?.prerequisiteTaskId) {
        task.prerequisiteTaskId = firstDependency?.prerequisiteTaskId;
        await this.taskRepository.save(task);
      }

      task.dependencies = savedDependencies;
    }
  }

  private async upsertDemoGroups(
    course: Course,
    courseRun: CourseRun,
    seed: DemoGroupSeed = {
      name: 'Gruppe A',
      description: 'Demo-Gruppe fuer die gemeinsame manuelle Bewertung.',
      memberIds: [DEMO_STUDENT_ID, DEMO_GROUP_STUDENT_ID],
    },
  ): Promise<CourseGroup> {
    let group = await this.courseGroupRepository.findOne({
      where: {
        course_id: course.id,
        course_run_id: courseRun.id,
        name: seed.name,
      },
      relations: ['memberships'],
    });

    if (!group) {
      group = new CourseGroup();
      group.course_id = course.id;
      group.course = course;
      group.course_run_id = courseRun.id;
      group.courseRun = courseRun;
      group.name = seed.name;
      group.description = seed.description;
      group.group_type = 'WORKGROUP' as any;
      group.is_active = true;
      group.created_by = DEMO_SEED_USER;
      group.updated_by = DEMO_SEED_USER;
      group = await this.courseGroupRepository.save(group);
      group.memberships = [];
    } else if (group.created_by === DEMO_SEED_USER) {
      group.description = seed.description;
      group.updated_by = DEMO_SEED_USER;
      group = await this.courseGroupRepository.save(group);
    }

    for (const studentId of seed.memberIds) {
      const existingMembership = (group.memberships ?? []).find(
        (membership) => membership.user_id === studentId,
      ) ?? await this.groupMembershipRepository.findOne({
        where: {
          group_id: group.id,
          user_id: studentId,
        },
      });

      if (existingMembership) {
        continue;
      }

      const membership = new GroupMembership();
      membership.group_id = group.id;
      membership.group = group;
      membership.user_id = studentId;
      membership.role = MembershipRole.MEMBER;
      membership.joined_at = new Date();
      membership.added_by = DEMO_SEED_USER;
      await this.groupMembershipRepository.save(membership);
    }

    return group;
  }

  private async seedWebTechnologiesProgress(
    course: Course,
    courseRun: CourseRun,
    courseVersion: CourseVersion | undefined,
    enrollments: {
      student: Enrollment;
      groupStudent: Enrollment;
      ungroupedStudent: Enrollment;
    },
    group: CourseGroup,
  ): Promise<void> {
    if (!courseVersion) {
      return;
    }

    const tasks = await this.taskRepository.find({
      where: {
        courseId: course.id,
        courseRunId: courseRun.id,
        courseVersionId: courseVersion.id,
      },
    });
    const tasksByDemoKey = new Map(tasks.map((task) => [task.demoKey, task]));
    const basics = tasksByDemoKey.get('webtech-http-dom-basics');
    const htmlCss = tasksByDemoKey.get('webtech-html-css-page');
    const remedial = tasksByDemoKey.get('webtech-remedial-html-css');
    const javaScript = tasksByDemoKey.get('webtech-js-interaction');
    const project = tasksByDemoKey.get('webtech-team-mini-project');
    const now = new Date('2026-10-20T10:00:00.000Z');

    if (basics) {
      await this.upsertDemoTaskProgress(basics, enrollments.student, {
        status: TaskProgressStatus.COMPLETED,
        completionPercentage: 100,
        unlockSource: TaskUnlockSource.IMMEDIATE,
        startedAt: new Date('2026-10-10T09:00:00.000Z'),
        completedAt: new Date('2026-10-10T09:30:00.000Z'),
        resultPassed: true,
        resultRecordedAt: new Date('2026-10-10T09:30:00.000Z'),
      });
      await this.upsertDemoTaskProgress(basics, enrollments.groupStudent, {
        status: TaskProgressStatus.COMPLETED,
        completionPercentage: 100,
        unlockSource: TaskUnlockSource.IMMEDIATE,
        startedAt: new Date('2026-10-10T09:10:00.000Z'),
        completedAt: new Date('2026-10-10T09:35:00.000Z'),
        resultPassed: true,
        resultRecordedAt: new Date('2026-10-10T09:35:00.000Z'),
      });
      await this.upsertDemoTaskProgress(basics, enrollments.ungroupedStudent, {
        status: TaskProgressStatus.IN_PROGRESS,
        completionPercentage: 40,
        unlockSource: TaskUnlockSource.IMMEDIATE,
        startedAt: new Date('2026-10-12T12:00:00.000Z'),
      });
    }

    if (htmlCss) {
      await this.upsertDemoTaskProgress(htmlCss, enrollments.student, {
        status: TaskProgressStatus.FAILED,
        completionPercentage: 0,
        unlockSource: TaskUnlockSource.AUTOMATIC,
        startedAt: new Date('2026-10-11T13:00:00.000Z'),
        completedAt: new Date('2026-10-12T15:00:00.000Z'),
        resultPassed: false,
        resultRecordedAt: new Date('2026-10-13T08:00:00.000Z'),
      });
      await this.upsertDemoTaskAssessment(htmlCss, courseRun, courseVersion, {
        studentId: enrollments.student.userId,
        status: TaskAssessmentStatus.FAILED,
        points: 4,
        maxPoints: 10,
        passThreshold: 50,
        passed: false,
        feedback:
          'Semantische Struktur ist erkennbar, aber Responsiveness und CSS-Box-Modell bitte wiederholen.',
        submissionData: {
          text: 'Abgabe: Landingpage Version 1',
          link: 'https://example.com/webtech/student-landingpage',
        },
        assessedBy: DEMO_TEACHER_ID,
        assessedAt: new Date('2026-10-13T08:00:00.000Z'),
      });
      await this.upsertDemoTaskProgress(htmlCss, enrollments.groupStudent, {
        status: TaskProgressStatus.COMPLETED,
        completionPercentage: 100,
        unlockSource: TaskUnlockSource.AUTOMATIC,
        startedAt: new Date('2026-10-11T13:10:00.000Z'),
        completedAt: new Date('2026-10-12T14:00:00.000Z'),
        resultPassed: true,
        resultRecordedAt: new Date('2026-10-13T08:20:00.000Z'),
      });
      await this.upsertDemoTaskAssessment(htmlCss, courseRun, courseVersion, {
        studentId: enrollments.groupStudent.userId,
        status: TaskAssessmentStatus.PASSED,
        points: 8,
        maxPoints: 10,
        passThreshold: 50,
        passed: true,
        feedback: 'Saubere Struktur, gute mobile Darstellung.',
        submissionData: {
          text: 'Abgabe: responsive Landingpage',
        },
        assessedBy: DEMO_TEACHER_ID,
        assessedAt: new Date('2026-10-13T08:20:00.000Z'),
      });
    }

    if (remedial) {
      await this.upsertDemoTaskProgress(remedial, enrollments.student, {
        status: TaskProgressStatus.AVAILABLE,
        completionPercentage: 0,
        unlockSource: TaskUnlockSource.AUTOMATIC,
        unlockedAt: now,
      });
    }

    if (javaScript) {
      await this.upsertDemoTaskProgress(javaScript, enrollments.groupStudent, {
        status: TaskProgressStatus.COMPLETED,
        completionPercentage: 100,
        unlockSource: TaskUnlockSource.AUTOMATIC,
        startedAt: new Date('2026-10-14T09:00:00.000Z'),
        completedAt: new Date('2026-10-14T11:00:00.000Z'),
        resultPassed: true,
        resultRecordedAt: new Date('2026-10-14T11:00:00.000Z'),
      });
      await this.upsertDemoTaskAssessment(javaScript, courseRun, courseVersion, {
        studentId: enrollments.groupStudent.userId,
        status: TaskAssessmentStatus.AUTO_EVALUATED,
        points: 7,
        maxPoints: 10,
        passThreshold: 50,
        passed: true,
        feedback: 'Automatische Demo-Bewertung: Interaktion erfolgreich erkannt.',
        submissionData: {
          passed: true,
        },
        assessedBy: 'task-service',
        assessedAt: new Date('2026-10-14T11:00:00.000Z'),
      });
    }

    if (project) {
      await this.upsertDemoGroupTaskProgress(project, courseRun, courseVersion, group, {
        status: TaskProgressStatus.SUBMITTED,
        progressData: {
          link: 'https://example.com/webtech/team-dom',
          note: 'Gruppenabgabe wartet auf Bewertung.',
        },
        startedAt: new Date('2026-10-15T09:00:00.000Z'),
        submittedAt: new Date('2026-10-18T16:00:00.000Z'),
      });
      await this.upsertDemoGroupTaskAssessment(project, courseRun, courseVersion, group, {
        status: TaskAssessmentStatus.PENDING_REVIEW,
        points: null,
        maxPoints: 20,
        passThreshold: 50,
        passed: null,
        feedback: null,
        submissionData: {
          link: 'https://example.com/webtech/team-dom',
          text: 'Mini-Projekt REST-Frontend als Gruppenabgabe.',
        },
      });
    }

    await this.upsertDemoCourseResult(course, enrollments.student, {
      assessmentMode: CourseResultMode.MANUAL,
      pointsAchieved: 14,
      maxPoints: 40,
      percentage: 35,
      manualGrade: 'nicht bestanden',
      passStatus: CoursePassStatus.FAILED,
      source: CourseResultSource.MANUAL_OVERRIDE,
      comment: 'Manuelle Demo-Ueberschreibung nach nicht bestandener HTML/CSS-Aufgabe.',
      gradedBy: DEMO_TEACHER_ID,
      sourceDetails: {
        previousSource: CourseResultSource.AUTOMATIC_CALCULATION,
        reason: 'Demo fuer manuelle Ueberschreibung und Feedbackpfad',
      },
    });
    await this.upsertDemoCourseResult(course, enrollments.groupStudent, {
      assessmentMode: CourseResultMode.AUTOMATIC,
      pointsAchieved: 28,
      maxPoints: 40,
      percentage: 70,
      manualGrade: null,
      passStatus: CoursePassStatus.PASSED,
      source: CourseResultSource.AUTOMATIC_CALCULATION,
      comment: null,
      gradedBy: 'task-service',
      sourceDetails: {
        rule: 'Mehr als 50 Prozent der maximal erreichbaren Gesamtpunktzahl gelten als bestanden.',
        calculatedFrom: 'Demo-Aufgabenpunkte im Course Service',
      },
    });
  }

  private async upsertDemoTaskProgress(
    task: Task,
    enrollment: Enrollment,
    seed: Partial<TaskProgress>,
  ): Promise<TaskProgress> {
    let progress = await this.taskProgressRepository.findOne({
      where: {
        taskId: task.id,
        enrollmentId: enrollment.id,
      },
    });

    if (!progress) {
      progress = new TaskProgress();
      progress.taskId = task.id;
      progress.task = task;
      progress.enrollmentId = enrollment.id;
      progress.enrollment = enrollment;
      progress.createdBy = DEMO_SEED_USER;
    }

    progress.status = seed.status ?? TaskProgressStatus.LOCKED;
    progress.completionPercentage = seed.completionPercentage ?? 0;
    progress.progressData = seed.progressData ?? progress.progressData;
    progress.unlockedAt = seed.unlockedAt ?? progress.unlockedAt;
    progress.unlockSource = seed.unlockSource ?? progress.unlockSource;
    progress.startedAt = seed.startedAt ?? progress.startedAt;
    progress.completedAt = seed.completedAt ?? progress.completedAt;
    progress.resultPassed = seed.resultPassed;
    progress.resultRecordedAt = seed.resultRecordedAt ?? progress.resultRecordedAt;
    progress.updatedBy = DEMO_SEED_USER;

    return this.taskProgressRepository.save(progress);
  }

  private async upsertDemoTaskAssessment(
    task: Task,
    courseRun: CourseRun,
    courseVersion: CourseVersion,
    seed: Partial<TaskAssessment> & { studentId: string },
  ): Promise<TaskAssessment> {
    let assessment = await this.taskAssessmentRepository.findOne({
      where: {
        courseRunId: courseRun.id,
        taskId: task.id,
        studentId: seed.studentId,
      },
    });

    if (!assessment) {
      assessment = new TaskAssessment();
      assessment.courseRunId = courseRun.id;
      assessment.courseRun = courseRun;
      assessment.courseVersionId = courseVersion.id;
      assessment.courseVersion = courseVersion;
      assessment.taskId = task.id;
      assessment.task = task;
      assessment.assessmentTargetType = TaskAssessmentTargetType.INDIVIDUAL;
      assessment.studentId = seed.studentId;
    }

    assessment.gradingMode = task.gradingMode;
    assessment.status = seed.status ?? TaskAssessmentStatus.NOT_SUBMITTED;
    assessment.points = seed.points;
    assessment.maxPoints = seed.maxPoints;
    assessment.passThreshold = seed.passThreshold;
    assessment.passed = seed.passed;
    assessment.feedback = seed.feedback;
    assessment.submissionData = seed.submissionData;
    assessment.assessedBy = seed.assessedBy;
    assessment.assessedAt = seed.assessedAt;

    return this.taskAssessmentRepository.save(assessment);
  }

  private async upsertDemoGroupTaskProgress(
    task: Task,
    courseRun: CourseRun,
    courseVersion: CourseVersion,
    group: CourseGroup,
    seed: Partial<GroupTaskProgress>,
  ): Promise<GroupTaskProgress> {
    let progress = await this.groupTaskProgressRepository.findOne({
      where: {
        courseRunId: courseRun.id,
        taskId: task.id,
        groupId: group.id,
      },
    });

    if (!progress) {
      progress = new GroupTaskProgress();
      progress.courseRunId = courseRun.id;
      progress.courseRun = courseRun;
      progress.courseVersionId = courseVersion.id;
      progress.courseVersion = courseVersion;
      progress.taskId = task.id;
      progress.task = task;
      progress.groupId = group.id;
      progress.group = group;
      progress.createdBy = DEMO_SEED_USER;
    }

    progress.status = seed.status ?? TaskProgressStatus.AVAILABLE;
    progress.progressData = seed.progressData;
    progress.startedAt = seed.startedAt;
    progress.submittedAt = seed.submittedAt;
    progress.completedAt = seed.completedAt;
    progress.updatedBy = DEMO_SEED_USER;

    return this.groupTaskProgressRepository.save(progress);
  }

  private async upsertDemoGroupTaskAssessment(
    task: Task,
    courseRun: CourseRun,
    courseVersion: CourseVersion,
    group: CourseGroup,
    seed: Partial<TaskAssessment>,
  ): Promise<TaskAssessment> {
    let assessment = await this.taskAssessmentRepository.findOne({
      where: {
        courseRunId: courseRun.id,
        taskId: task.id,
        groupId: group.id,
      },
    });

    if (!assessment) {
      assessment = new TaskAssessment();
      assessment.courseRunId = courseRun.id;
      assessment.courseRun = courseRun;
      assessment.courseVersionId = courseVersion.id;
      assessment.courseVersion = courseVersion;
      assessment.taskId = task.id;
      assessment.task = task;
      assessment.assessmentTargetType = TaskAssessmentTargetType.GROUP;
      assessment.groupId = group.id;
      assessment.group = group;
    }

    assessment.gradingMode = task.gradingMode;
    assessment.status = seed.status ?? TaskAssessmentStatus.NOT_SUBMITTED;
    assessment.points = seed.points;
    assessment.maxPoints = seed.maxPoints;
    assessment.passThreshold = seed.passThreshold;
    assessment.passed = seed.passed;
    assessment.feedback = seed.feedback;
    assessment.submissionData = seed.submissionData;
    assessment.assessedBy = seed.assessedBy;
    assessment.assessedAt = seed.assessedAt;

    return this.taskAssessmentRepository.save(assessment);
  }

  private async upsertDemoCourseResult(
    course: Course,
    enrollment: Enrollment,
    seed: Partial<CourseResult> & {
      assessmentMode: CourseResultMode;
      passStatus: CoursePassStatus;
      source: CourseResultSource;
    },
  ): Promise<CourseResult> {
    let result = await this.courseResultRepository.findOne({
      where: {
        courseId: course.id,
        enrollmentId: enrollment.id,
      },
    });

    if (result && result.createdBy !== DEMO_SEED_USER) {
      return result;
    }

    if (!result) {
      result = new CourseResult();
      result.courseId = course.id;
      result.course = course;
      result.enrollmentId = enrollment.id;
      result.enrollment = enrollment;
      result.studentId = enrollment.userId;
      result.createdBy = DEMO_SEED_USER;
    }

    result.courseRunId = enrollment.courseRunId;
    result.assessmentMode = seed.assessmentMode;
    result.pointsAchieved = seed.pointsAchieved;
    result.maxPoints = seed.maxPoints;
    result.percentage = seed.percentage;
    result.manualGrade = seed.manualGrade;
    result.passStatus = seed.passStatus;
    result.source = seed.source;
    result.comment = seed.comment;
    result.gradedBy = seed.gradedBy;
    result.gradedAt = seed.gradedAt ?? new Date('2026-10-20T10:00:00.000Z');
    result.sourceDetails = seed.sourceDetails;
    result.updatedBy = DEMO_SEED_USER;

    return this.courseResultRepository.save(result);
  }

  private async upsertDemoMaterials(
    course: Course,
    courseRun: CourseRun,
    seeds: DemoMaterialSeed[],
    courseVersion?: CourseVersion,
  ): Promise<void> {
    const tasks = await this.taskRepository.find({
      where: {
        courseId: course.id,
        courseRunId: courseRun.id,
      },
    });
    const tasksByDemoKey = new Map(tasks.map((task) => [task.externalTaskId, task]));

    for (const seed of seeds) {
      const existingMaterial = await this.learningMaterialRepository.findOne({
        where: {
          courseId: course.id,
          courseRunId: courseRun.id,
          title: seed.title,
        },
      });

      if (existingMaterial && existingMaterial.createdBy !== DEMO_SEED_USER) {
        continue;
      }

      const material = existingMaterial ?? new LearningMaterial();
      material.courseId = course.id;
      material.course = course;
      material.courseRunId = courseRun.id;
      material.courseRun = courseRun;
      material.courseVersionId = courseVersion?.id;
      material.courseVersion = courseVersion;
      material.title = seed.title;
      material.description = seed.description;
      material.type = seed.type ?? LearningMaterialType.EXTERNAL_LINK;
      material.url = material.type === LearningMaterialType.EXTERNAL_LINK ? seed.url : undefined;
      material.tags = seed.tags;
      material.sortOrder = seed.sortOrder;
      material.publicationStatus = LearningMaterialPublicationStatus.PUBLISHED;
      material.isPublished = true;
      material.publishedAt = new Date();
      material.previewMetadata = seed.previewMetadata;
      material.releaseMode = seed.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE;
      material.releaseAt = seed.releaseAt;
      material.releaseAfterTaskId = seed.releaseAfterDemoKey
        ? tasksByDemoKey.get(seed.releaseAfterDemoKey)?.id
        : null;
      material.createdBy = material.createdBy ?? DEMO_SEED_USER;
      material.updatedBy = DEMO_SEED_USER;

      if (material.type !== LearningMaterialType.EXTERNAL_LINK && !material.storageKey) {
        const fileContent = Buffer.from(
          seed.fileContent ?? `Demo-Datei: ${seed.title}\n`,
          'utf8',
        );
        const storedFile = await this.materialStorage.saveFile(
          course.id,
          seed.originalFileName ?? `${seed.title}.txt`,
          fileContent,
        );

        material.originalFileName = storedFile.safeFileName;
        material.storageKey = storedFile.storageKey;
        material.filePath = storedFile.storageKey;
        material.mimeType = seed.mimeType ?? 'text/plain';
        material.fileSize = fileContent.byteLength;
      }

      await this.learningMaterialRepository.save(material);
    }
  }
}

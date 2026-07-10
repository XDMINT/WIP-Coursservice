import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Course, CourseStatus } from './entities/course.entity';
import { CourseMemberRole, Enrollment } from './entities/enrollment.entity';
import { Task, TaskUnlockMode } from './entities/task.entity';

const DEMO_COURSE_EXTERNAL_ID = 'demo-learning-process';
const DEMO_TEACHER_ID = '1';
const DEMO_STUDENT_ID = '3';
const DEMO_SEED_USER = 'demo-seed';

type DemoTaskSeed = {
  demoKey: string;
  title: string;
  description: string;
  order: number;
  unlockMode: TaskUnlockMode;
  prerequisiteDemoKey?: string;
};

const demoTaskSeeds: DemoTaskSeed[] = [
  {
    demoKey: 'learning-process-basics',
    title: 'Grundlagen kennenlernen',
    description: 'Ein kurzer einführender Lernschritt für den Demo-Ablauf.',
    order: 1,
    unlockMode: TaskUnlockMode.IMMEDIATE,
  },
  {
    demoKey: 'learning-process-apply-basics',
    title: 'Grundlagen anwenden',
    description: 'Ein auf Aufgabe 1 aufbauender Lernschritt mit automatischer Freischaltung.',
    order: 2,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    prerequisiteDemoKey: 'learning-process-basics',
  },
  {
    demoKey: 'learning-process-final-task',
    title: 'Abschlussaufgabe bearbeiten',
    description: 'Ein abschließender Lernschritt, der durch eine Lehrperson manuell freigeschaltet wird.',
    order: 3,
    unlockMode: TaskUnlockMode.MANUAL,
    prerequisiteDemoKey: 'learning-process-apply-basics',
  },
];

const parseBoolean = (value?: string): boolean =>
  value != null && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

@Injectable()
export class CourseDemoSeedService implements OnApplicationBootstrap {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.shouldSeedDemoData()) {
      return;
    }

    await this.seedLearningProcessDemo();
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
    await this.upsertDemoEnrollment(course, DEMO_TEACHER_ID, CourseMemberRole.TEACHER);
    await this.upsertDemoEnrollment(course, DEMO_STUDENT_ID, CourseMemberRole.STUDENT);
    await this.upsertDemoTasks(course);
  }

  private async upsertDemoCourse(): Promise<Course> {
    let course = await this.courseRepository.findOne({
      where: { external_id: DEMO_COURSE_EXTERNAL_ID },
    });

    if (!course) {
      course = new Course();
      course.external_id = DEMO_COURSE_EXTERNAL_ID;
      course.created_by = DEMO_SEED_USER;
    }

    course.title = 'Demo-Kurs Lernprozess';
    course.description = 'Deterministischer Demo-Kurs für Aufgaben, Fortschritt und Freischaltlogik.';
    course.semester = 'Demo';
    course.status = CourseStatus.PUBLISHED;
    course.location = 'Demo';
    course.owner_id = Number(DEMO_TEACHER_ID);
    course.updated_by = DEMO_SEED_USER;

    return this.courseRepository.save(course);
  }

  private async upsertDemoEnrollment(
    course: Course,
    userId: string,
    role: CourseMemberRole,
  ): Promise<Enrollment> {
    let enrollment = await this.enrollmentRepository.findOne({
      where: {
        courseId: course.id,
        userId,
      },
    });

    if (!enrollment) {
      enrollment = new Enrollment();
      enrollment.courseId = course.id;
      enrollment.course = course;
      enrollment.userId = userId;
      enrollment.createdBy = DEMO_SEED_USER;
    }

    enrollment.role = role;
    enrollment.updatedBy = DEMO_SEED_USER;

    return this.enrollmentRepository.save(enrollment);
  }

  private async upsertDemoTasks(course: Course): Promise<void> {
    const tasksByDemoKey = new Map<string, Task>();

    for (const seed of demoTaskSeeds) {
      let task = await this.taskRepository.findOne({
        where: {
          courseId: course.id,
          demoKey: seed.demoKey,
        },
      });

      if (!task) {
        task = new Task();
        task.courseId = course.id;
        task.course = course;
        task.demoKey = seed.demoKey;
        task.createdBy = DEMO_SEED_USER;
      }

      task.title = seed.title;
      task.description = seed.description;
      task.type = 'DEMO_TASK';
      task.order = seed.order;
      task.unlockMode = seed.unlockMode;
      task.prerequisiteTaskId = seed.prerequisiteDemoKey
        ? tasksByDemoKey.get(seed.prerequisiteDemoKey)?.id
        : undefined;
      task.completionCriteria = {
        demo: true,
        resultInterface: 'recordTaskResult(studentId, taskId, passed)',
      };
      task.isPublished = true;
      task.updatedBy = DEMO_SEED_USER;

      const savedTask = await this.taskRepository.save(task);
      tasksByDemoKey.set(seed.demoKey, savedTask);
    }
  }
}

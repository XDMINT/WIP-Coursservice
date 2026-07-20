import { IsNull, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import { ApiNotFoundError } from '../common/api-errors';
import { CoursePermission } from '../courses.permissions';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { Course } from '../entities/course.entity';

type CourseServiceFacade = any;

export class CalendarEventService {
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

  private async findEventWithCourseOrThrow(id: string): Promise<CalendarEvent> {
    const event = await this.calendarEventRepository.findOne({
      where: { id },
      relations: ['course'],
    });

    if (!event?.course?.id) {
      throw new ApiNotFoundError('Calendar event not found');
    }

    return event;
  }

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
    actorUserId?: string | number,
  ): Promise<CalendarEvent> {
    const actorId = await this.assertCourseManageable(courseId, actorUserId);
    const creatorId = actorId ?? createdBy;
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
    event.createdBy = creatorId;
    event.updatedBy = creatorId;

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
    actorUserId?: string | number,
  ): Promise<CalendarEvent[]> {
    await this.assertCourseReadable(courseId, actorUserId);

    return this.calendarEventRepository.find({
      where: {
        course: { id: courseId },
        startTime: LessThanOrEqual(endDate),
        endTime: MoreThanOrEqual(startDate),
      },
      order: { startTime: 'ASC' },
    });
  }

  async getCalendarEventById(
    id: string,
    actorUserId?: string | number,
  ): Promise<CalendarEvent> {
    const event = await this.findEventWithCourseOrThrow(id);
    await this.assertCourseReadable(event.course.id, actorUserId);

    return event;
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
    actorUserId?: string | number,
  ): Promise<CalendarEvent> {
    const event = await this.findEventWithCourseOrThrow(id);
    const actorId = await this.assertCourseManageable(event.course.id, actorUserId);

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
    event.updatedBy = actorId ?? updatedBy;

    return this.calendarEventRepository.save(event);
  }

  async deleteCalendarEvent(
    id: string,
    actorUserId?: string | number,
  ): Promise<void> {
    const event = await this.findEventWithCourseOrThrow(id);
    await this.assertCourseManageable(event.course.id, actorUserId);

    await this.calendarEventRepository.delete(id);
  }

  async createAssignmentDueDateEvents(
    courseId: string,
    createdBy: string,
    actorUserId?: string | number,
  ): Promise<CalendarEvent[]> {
    const actorId = await this.assertCourseManageable(courseId, actorUserId);
    const creatorId = actorId ?? createdBy;
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
          creatorId,
        );
        createdEvents.push(event);
      }
    }

    return createdEvents;
  }

  async getUpcomingEvents(
    courseId: string,
    limit: number = 5,
    actorUserId?: string | number,
  ): Promise<CalendarEvent[]> {
    await this.assertCourseReadable(courseId, actorUserId);

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
    actorUserId?: string | number,
  ): Promise<CalendarEvent[]> {
    await this.assertCourseReadable(courseId, actorUserId);

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
    actorUserId?: string | number,
  ): Promise<CalendarEvent[]> {
    await this.assertCourseReadable(courseId, actorUserId);

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
    actorUserId?: string | number,
  ): Promise<CalendarEvent[]> {
    await this.assertCourseReadable(courseId, actorUserId);

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
    actorUserId?: string | number,
  ): Promise<{ created: CalendarEvent[]; deleted: number }> {
    const actorId = await this.assertCourseManageable(courseId, actorUserId);
    const creatorId = actorId ?? createdBy;

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
            creatorId,
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

/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CourseStatus } from './CourseStatus';
export type CourseDto = {
    /**
     * Unique identifier of the course.
     */
    readonly id: string;
    /**
     * Optional external identifier, e.g. from another system.
     */
    externalId?: string | null;
    /**
     * ID of the user who owns the course.
     */
    readonly ownerId?: string;
    /**
     * Title of the course.
     */
    title: string;
    /**
     * Optional course description.
     */
    description?: string | null;
    /**
     * Semester or internal semester reference.
     */
    semester: string;
    status: CourseStatus;
    readonly createdAt: string;
    readonly updatedAt: string;
};


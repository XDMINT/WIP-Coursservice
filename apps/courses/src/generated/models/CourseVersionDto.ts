/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CourseVersionDto = {
    /**
     * Date and time when the version was created.
     */
    readonly createdAt: string;
    /**
     * ID of the user who created the version.
     */
    readonly createdBy: string;
    /**
     * Content of the course version.
     */
    content: string;
    /**
     * Version number of the course.
     */
    version_number: number;
    /**
     * Whether the version is currently active.
     */
    is_active: boolean;
    /**
     * Unique identifier of the course version.
     */
    readonly id: string;
    /**
     * ID of the course the version belongs to.
     */
    readonly courseId: string;
};


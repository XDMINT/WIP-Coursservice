/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EnrollmentRole } from './EnrollmentRole';
export type EnrollmentDto = {
    /**
     * Unique identifier of the enrollment.
     */
    readonly id: string;
    /**
     * ID of the course the enrollment belongs to.
     */
    readonly courseId: string;
    /**
     * ReferenceId of the userMember
     */
    userId: string;
    role: EnrollmentRole;
    readonly enrolled_at: string;
};


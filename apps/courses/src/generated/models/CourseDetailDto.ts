/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CourseDto } from './CourseDto';
import type { CourseVersionDto } from './CourseVersionDto';
import type { EnrollmentDto } from './EnrollmentDto';
import type { GroupDto } from './GroupDto';
export type CourseDetailDto = {
    course: CourseDto;
    versions: Array<CourseVersionDto>;
    enrollments: Array<EnrollmentDto>;
    groups: Array<GroupDto>;
};


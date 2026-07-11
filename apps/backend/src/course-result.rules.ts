import { CoursePassStatus } from './entities/course-result.entity';

export const COURSE_PASSING_THRESHOLD_PERCENT = 50;

export const COURSE_PASSING_RULE_DESCRIPTION =
  'Mehr als 50 Prozent der maximal erreichbaren Gesamtpunktzahl gelten als bestanden.';

export const calculateCoursePassStatus = (
  percentage: number | null | undefined,
): CoursePassStatus => {
  if (percentage === null || percentage === undefined) {
    return CoursePassStatus.NOT_ASSESSED;
  }

  return percentage > COURSE_PASSING_THRESHOLD_PERCENT
    ? CoursePassStatus.PASSED
    : CoursePassStatus.FAILED;
};

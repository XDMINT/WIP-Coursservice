import { CourseGroup } from '../entities/course-group.entity';
import { GroupMembership, MembershipRole } from '../entities/group-membership.entity';
import { GroupTaskProgress } from '../entities/group-task-progress.entity';
import { TaskAssessment } from '../entities/task-assessment.entity';
import { TaskProgressStatus } from '../entities/task-progress.entity';
import { mapTaskAssessmentToDto, TaskAssessmentResponseDto } from './learning-process.dto';

export type CreateStudyGroupDto = {
  name?: string;
  description?: string | null;
};

export type UpdateStudyGroupDto = Partial<CreateStudyGroupDto>;

export type AddStudyGroupMemberDto = {
  studentId?: string | number;
};

export type ManualGroupTaskAssessmentDto = {
  points?: number | string | null;
  maxPoints?: number | string | null;
  passed?: boolean;
  feedback?: string | null;
};

export type StudyGroupMemberDto = {
  studentId: string;
  role: MembershipRole;
  joinedAt?: string | null;
};

export type StudyGroupTaskProgressDto = {
  id: string;
  taskId: string;
  groupId: string;
  status: TaskProgressStatus;
  startedAt?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  assessment?: TaskAssessmentResponseDto | null;
};

export type StudyGroupResponseDto = {
  id: string;
  courseId: string;
  courseRunId?: string | null;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  members: StudyGroupMemberDto[];
  memberCount: number;
  taskProgress?: StudyGroupTaskProgressDto[];
};

const toIsoString = (value?: Date | null): string | undefined =>
  value instanceof Date ? value.toISOString() : undefined;

export const mapStudyGroupMemberToDto = (
  membership: GroupMembership,
): StudyGroupMemberDto => ({
  studentId: membership.user_id,
  role: membership.role ?? MembershipRole.MEMBER,
  joinedAt: toIsoString(membership.joined_at),
});

export const mapGroupTaskProgressToDto = (
  progress: GroupTaskProgress,
  assessment?: TaskAssessment | null,
): StudyGroupTaskProgressDto => ({
  id: progress.id,
  taskId: progress.taskId,
  groupId: progress.groupId,
  status: progress.status,
  startedAt: toIsoString(progress.startedAt),
  submittedAt: toIsoString(progress.submittedAt),
  completedAt: toIsoString(progress.completedAt),
  assessment: assessment ? mapTaskAssessmentToDto(assessment) : null,
});

export const mapStudyGroupToDto = (
  group: CourseGroup,
  taskProgress: StudyGroupTaskProgressDto[] = [],
): StudyGroupResponseDto => ({
  id: group.id,
  courseId: group.course_id,
  courseRunId: group.course_run_id,
  name: group.name,
  description: group.description,
  isActive: group.is_active,
  createdBy: group.created_by,
  createdAt: toIsoString(group.created_at),
  updatedAt: toIsoString(group.updated_at),
  members: (group.memberships ?? []).map(mapStudyGroupMemberToDto),
  memberCount: group.memberships?.length ?? 0,
  taskProgress,
});

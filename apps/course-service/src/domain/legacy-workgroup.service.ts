import { CourseGroup } from '../entities/course-group.entity';
import { CourseMemberRole } from '../entities/enrollment.entity';
import { GroupMembership } from '../entities/group-membership.entity';

type CourseServiceFacade = any;

export class LegacyWorkgroupService {
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

  async createCourseGroup(
    courseId: string,
    name: string,
    description: string,
    groupType: string,
    createdBy: string,
  ): Promise<CourseGroup> {
    const group = new CourseGroup();
    group.course_id = courseId;
    group.name = name;
    group.description = description;
    group.group_type = groupType as any;
    group.created_by = createdBy;
    group.updated_by = createdBy;

    return this.courseGroupRepository.save(group);
  }

  async getCourseGroupsByCourse(courseId: string): Promise<CourseGroup[]> {
    return this.courseGroupRepository.find({
      where: { course_id: courseId },
      relations: ['memberships'],
    });
  }

  async getCourseGroupById(id: string): Promise<CourseGroup> {
    return this.courseGroupRepository.findOne({
      where: { id },
      relations: ['memberships'],
    });
  }

  async updateCourseGroup(
    id: string,
    name: string,
    description: string,
    groupType: string,
    isActive: boolean,
    groupGrade: number,
    groupFeedback: string,
    updatedBy: string,
  ): Promise<CourseGroup> {
    const group = await this.courseGroupRepository.findOne({
      where: { id },
    });

    if (!group) {
      throw new Error('Course group not found');
    }

    group.name = name;
    group.description = description;
    group.group_type = groupType as any;
    group.is_active = isActive;
    group.group_grade = groupGrade;
    group.group_feedback = groupFeedback;
    group.updated_by = updatedBy;

    return this.courseGroupRepository.save(group);
  }

  async deleteCourseGroup(id: string): Promise<void> {
    await this.courseGroupRepository.delete(id);
  }

  async addMemberToGroup(
    groupId: string,
    userId: string,
    role: string,
    addedBy: string,
  ): Promise<GroupMembership> {
    const membership = new GroupMembership();
    membership.group_id = groupId;
    membership.user_id = userId;
    membership.role = role as any;
    membership.joined_at = new Date();
    membership.added_by = addedBy;

    return this.groupMembershipRepository.save(membership);
  }

  async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    await this.groupMembershipRepository.delete({
      group_id: groupId,
      user_id: userId,
    });
  }

  async updateGroupMembershipRole(
    groupId: string,
    userId: string,
    role: string,
  ): Promise<GroupMembership> {
    const membership = await this.groupMembershipRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });

    if (!membership) {
      throw new Error('Group membership not found');
    }

    membership.role = role as any;

    return this.groupMembershipRepository.save(membership);
  }

  async getGroupMembers(groupId: string): Promise<GroupMembership[]> {
    return this.groupMembershipRepository.find({
      where: { group_id: groupId },
    });
  }

  async getGroupsForUser(courseId: string, userId: string): Promise<CourseGroup[]> {
    const memberships = await this.groupMembershipRepository.find({
      where: { user_id: userId },
      relations: ['group'],
    });

    return memberships
      .map(m => m.group)
      .filter(group => group.course_id === courseId);
  }

  async getGroupMembership(
    groupId: string,
    userId: string,
  ): Promise<GroupMembership> {
    return this.groupMembershipRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });
  }

  async assignGroupGrade(
    groupId: string,
    grade: number,
    feedback: string,
    updatedBy: string,
  ): Promise<CourseGroup> {
    const group = await this.courseGroupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    group.group_grade = grade;
    group.group_feedback = feedback;
    group.updated_by = updatedBy;

    return this.courseGroupRepository.save(group);
  }

  async assignIndividualGrade(
    groupId: string,
    userId: string,
    grade: number,
    feedback: string,
  ): Promise<GroupMembership> {
    const membership = await this.groupMembershipRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });

    if (!membership) {
      throw new Error('Group membership not found');
    }

    membership.individual_grade = grade;
    membership.individual_feedback = feedback;

    return this.groupMembershipRepository.save(membership);
  }

  async getGroupPerformance(groupId: string): Promise<any> {
    const group = await this.courseGroupRepository.findOne({
      where: { id: groupId },
      relations: ['memberships'],
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const members = group.memberships || [];
    
    const individualGrades = members
      .filter(m => m.individual_grade !== null && m.individual_grade !== undefined)
      .map(m => m.individual_grade);

    const averageGrade =
      individualGrades.length > 0
        ? individualGrades.reduce((sum, grade) => sum + grade, 0) /
          individualGrades.length
        : 0;

    return {
      groupId: group.id,
      groupName: group.name,
      groupGrade: group.group_grade,
      groupFeedback: group.group_feedback,
      averageIndividualGrade: averageGrade,
      memberCount: members.length,
      membersWithGrades: individualGrades.length,
      memberPerformance: members.map(m => ({
        userId: m.user_id,
        role: m.role,
        individualGrade: m.individual_grade,
        individualFeedback: m.individual_feedback,
      })),
    };
  }

  async autoCreateWorkgroups(
    courseId: string,
    groupSize: number,
    groupPrefix: string,
    createdBy: string,
  ): Promise<CourseGroup[]> {
    // Get all enrollments for the course
    const enrollments = await this.enrollmentRepository.find({
      where: { courseId: courseId },
    });

    const studentEnrollments = enrollments.filter(
      e => e.role === CourseMemberRole.STUDENT,
    );

    const createdGroups = [];

    // Create groups with the specified size
    for (let i = 0; i < studentEnrollments.length; i += groupSize) {
      const groupNumber = Math.floor(i / groupSize) + 1;
      const groupName = `${groupPrefix} ${groupNumber}`;

      const group = await this.createCourseGroup(
        courseId,
        groupName,
        `Auto-created workgroup ${groupNumber}`,
        'WORKGROUP',
        createdBy,
      );

      // Add members to the group
      const groupMembers = studentEnrollments.slice(i, i + groupSize);
      for (const member of groupMembers) {
        await this.addMemberToGroup(
          group.id,
          member.userId,
          'MEMBER',
          createdBy,
        );
      }

      // Assign the first member as leader
      if (groupMembers.length > 0) {
        await this.updateGroupMembershipRole(
          group.id,
          groupMembers[0].userId,
          'LEADER',
        );
      }

      createdGroups.push(group);
    }

    return createdGroups;
  }

  async getGroupLearningProgress(
    groupId: string,
    courseId: string,
  ): Promise<any> {
    const group = await this.courseGroupRepository.findOne({
      where: { id: groupId },
      relations: ['memberships'],
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const memberProgress = [];

    for (const membership of group.memberships) {
      try {
        const progress = await this.getLearningPathProgress(
          courseId,
          membership.user_id,
        );
        
        memberProgress.push({
          userId: membership.user_id,
          role: membership.role,
          ...progress,
        });
      } catch (error) {
        memberProgress.push({
          userId: membership.user_id,
          role: membership.role,
          error: error.message,
        });
      }
    }

    // Calculate average progress
    const validProgresses = memberProgress.filter(
      p => p.progressPercentage !== undefined,
    );
    const averageProgress =
      validProgresses.length > 0
        ? validProgresses.reduce(
            (sum, p) => sum + p.progressPercentage,
            0,
          ) / validProgresses.length
        : 0;

    return {
      groupId: group.id,
      groupName: group.name,
      averageProgress,
      memberCount: group.memberships.length,
      membersWithProgress: validProgresses.length,
      memberProgress,
    };
  }
}

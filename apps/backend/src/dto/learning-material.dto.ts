import {
  LearningMaterial,
  LearningMaterialPublicationStatus,
  LearningMaterialReleaseMode,
  LearningMaterialType,
} from '../entities/learning-material.entity';

export type LearningMaterialResponseDto = {
  id: string;
  courseId: string;
  courseRunId?: string;
  courseVersionId?: string;
  title: string;
  description?: string;
  type: LearningMaterialType;
  url?: string;
  originalFileName?: string;
  mimeType?: string;
  fileSize?: number;
  previewMetadata?: Record<string, unknown>;
  tags: string[];
  sortOrder: number;
  publicationStatus: LearningMaterialPublicationStatus;
  isPublished: boolean;
  releaseMode: LearningMaterialReleaseMode;
  releaseAt?: string;
  releaseAfterTaskId?: string | null;
  releaseAfterTaskTitle?: string;
  visibleForStudents: boolean;
  locked: boolean;
  lockedReason?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
};

export type CreateExternalLearningMaterialDto = {
  title?: string;
  description?: string;
  type?: LearningMaterialType | string;
  url?: string;
  previewMetadata?: Record<string, unknown> | string;
  tags?: string[] | string;
  sortOrder?: number | string;
  releaseMode?: LearningMaterialReleaseMode | string;
  releaseAt?: string | Date | null;
  releaseAfterTaskId?: string | null;
};

export type UpdateLearningMaterialDto = {
  title?: string;
  description?: string;
  type?: LearningMaterialType | string;
  url?: string;
  previewMetadata?: Record<string, unknown> | string | null;
  tags?: string[] | string;
  sortOrder?: number | string;
  releaseMode?: LearningMaterialReleaseMode | string;
  releaseAt?: string | Date | null;
  releaseAfterTaskId?: string | null;
};

export type UpdateLearningMaterialSortDto = {
  items?: Array<{
    id?: string;
    sortOrder?: number;
  }>;
};

const toIsoString = (value?: Date): string | undefined =>
  value instanceof Date ? value.toISOString() : undefined;

export const mapLearningMaterialToDto = (
  material: LearningMaterial,
  visibility: Partial<Pick<LearningMaterialResponseDto, 'locked' | 'lockedReason' | 'releaseAfterTaskTitle' | 'visibleForStudents'>> = {},
): LearningMaterialResponseDto => ({
  id: material.id,
  courseId: material.courseId,
  courseRunId: material.courseRunId,
  courseVersionId: material.courseVersionId,
  title: material.title,
  description: material.description,
  type: material.type,
  url: visibility.locked ? undefined : material.url,
  originalFileName: material.originalFileName,
  mimeType: material.mimeType,
  fileSize:
    material.fileSize === undefined || material.fileSize === null
      ? undefined
      : Number(material.fileSize),
  previewMetadata: material.previewMetadata,
  tags: Array.isArray(material.tags) ? material.tags : [],
  sortOrder: material.sortOrder ?? 0,
  publicationStatus: material.publicationStatus,
  isPublished:
    material.publicationStatus === LearningMaterialPublicationStatus.PUBLISHED,
  releaseMode: material.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE,
  releaseAt: toIsoString(material.releaseAt ?? undefined),
  releaseAfterTaskId: material.releaseAfterTaskId,
  releaseAfterTaskTitle: visibility.releaseAfterTaskTitle,
  visibleForStudents: visibility.visibleForStudents ?? true,
  locked: visibility.locked ?? false,
  lockedReason: visibility.lockedReason,
  createdBy: material.createdBy,
  createdAt: toIsoString(material.createdAt),
  updatedAt: toIsoString(material.updatedAt),
  publishedAt: toIsoString(material.publishedAt),
});

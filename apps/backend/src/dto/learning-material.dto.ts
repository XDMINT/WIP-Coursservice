import {
  LearningMaterial,
  LearningMaterialPublicationStatus,
  LearningMaterialType,
} from '../entities/learning-material.entity';

export type LearningMaterialResponseDto = {
  id: string;
  courseId: string;
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
};

export type UpdateLearningMaterialDto = {
  title?: string;
  description?: string;
  type?: LearningMaterialType | string;
  url?: string;
  previewMetadata?: Record<string, unknown> | string | null;
  tags?: string[] | string;
  sortOrder?: number | string;
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
): LearningMaterialResponseDto => ({
  id: material.id,
  courseId: material.courseId,
  title: material.title,
  description: material.description,
  type: material.type,
  url: material.url,
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
  createdBy: material.createdBy,
  createdAt: toIsoString(material.createdAt),
  updatedAt: toIsoString(material.updatedAt),
  publishedAt: toIsoString(material.publishedAt),
});

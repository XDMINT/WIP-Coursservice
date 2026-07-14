import { apiClient } from './apiClient'

export enum LearningMaterialType {
  DOCUMENT = 'DOCUMENT',
  PRESENTATION = 'PRESENTATION',
  VIDEO = 'VIDEO',
  EXTERNAL_LINK = 'EXTERNAL_LINK',
  OTHER_FILE = 'OTHER_FILE'
}

export enum LearningMaterialPublicationStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED'
}

export enum LearningMaterialReleaseMode {
  IMMEDIATE = 'IMMEDIATE',
  AFTER_TASK_COMPLETION = 'AFTER_TASK_COMPLETION',
  SCHEDULED = 'SCHEDULED'
}

export type LearningMaterial = {
  id: string
  courseId: string
  courseRunId?: string
  courseVersionId?: string
  title: string
  description?: string
  type: LearningMaterialType
  url?: string
  originalFileName?: string
  mimeType?: string
  fileSize?: number
  previewMetadata?: Record<string, unknown>
  tags: string[]
  sortOrder: number
  publicationStatus: LearningMaterialPublicationStatus
  isPublished: boolean
  releaseMode: LearningMaterialReleaseMode
  releaseAt?: string
  releaseAfterTaskId?: string | null
  releaseAfterTaskTitle?: string
  visibleForStudents: boolean
  locked: boolean
  lockedReason?: string
  createdBy: string
  createdAt?: string
  updatedAt?: string
  publishedAt?: string
}

export type LearningMaterialMetadata = {
  title: string
  description?: string
  type?: LearningMaterialType
  url?: string
  tags?: string[]
  sortOrder?: number
  releaseMode?: LearningMaterialReleaseMode
  releaseAt?: string | null
  releaseAfterTaskId?: string | null
}

export type UploadLearningMaterialInput = LearningMaterialMetadata & {
  file: File
}

const pathForCourseMaterials = (courseId: string | number) => `/courses/${courseId}/materials`
const pathForCourseRunMaterials = (courseId: string | number, courseRunId?: string, courseVersionId?: string) => {
  if (courseRunId && courseVersionId) {
    return `/courses/${courseId}/runs/${courseRunId}/versions/${courseVersionId}/materials`
  }

  return courseRunId ? `/courses/${courseId}/runs/${courseRunId}/materials` : pathForCourseMaterials(courseId)
}

class LearningMaterialService {
  async listMaterials(courseId: string | number, courseRunId?: string, courseVersionId?: string): Promise<LearningMaterial[]> {
    const response = await apiClient.get<LearningMaterial[]>(pathForCourseRunMaterials(courseId, courseRunId, courseVersionId))
    return response.data
  }

  async uploadMaterial(courseId: string | number, input: UploadLearningMaterialInput, onProgress?: (percentage: number) => void): Promise<LearningMaterial> {
    const formData = new FormData()
    formData.append('title', input.title)
    formData.append('description', input.description ?? '')
    formData.append('type', input.type ?? LearningMaterialType.OTHER_FILE)
    formData.append('tags', JSON.stringify(input.tags ?? []))
    formData.append('sortOrder', String(input.sortOrder ?? 0))
    formData.append('releaseMode', input.releaseMode ?? LearningMaterialReleaseMode.IMMEDIATE)
    if (input.releaseAt) {
      formData.append('releaseAt', input.releaseAt)
    }
    if (input.releaseAfterTaskId) {
      formData.append('releaseAfterTaskId', input.releaseAfterTaskId)
    }
    formData.append('file', input.file)

    const response = await apiClient.post<LearningMaterial>(`${pathForCourseMaterials(courseId)}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (event) => {
        if (event.total != null && event.total > 0) {
          onProgress?.(Math.round((event.loaded / event.total) * 100))
        }
      }
    })

    return response.data
  }

  async createExternalLink(courseId: string | number, input: LearningMaterialMetadata): Promise<LearningMaterial> {
    const response = await apiClient.post<LearningMaterial>(`${pathForCourseMaterials(courseId)}/link`, {
      ...input,
      type: LearningMaterialType.EXTERNAL_LINK
    })

    return response.data
  }

  async updateMaterial(materialId: string, input: Partial<LearningMaterialMetadata>): Promise<LearningMaterial> {
    const response = await apiClient.put<LearningMaterial>(`/courses/materials/${materialId}`, input)
    return response.data
  }

  async updateSortOrder(courseId: string | number, materials: LearningMaterial[]): Promise<LearningMaterial[]> {
    const response = await apiClient.put<LearningMaterial[]>(`${pathForCourseMaterials(courseId)}/sort-order`, {
      items: materials.map((material, index) => ({
        id: material.id,
        sortOrder: index
      }))
    })

    return response.data
  }

  async publishMaterial(materialId: string): Promise<LearningMaterial> {
    const response = await apiClient.post<LearningMaterial>(`/courses/materials/${materialId}/publish`)
    return response.data
  }

  async withdrawMaterial(materialId: string): Promise<LearningMaterial> {
    const response = await apiClient.post<LearningMaterial>(`/courses/materials/${materialId}/withdraw`)
    return response.data
  }

  async deleteMaterial(materialId: string): Promise<void> {
    await apiClient.delete(`/courses/materials/${materialId}`)
  }

  async downloadMaterial(materialId: string): Promise<Blob> {
    const response = await apiClient.get<Blob>(`/courses/materials/${materialId}/download`, {
      responseType: 'blob'
    })

    return response.data
  }
}

export const formatLearningMaterialFileSize = (size?: number): string => {
  if (size == null) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export const isLearningMaterialPublished = (material: LearningMaterial): boolean => material.publicationStatus === LearningMaterialPublicationStatus.PUBLISHED

export default new LearningMaterialService()

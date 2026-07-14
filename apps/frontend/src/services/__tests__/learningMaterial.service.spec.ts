import { describe, expect, it, vi } from 'vitest'

import learningMaterialService, { LearningMaterialType, formatLearningMaterialFileSize } from '../learningMaterial.service'
import { apiClient } from '../apiClient'

vi.mock('../apiClient', () => ({
  apiClient: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}))

describe('learningMaterialService', () => {
  it('loads materials through a relative course API path', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    await expect(learningMaterialService.listMaterials('course-id')).resolves.toEqual([])
    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/materials')
  })

  it('loads materials through a selected course run API path', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    await expect(learningMaterialService.listMaterials('course-id', 'run-id')).resolves.toEqual([])
    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/runs/run-id/materials')
  })

  it('uploads files with progress callback', async () => {
    vi.mocked(apiClient.post).mockImplementationOnce((url, body, config: any) => {
      config.onUploadProgress({ loaded: 50, total: 100 })
      return Promise.resolve({
        data: {
          id: 'material-id',
          title: 'Slides'
        }
      })
    })
    const progress = vi.fn()
    const file = new File(['pdf'], 'slides.pdf', { type: 'application/pdf' })

    await expect(
      learningMaterialService.uploadMaterial(
        'course-id',
        {
          file,
          tags: ['intro'],
          title: 'Slides',
          type: LearningMaterialType.DOCUMENT
        },
        progress
      )
    ).resolves.toMatchObject({ id: 'material-id' })
    expect(apiClient.post).toHaveBeenCalledWith('/courses/course-id/materials/upload', expect.any(FormData), expect.any(Object))
    expect(progress).toHaveBeenCalledWith(50)
  })

  it('downloads files as blobs via the API client', async () => {
    const blob = new Blob(['content'], { type: 'application/pdf' })
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: blob })

    await expect(learningMaterialService.downloadMaterial('material-id')).resolves.toBe(blob)
    expect(apiClient.get).toHaveBeenCalledWith('/courses/materials/material-id/download', {
      responseType: 'blob'
    })
  })

  it('formats file sizes for display', () => {
    expect(formatLearningMaterialFileSize(undefined)).toBe('')
    expect(formatLearningMaterialFileSize(512)).toBe('512 B')
    expect(formatLearningMaterialFileSize(2048)).toBe('2 KB')
    expect(formatLearningMaterialFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})

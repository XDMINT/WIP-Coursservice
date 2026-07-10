type ApiErrorResponse = {
  statusCode?: number
  code?: string
  error?: string
  message?: string | string[]
  details?: string[]
}

type AxiosLikeError = Error & {
  response?: {
    status?: number
    data?: ApiErrorResponse | string
  }
}

export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'not-found' | 'validation' | 'network' | 'unknown'

export class ApiClientError extends Error {
  status?: number
  code?: string
  kind: ApiErrorKind
  details: string[]
  response?: AxiosLikeError['response']

  constructor(message: string, kind: ApiErrorKind, error?: AxiosLikeError) {
    super(message)
    this.name = 'ApiClientError'
    this.status = error?.response?.status
    this.response = error?.response
    this.kind = kind

    const data = typeof error?.response?.data === 'object' ? error.response.data : undefined
    this.code = data?.code
    this.details = data?.details ?? (Array.isArray(data?.message) ? data.message : [])
  }
}

const messageFromResponse = (error: AxiosLikeError): string => {
  const data = error.response?.data

  if (typeof data === 'string' && data.trim().length > 0) {
    return data
  }

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data.message)) {
      return data.message.join(', ')
    }

    if (typeof data.message === 'string' && data.message.trim().length > 0) {
      return data.message
    }

    if (typeof data.error === 'string' && data.error.trim().length > 0) {
      return data.error
    }
  }

  return error.message || 'Die Anfrage konnte nicht verarbeitet werden.'
}

export const getApiErrorKind = (status?: number, code?: string): ApiErrorKind => {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 400 || code === 'VALIDATION_FAILED') return 'validation'
  if (status === undefined) return 'network'
  return 'unknown'
}

export const normalizeApiError = (error: unknown): ApiClientError => {
  if (error instanceof ApiClientError) {
    return error
  }

  const axiosLikeError = error as AxiosLikeError
  const data = typeof axiosLikeError.response?.data === 'object' ? axiosLikeError.response.data : undefined
  const kind = getApiErrorKind(axiosLikeError.response?.status, data?.code)

  return new ApiClientError(messageFromResponse(axiosLikeError), kind, axiosLikeError)
}

export const getApiErrorMessage = (error: unknown): string => normalizeApiError(error).message

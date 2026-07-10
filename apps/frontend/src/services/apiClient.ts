import axios from 'axios'
import { normalizeApiError } from './apiErrors'

const apiBaseUrl = import.meta.env.VITE_PUBLIC_API_BASE_URL || '/api'

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json'
  }
})

apiClient.interceptors.request.use((config) => {
  const userStorage = localStorage.getItem('user')

  if (userStorage != null) {
    const user = JSON.parse(userStorage) as { id?: number | string; roles?: string[] }

    if (user.id != null) {
      config.headers.set('x-user-id', String(user.id))
    }

    if (Array.isArray(user.roles) && user.roles.length > 0) {
      config.headers.set('x-user-roles', user.roles.join(','))
    }
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiError(error))
)

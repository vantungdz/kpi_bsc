import http from '@/services/api'
import type { ApiResponse } from '@/types/api'

export interface UploadResponse {
  url: string
  name: string
}

export const fileService = {
  deleteUploadedFile: async (storedName: string): Promise<void> => {
    const name = storedName.trim()
    if (!name) return
    await http.delete<ApiResponse<null>>(`/upload/${encodeURIComponent(name)}`)
  },

  uploadFile: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    return http
      .post<ApiResponse<UploadResponse>>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      .then(r => r.data.data)
  },
}

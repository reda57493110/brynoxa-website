import api from './client'
import type { ApiResponse, UploadResult } from '@/types'

export const uploadApi = {
  image: (file: File) => {
    const form = new FormData()
    form.append('image', file)
    return api.post<ApiResponse<UploadResult>>('/admin/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

import api from './client'
import type { ApiResponse, UploadResult } from '@/types'

export const uploadApi = {
  image: (file: File) => {
    const form = new FormData()
    form.append('image', file)
    // Let the browser set multipart Content-Type + boundary.
    return api.post<ApiResponse<UploadResult>>('/admin/upload', form)
  },
}

import api from './client'
import type { ApiResponse, UploadResult } from '@/types'

export const uploadApi = {
  image: (file: File | Blob, filename = 'photo.jpg') => {
    const form = new FormData()
    form.append('image', file, file instanceof File ? file.name : filename)
    // Overrides the client's JSON default; without it axios turns FormData into JSON.
    // The browser then fills in the real multipart boundary.
    return api.post<ApiResponse<UploadResult>>('/admin/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 90_000,
    })
  },
}

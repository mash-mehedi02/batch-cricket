/**
 * Cloudinary Image Uploader
 * Handles unsigned uploads with progress tracking
 */

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

/**
 * Check if Cloudinary is configured
 */
export const isCloudinaryConfigured = () => {
  return !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET)
}

/**
 * Upload image to Cloudinary
 * @param {File} file - Image file to upload
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<string>} - Secure URL of uploaded image
 */
export const uploadImage = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      reject(new Error('Cloudinary is not configured. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET'))
      return
    }

    if (!file) {
      reject(new Error('No file provided'))
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'))
      return
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      reject(new Error('Image size must be less than 10MB'))
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
    formData.append('cloud_name', CLOUDINARY_CLOUD_NAME)

    const xhr = new XMLHttpRequest()

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = Math.round((e.loaded / e.total) * 100)
        onProgress(percentComplete)
      }
    })

    // Handle completion
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText)
          if (response.secure_url) {
            resolve(response.secure_url)
          } else {
            reject(new Error('Upload failed: No secure_url in response'))
          }
        } catch (error) {
          reject(new Error('Failed to parse upload response'))
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText)
          reject(new Error(error.error?.message || 'Upload failed'))
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }
    })

    // Handle errors
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'))
    })

    // Start upload
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`)
    xhr.send(formData)
  })
}

/**
 * Upload image with retry logic
 */
export const uploadImageWithRetry = async (file, onProgress, maxRetries = 3) => {
  let lastError

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await uploadImage(file, onProgress)
    } catch (error) {
      lastError = error
      if (i < maxRetries - 1) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  }

  throw lastError
}


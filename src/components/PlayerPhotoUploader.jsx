import { useState, useRef } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

// Cloudinary Configuration
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''
const CLOUDINARY_UPLOAD_URL = CLOUD_NAME 
  ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
  : null

// Validate Cloudinary config
const isCloudinaryConfigured = () => {
  return !!(CLOUD_NAME && UPLOAD_PRESET && CLOUDINARY_UPLOAD_URL)
}

const PlayerPhotoUploader = ({
  playerId = null,
  onUploaded = () => {},
  folder = 'players',
  initialPhotoUrl = null,
  className = '',
}) => {
  const [previewUrl, setPreviewUrl] = useState(initialPhotoUrl || null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef(null)

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }

    setError('')
    setSuccess('')

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result)
    }
    reader.readAsDataURL(file)

    // Auto-upload after preview
    uploadToCloudinary(file)
  }

  const uploadToCloudinary = async (file) => {
    try {
      setUploading(true)
      setUploadProgress(0)
      setError('')

      // Check Cloudinary configuration
      if (!isCloudinaryConfigured()) {
        throw new Error(
          'Cloudinary is not configured. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file. See CLOUDINARY_SETUP.md for instructions.'
        )
      }

      // Create form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', UPLOAD_PRESET)
      if (folder) {
        formData.append('folder', folder)
      }

      // Upload with progress tracking using XHR
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(percentComplete)
        }
      })

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText)
          const secureUrl = response.secure_url

          if (!secureUrl) {
            throw new Error('Upload failed: No URL returned from Cloudinary')
          }

          // Update Firestore if playerId exists
          if (playerId) {
            try {
              const playerRef = doc(db, 'players', playerId)
              await updateDoc(playerRef, {
                photo: secureUrl,
                photoURL: secureUrl, // Support both field names
                updatedAt: new Date(),
              })
              setSuccess('Photo uploaded and saved successfully!')
            } catch (firestoreError) {
              console.error('Error updating Firestore:', firestoreError)
              setError('Photo uploaded but failed to save to database. Please try again.')
              // Still call onUploaded with the URL
              onUploaded(secureUrl)
              return
            }
          }

          // Call callback with the URL
          onUploaded(secureUrl)
          setSuccess('Photo uploaded successfully!')
        } else {
          const errorResponse = JSON.parse(xhr.responseText || '{}')
          throw new Error(errorResponse.error?.message || `Upload failed with status ${xhr.status}`)
        }
      })

      xhr.addEventListener('error', () => {
        throw new Error('Network error during upload')
      })

      xhr.addEventListener('abort', () => {
        setError('Upload cancelled')
        setUploading(false)
      })

      xhr.open('POST', CLOUDINARY_UPLOAD_URL)
      xhr.send(formData)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message || 'Failed to upload photo. Please try again.')
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setPreviewUrl(initialPhotoUrl || null)
    setError('')
    setSuccess('')
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleChooseFile = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex flex-col items-center">
        {/* Preview Image */}
        <div className="relative mb-6">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#0D8F61]/20 bg-gray-100 flex items-center justify-center">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Player preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className={`w-full h-full rounded-full bg-gradient-to-br from-[#0D8F61] to-[#18a56f] flex items-center justify-center text-4xl font-bold text-white ${
                previewUrl ? 'hidden' : ''
              }`}
            >
              📷
            </div>
          </div>
        </div>

        {/* File Input (Hidden) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="w-full mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Uploading...</span>
              <span className="text-sm font-semibold text-[#0D8F61]">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#0D8F61] to-[#18a56f] h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={handleChooseFile}
            disabled={uploading}
            className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              uploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#0D8F61] text-white hover:bg-[#0a7049] shadow-md hover:shadow-lg'
            }`}
          >
            {uploading ? 'Uploading...' : previewUrl ? 'Change Photo' : 'Choose Photo'}
          </button>

          {previewUrl && (
            <button
              type="button"
              onClick={handleReset}
              disabled={uploading}
              className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                uploading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Reset
            </button>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="mt-4 w-full p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 text-center">{success}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 w-full p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-800 text-center">{error}</p>
          </div>
        )}

        {/* Help Text */}
        <p className="mt-4 text-xs text-gray-500 text-center">
          Supports JPG, PNG, GIF. Max size: 5MB
          <br />
          Click to choose from device or use camera
        </p>
      </div>
    </div>
  )
}

export default PlayerPhotoUploader


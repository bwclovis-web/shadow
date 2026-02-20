import { type ChangeEventHandler, useRef } from "react"

import { useCSRFToken } from "~/components/Molecules/CSRFToken"

import { handleDownloadCSV } from "../bones/csvHandlers/csvDownload"
import { createHandleUploadCSV } from "../bones/csvHandlers/csvUploader"

interface AdminCSVControlsProps {
  onUploadComplete: () => void
}

const AdminCSVControls = ({ onUploadComplete }: AdminCSVControlsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { csrfToken } = useCSRFToken()

  // Create upload handler with CSRF token
  const handleUploadCSV = createHandleUploadCSV(csrfToken)

  // Wrap the upload handler to refresh dashboard after upload
  const handleUploadAndRefresh: ChangeEventHandler<HTMLInputElement> = async e => {
    try {
      await handleUploadCSV(e)
      // Force refresh by updating lastFetch to 0 (or Date.now())
      onUploadComplete()
    } catch (err) {
      // Optionally handle error
       
      console.error("CSV upload failed", err)
    }
  }

  return (
    <div className="mb-6 flex gap-4 items-center">
      <button
        className="px-4 py-2 bg-green-600 text-white rounded shadow"
        onClick={handleDownloadCSV}
      >
        Download House Info CSV
      </button>
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleUploadAndRefresh}
      />
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded shadow"
        onClick={() => fileInputRef.current?.click()}
      >
        Upload Edited CSV
      </button>
    </div>
  )
}

export default AdminCSVControls

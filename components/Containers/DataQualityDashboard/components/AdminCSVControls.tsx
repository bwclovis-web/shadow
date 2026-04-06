import { type ChangeEventHandler, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { useCSRFToken } from "@/components/Molecules/CSRFToken"

import { handleDownloadCSV } from "../bones/csvHandlers/csvDownload"
import { createHandleUploadCSV } from "../bones/csvHandlers/csvUploader"

interface AdminCSVControlsProps {
  onUploadComplete: () => void
}

const AdminCSVControls = ({ onUploadComplete }: AdminCSVControlsProps) => {
  const t = useTranslations("dataQuality")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { csrfToken } = useCSRFToken()
  const [uploadStatus, setUploadStatus] = useState<{
    variant: "success" | "error" | "partial"
    message: string
    details?: string[]
  } | null>(null)
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null)

  const handleUploadCSV = createHandleUploadCSV(csrfToken)

  const onDownload = async () => {
    setDownloadMessage(null)
    await handleDownloadCSV({
      onEmpty: () => setDownloadMessage(t("csv.downloadEmpty")),
      onError: msg => setDownloadMessage(`${t("csv.downloadFailed")} ${msg}`),
    })
  }

  const handleUploadAndRefresh: ChangeEventHandler<HTMLInputElement> = async e => {
    setUploadStatus(null)
    try {
      const result = await handleUploadCSV(e)
      if (result.ok === false) {
        setUploadStatus({ variant: "error", message: result.message })
      } else {
        const { successCount, errorCount, rowMessages } = result
        if (successCount > 0) {
          onUploadComplete()
        }
        if (errorCount > 0 && successCount > 0) {
          setUploadStatus({
            variant: "partial",
            message: t("csv.uploadPartial", {
              success: successCount,
              errors: errorCount,
            }),
            details: rowMessages.length > 0 ? rowMessages : undefined,
          })
        } else if (errorCount > 0) {
          setUploadStatus({
            variant: "error",
            message: t("csv.uploadNone"),
            details: rowMessages.length > 0 ? rowMessages : undefined,
          })
        } else {
          setUploadStatus({
            variant: "success",
            message: t("csv.uploadSuccess", { count: successCount }),
          })
        }
      }
    } catch (err) {
      console.error("CSV upload failed", err)
      setUploadStatus({
        variant: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      })
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex gap-4 items-center flex-wrap">
        <button
          type="button"
          className="px-4 py-2 bg-green-600 text-white rounded shadow"
          onClick={onDownload}
        >
          {t("csv.download")}
        </button>
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          className="hidden"
          onChange={handleUploadAndRefresh}
        />
        <button
          type="button"
          className="px-4 py-2 bg-blue-600 text-white rounded shadow"
          onClick={() => fileInputRef.current?.click()}
        >
          {t("csv.upload")}
        </button>
      </div>
      {downloadMessage && (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          {downloadMessage}
        </div>
      )}
      {uploadStatus && (
        <div
          role="status"
          className={`rounded-md border px-4 py-3 text-sm ${
            uploadStatus.variant === "success"
              ? "border-green-200 bg-green-50 text-green-900"
              : uploadStatus.variant === "partial"
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <p>{uploadStatus.message}</p>
          {uploadStatus.details && uploadStatus.details.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs opacity-90 max-h-40 overflow-y-auto">
              {uploadStatus.details.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminCSVControls

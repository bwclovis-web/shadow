"use client"

import { useTranslations } from "next-intl"
import Image from "next/image"
import { useCallback, useRef, useState } from "react"
import { MdAddAPhoto, MdClose, MdPhotoCamera } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import Modal from "@/components/Organisms/Modal"
import { useCSRF } from "@/hooks/useCSRF"
import { useSessionStore } from "@/hooks/sessionStore"
import { compressImageFile, uploadListingImage } from "@/utils/listing-images-client"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"

const CAMERA_MODAL_ID = "listing-camera-capture"
const MAX_IMAGES_DEFAULT = 5

type ImageUploadFn = (
  file: File | Blob,
  headers: HeadersInit
) => Promise<{ url: string }>

interface ImageUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  maxImages?: number
  disabled?: boolean
  uploadFn?: ImageUploadFn
  translationNamespace?: string
  cameraModalId?: string
}

const ImageUploader = ({
  value,
  onChange,
  maxImages = MAX_IMAGES_DEFAULT,
  disabled = false,
  uploadFn = uploadListingImage,
  translationNamespace = "listing",
  cameraModalId = CAMERA_MODAL_ID,
}: ImageUploaderProps) => {
  const t = useTranslations(translationNamespace)
  const { addToHeaders } = useCSRF()
  const { modalOpen, modalId, toggleModal, closeModal } = useSessionStore()
  const cameraButtonRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const canUseCamera =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const remaining = maxImages - value.length
      if (remaining <= 0) return

      setError(null)
      setUploading(true)
      const uploaded: string[] = []

      try {
        const list = Array.from(files).slice(0, remaining)
        for (const file of list) {
          if (!file.type.startsWith("image/")) continue
          const compressed = await compressImageFile(file)
          const { url } = await uploadFn(compressed, addToHeaders())
          uploaded.push(url)
        }
        if (uploaded.length > 0) {
          onChange([...value, ...uploaded])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("uploadError"))
      } finally {
        setUploading(false)
      }
    },
    [addToHeaders, maxImages, onChange, t, uploadFn, value]
  )

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      setDragActive(false)
      if (disabled || uploading) return
      if (event.dataTransfer.files?.length) {
        await uploadFiles(event.dataTransfer.files)
      }
    },
    [disabled, uploadFiles, uploading]
  )

  const openCamera = async () => {
    setError(null)
    if (cameraButtonRef.current) {
      toggleModal(cameraButtonRef, cameraModalId)
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setError(t("cameraError"))
    }
  }

  const capturePhoto = async () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    )
    if (!blob) return
    stopCamera()
    closeModal()
    setUploading(true)
    try {
      const { url } = await uploadFn(blob, addToHeaders())
      onChange([...value, url])
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadError"))
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((url, index) => {
            const src = normalizeRemoteImageSrc(url)
            return (
              <li
                key={`${url}-${index}`}
                className="relative h-20 w-20 rounded border border-noir-gold/40 overflow-hidden"
              >
                {src ? (
                  <Image src={src} alt="" fill className="object-cover" sizes="80px" />
                ) : null}
                {!disabled && (
                  <button
                    type="button"
                    className="absolute top-0 right-0 bg-noir-dark/80 text-noir-gold p-0.5 rounded-bl"
                    onClick={() => removeImage(index)}
                    aria-label={t("removePhoto")}
                  >
                    <MdClose size={16} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {value.length < maxImages && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-md p-4 text-center transition-colors ${
            dragActive ? "border-noir-gold bg-noir-gold/10" : "border-noir-gold/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <p className="text-sm text-noir-gold-100 mb-2">{t("dropzoneHint")}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || uploading}
              leftIcon={<MdAddAPhoto size={18} />}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? t("uploading") : t("chooseFiles")}
            </Button>
            {canUseCamera && (
              <Button
                ref={cameraButtonRef}
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled || uploading}
                leftIcon={<MdPhotoCamera size={18} />}
                onClick={() => void openCamera()}
              >
                {t("useCamera")}
              </Button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {modalOpen && modalId === cameraModalId && (
        <Modal innerType="dark" animateStart="top" dialogAriaLabel={t("cameraTitle")}>
          <div className="p-4 space-y-4 max-w-lg mx-auto">
            <h3 className="text-lg text-noir-gold">{t("cameraTitle")}</h3>
            <video
              ref={videoRef}
              className="w-full rounded bg-black aspect-video"
              playsInline
              muted
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  stopCamera()
                  closeModal()
                }}
              >
                {t("cancel")}
              </Button>
              <Button type="button" variant="primary" onClick={() => void capturePhoto()}>
                {t("capture")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default ImageUploader
"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { MdChevronLeft, MdChevronRight } from "react-icons/md"

import Modal from "@/components/Organisms/Modal"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"

type PhotoLightboxSize = "default" | "large"

type PhotoLightboxProps = {
  images: string[]
  lightboxIndex: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  dialogAriaLabel: string
  lightboxSize?: PhotoLightboxSize
  footer?: ReactNode
  header?: ReactNode
  indexLabel?: string
}

export const PhotoLightbox = ({
  images,
  lightboxIndex,
  onClose,
  onPrev,
  onNext,
  dialogAriaLabel,
  lightboxSize = "default",
  footer,
  header,
  indexLabel,
}: PhotoLightboxProps) => {
  const t = useTranslations("listing")
  const hasMultiple = images.length > 1
  const activeSrc = normalizeRemoteImageSrc(images[lightboxIndex])

  return (
    <Modal
      innerType="dark"
      animateStart="top"
      dialogAriaLabel={dialogAriaLabel}
      onClose={onClose}
      className={
        lightboxSize === "large"
          ? "!w-[min(98vw,80rem)] !max-w-[min(98vw,80rem)] !max-h-[96dvh]"
          : undefined
      }
    >
      <div
        className={`relative p-2 sm:p-4 mx-auto w-full ${
          lightboxSize === "large" ? "max-w-full" : "max-w-3xl"
        }`}
      >
        {hasMultiple ? (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-noir-gold p-2"
              onClick={onPrev}
              aria-label={t("previousPhoto")}
            >
              <MdChevronLeft size={32} />
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-noir-gold p-2"
              onClick={onNext}
              aria-label={t("nextPhoto")}
            >
              <MdChevronRight size={32} />
            </button>
          </>
        ) : null}
        {header}
        <div
          className={`relative w-full ${hasMultiple ? "mx-4 sm:mx-8" : ""} ${
            lightboxSize === "large"
              ? "h-[min(88vh,920px)] min-h-[55vh] w-full"
              : "aspect-square max-h-[70vh]"
          }`}
        >
          {activeSrc ? (
            <Image
              src={activeSrc}
              alt=""
              fill
              className="object-contain"
              sizes={
                lightboxSize === "large"
                  ? "(max-width: 768px) 98vw, 80rem"
                  : "(max-width: 768px) 90vw, 70vw"
              }
              priority
            />
          ) : null}
        </div>
        {footer ? <div className="flex justify-center mt-3">{footer}</div> : null}
        {indexLabel ? (
          <p className="mt-2 text-center text-xs text-noir-gold-500">{indexLabel}</p>
        ) : null}
        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-noir-gold-100 underline"
          onClick={onClose}
        >
          {t("closeLightbox")}
        </button>
      </div>
    </Modal>
  )
}

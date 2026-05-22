"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { Button } from "@/components/Atoms/Button/Button"

type CopyShareLinkButtonProps = {
  sharePath: string
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "primary" | "secondary" | "danger"
}

const CopyShareLinkButton = ({
  sharePath,
  className = "",
  size = "sm",
  variant = "secondary",
}: CopyShareLinkButtonProps) => {
  const t = useTranslations("shareLinks")
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")

  const handleCopy = useCallback(async () => {
    const url =
      sharePath.startsWith("http") || typeof window === "undefined"
        ? sharePath
        : `${window.location.origin}${sharePath}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyState("copied")
      setTimeout(() => setCopyState("idle"), 2500)
    } catch {
      setCopyState("error")
      setTimeout(() => setCopyState("idle"), 4000)
    }
  }, [sharePath])

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => handleCopy()}
      >
        {copyState === "copied"
          ? t("linkCopied")
          : copyState === "error"
            ? t("copyLinkError")
            : t("copyLink")}
      </Button>
    </div>
  )
}

export default CopyShareLinkButton

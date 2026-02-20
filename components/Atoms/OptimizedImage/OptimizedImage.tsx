import type { CSSProperties, MutableRefObject } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { getOptimizedImageUrl } from "~/utils/imageOptimization"

export interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  sizes?: string
  className?: string
  style?: CSSProperties
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down"
  viewTransitionName?: string
  quality?: number
  format?: "webp" | "avif" | "jpeg" | "png"
  onLoad?: () => void
  onError?: () => void
  placeholder?: "blur" | "empty"
  blurDataURL?: string
}

interface BaseImageProps {
  alt: string
  height?: number
  imageStyle: CSSProperties
  imgRef: MutableRefObject<HTMLImageElement | null>
  isLoaded: boolean
  onError: () => void
  onLoad: () => void
  placeholder: "blur" | "empty"
  placeholderBlurDataURL: string
  priority: boolean
  shouldLoad: boolean
  sizes?: string
  src: string
  width?: number
}

interface BannerImageProps extends BaseImageProps {
  className: string
}

interface StandardImageProps extends BaseImageProps {
  containerClassName: string
}

interface StatusPlaceholderProps {
  className: string
  message: string
  style: CSSProperties
}

const OBSERVER_OPTIONS = {
  rootMargin: "50px",
  threshold: 0.01,
}

function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes,
  className = "",
  style = {},
  objectFit = "cover",
  viewTransitionName,
  quality = 80,
  format = "webp",
  onLoad,
  type,
  onError,
  placeholder = "blur",
  blurDataURL,
}: OptimizedImageProps) {
  const { imgRef, shouldLoad } = useLazyImageLoad(priority)
  const { isLoaded, hasError, handleLoad, handleError } = useImageStatus(
    imgRef,
    onLoad,
    onError
  )

  const optimizedSrc = useMemo(
    () => getOptimizedImageUrl(src, {
        quality,
        format,
        width: priority ? width : undefined,
        height: priority ? height : undefined,
      }),
    [
      format,
      height,
      priority,
      quality,
      src,
      width,
    ]
  )

  const imageSrc = optimizedSrc || src

  const placeholderBlurDataURL = useMemo(
    () => blurDataURL ?? generateBlurPlaceholder(width ?? 20, height ?? 20),
    [blurDataURL, height, width]
  )

  const imageStyle = useMemo<CSSProperties>(
    () => ({
      ...(viewTransitionName && { viewTransitionName }),
      width: "100%",
      height: "100%",
      objectFit,
      contain: "layout style paint",
      ...style,
    }),
    [objectFit, style, viewTransitionName]
  )

  if (!src) {
    return (
      <StatusPlaceholder
        className={className}
        message="No image bob"
        style={style}
      />
    )
  }

  if (hasError) {
    return (
      <StatusPlaceholder
        className={className}
        message="Image not available"
        style={style}
      />
    )
  }

  const isBannerImage =
    className.includes("absolute") && className.includes("w-full")

  if (isBannerImage) {
    return (
      <BannerImage
        alt={alt}
        className={className}
        height={height}
        imageStyle={imageStyle}
        imgRef={imgRef}
        isLoaded={isLoaded}
        onError={handleError}
        onLoad={handleLoad}
        placeholder={placeholder}
        placeholderBlurDataURL={placeholderBlurDataURL}
        priority={priority}
        shouldLoad={shouldLoad}
        sizes={sizes}
        src={imageSrc}
        width={width}
      />
    )
  }

  const containerClassName = className
    .replace(/\bdetails-title\b/g, "")
    .replace(/\s+/g, " ")
    .trim()

  return (
    <StandardImage
      alt={alt}
      containerClassName={containerClassName}
      height={height}
      imageStyle={imageStyle}
      imgRef={imgRef}
      isLoaded={isLoaded}
      onError={handleError}
      onLoad={handleLoad}
      placeholder={placeholder}
      placeholderBlurDataURL={placeholderBlurDataURL}
      priority={priority}
      shouldLoad={shouldLoad}
      sizes={sizes}
      src={imageSrc}
      width={width}
    />
  )
}

function BannerImage({
  alt,
  className,
  height,
  imageStyle,
  imgRef,
  isLoaded,
  onError,
  onLoad,
  placeholder,
  placeholderBlurDataURL,
  priority,
  shouldLoad,
  sizes,
  src,
  width,
}: BannerImageProps) {
  const showImage = shouldLoad || priority
  const bannerOpacityClass =
    priority || isLoaded
      ? "opacity-100"
      : shouldLoad
        ? "opacity-90"
        : "opacity-0"

  return (
    <>
      {placeholder === "blur" && !isLoaded && (
        <div
          aria-hidden="true"
          className={`${className} bg-noir-dark/30 animate-pulse`}
          style={{
            backgroundImage: placeholderBlurDataURL
              ? `url(${placeholderBlurDataURL})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(10px)",
            transform: "scale(1.1)",
          }}
        />
      )}

      {showImage && (
        <img
          ref={imgRef}
          alt={alt}
          className={`transition-opacity duration-300 bg-noir-dark ${bannerOpacityClass} ${className}`}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "high" : "auto"}
          height={height}
          loading={priority ? "eager" : "lazy"}
          onError={onError}
          onLoad={onLoad}
          sizes={sizes}
          src={src}
          style={imageStyle}
          width={width}
          suppressHydrationWarning
        />
      )}
    </>
  )
}

function StandardImage({
  alt,
  containerClassName,
  height,
  imageStyle,
  imgRef,
  isLoaded,
  onError,
  onLoad,
  placeholder,
  placeholderBlurDataURL,
  priority,
  shouldLoad,
  sizes,
  src,
  width,
}: StandardImageProps) {
  const aspectRatioStyle =
    width && height ? { aspectRatio: `${width} / ${height}` } : undefined

  return (
    <div
      className={`relative overflow-hidden bg-noir-dark/50 ${containerClassName}`.trim()}
      style={aspectRatioStyle}
    >
      {placeholder === "blur" && !isLoaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-noir-dark/30 animate-pulse w-full h-full"
          style={{
            backgroundImage: placeholderBlurDataURL
              ? `url(${placeholderBlurDataURL})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(10px)",
            transform: "scale(1.1)",
          }}
        />
      )}

      {(shouldLoad || priority) && (
        <img
          ref={imgRef}
          alt={alt}
          className={`transition-opacity duration-300 bg-noir-dark ${
            isLoaded || priority ? "opacity-100" : "opacity-0"
          }`}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "high" : "auto"}
          height={height}
          loading={priority ? "eager" : "lazy"}
          onError={onError}
          onLoad={onLoad}
          sizes={sizes}
          src={src}
          style={imageStyle}
          width={width}
          suppressHydrationWarning
        />
      )}

      {placeholder === "empty" && !isLoaded && shouldLoad && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-noir-dark/30 animate-pulse"
        />
      )}
    </div>
  )
}

function StatusPlaceholder({ className, message, style }: StatusPlaceholderProps) {
  const baseClasses =
    "bg-noir-dark/50 flex items-center justify-center border border-noir-gold/20 rounded-lg"
  const containerClassName = className
    ? `${baseClasses} ${className}`.trim()
    : baseClasses

  return (
    <div className={containerClassName} style={style}>
      <span className="text-noir-gold/40 text-sm">{message}</span>
    </div>
  )
}

function useLazyImageLoad(priority: boolean) {
  const [shouldLoad, setShouldLoad] = useState(priority)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (priority || shouldLoad) {
      if (!shouldLoad) {
        setShouldLoad(true)
      }
      return
    }

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setShouldLoad(true)
      return
    }

    const element = imgRef.current
    if (!element) {
      const timer = window.setTimeout(() => setShouldLoad(true), 0)
      return () => window.clearTimeout(timer)
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      })
    }, OBSERVER_OPTIONS)

    observer.observe(element)

    return () => observer.disconnect()
  }, [priority, shouldLoad])

  return { imgRef, shouldLoad }
}

function useImageStatus(
  imgRef: MutableRefObject<HTMLImageElement | null>,
  onLoad?: () => void,
  onError?: () => void
) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setTimeout(() => {
      const element = imgRef.current

      if (element && !element.complete) {
        setHasError(true)
        onError?.()
      }
    }, 1000)
  }, [imgRef, onError])

  return { isLoaded, hasError, handleLoad, handleError }
}

function generateBlurPlaceholder(width: number, height: number): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1a1a1a"/>
    </svg>
  `

  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return `data:image/svg+xml;base64,${window.btoa(svg)}`
  }

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
}

export default OptimizedImage


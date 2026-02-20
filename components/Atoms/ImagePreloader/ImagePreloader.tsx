import { useEffect, useRef } from "react"

interface ImagePreloaderProps {
  images: string[]
  priority?: "high" | "low"
  lazy?: boolean
}

const ImagePreloader = ({
  images,
  priority = "low",
  lazy = true,
}: ImagePreloaderProps) => {
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!images || images.length === 0) return

    if (priority === "high") {
      images.forEach(src => {
        const link = document.createElement("link")
        link.rel = "preload"
        link.as = "image"
        link.href = src
        link.setAttribute("fetchpriority", "high")
        document.head.appendChild(link)
      })
      return () => {
        const links = document.querySelectorAll('link[rel="preload"][as="image"]')
        links.forEach(link => {
          const href = (link as HTMLLinkElement).href || link.getAttribute("href")
          if (href && images.some(src => href === src || href.endsWith(src))) {
            link.remove()
          }
        })
      }
    }

    if (lazy && "IntersectionObserver" in window) {
      const imageElements = images.map(src => {
        const img = new Image()
        img.src = src
        img.loading = "lazy"
        img.decoding = "async"
        return img
      })
      observerRef.current = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement
              img.src = img.dataset.src || img.src
              observerRef.current?.unobserve(img)
            }
          })
        },
        { rootMargin: "50px 0px", threshold: 0.1 }
      )
      imageElements.forEach(img => observerRef.current?.observe(img))
      return () => {
        observerRef.current?.disconnect()
        observerRef.current = null
      }
    }

    // Low priority: defer entire effect to idle to reduce main-thread "Other" time
    let cancelled = false
    const runPreload = () => {
      if (cancelled) return
      images.forEach(src => {
        const link = document.createElement("link")
        link.rel = "preload"
        link.as = "image"
        link.href = src
        link.setAttribute("fetchpriority", "low")
        document.head.appendChild(link)
      })
    }
    const useIdle = typeof requestIdleCallback !== "undefined"
    const id = useIdle
      ? requestIdleCallback(runPreload, { timeout: 1500 })
      : setTimeout(runPreload, 500)

    return () => {
      cancelled = true
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      if (useIdle && typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(id as number)
      } else {
        clearTimeout(id as ReturnType<typeof setTimeout>)
      }
      const links = document.querySelectorAll('link[rel="preload"][as="image"]')
      links.forEach(link => {
        const href = (link as HTMLLinkElement).href || link.getAttribute("href")
        if (href && (images.includes(href) || images.some(src => href.endsWith(src)))) {
          link.remove()
        }
      })
    }
  }, [images, priority, lazy])

  return null // This component doesn't render anything
}

export default ImagePreloader

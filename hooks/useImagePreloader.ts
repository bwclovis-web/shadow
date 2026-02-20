import { useEffect, useState } from "react"

interface UseImagePreloaderOptions {
  images: string[]
  priority?: boolean
}

interface UseImagePreloaderReturn {
  loadedImages: Set<string>
  loadingImages: Set<string>
  failedImages: Set<string>
  isLoaded: boolean
  progress: number
}

export const useImagePreloader = ({
  images,
  priority = false,
}: UseImagePreloaderOptions): UseImagePreloaderReturn => {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (images.length === 0) {
      return
    }

    const loadImage = (src: string): Promise<void> => new Promise((resolve, reject) => {
        const img = new Image()

        img.onload = () => {
          setLoadedImages(prev => new Set([...prev, src]))
          setLoadingImages(prev => {
            const newSet = new Set(prev)
            newSet.delete(src)
            return newSet
          })
          resolve()
        }

        img.onerror = () => {
          setFailedImages(prev => new Set([...prev, src]))
          setLoadingImages(prev => {
            const newSet = new Set(prev)
            newSet.delete(src)
            return newSet
          })
          reject(new Error(`Failed to load image: ${src}`))
        }

        setLoadingImages(prev => new Set([...prev, src]))
        img.src = src
      })

    const loadImages = async () => {
      try {
        if (priority) {
          // Load all images in parallel for priority
          await Promise.all(images.map(loadImage))
        } else {
          // Load images sequentially to avoid overwhelming the browser
          for (const src of images) {
            try {
              await loadImage(src)
            } catch (error) {
              console.warn(`Failed to preload image: ${src}`, error)
            }
          }
        }
      } catch (error) {
        console.warn("Image preloading failed:", error)
      }
    }

    loadImages()
  }, [images, priority])

  const isLoaded = loadedImages.size === images.length
  const progress = images.length > 0 ? loadedImages.size / images.length : 0

  return {
    loadedImages,
    loadingImages,
    failedImages,
    isLoaded,
    progress,
  }
}

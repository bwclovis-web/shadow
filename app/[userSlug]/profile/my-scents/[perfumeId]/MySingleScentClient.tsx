"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"

import VooDooDetails from "@/components/Atoms/VooDooDetails"
import DestashManager from "@/components/Containers/MyScents/DestashManager/DestashManager"
import { CommentsModal } from "@/components/Containers/MyScents"
import { GeneralDetails, PerfumeComments } from "@/components/Containers/MyScents/MyScentListItem/bones"
import DangerModal from "@/components/Organisms/DangerModal"
import Modal from "@/components/Organisms/Modal"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { useCSRF } from "@/hooks/useCSRF"
import { usePerfumeComments } from "@/hooks/usePerfumeComments"
import { useSessionStore } from "@/hooks/sessionStore"
import type { Comment } from "@/types/comments"
import type { UserPerfumeI } from "@/types"
import { validImageRegex } from "@/utils/styleUtils"

const BOTTLE_BANNER = "/images/single-bottle.webp"
const USER_PERFUMES_API = "/api/user-perfumes"

type SerializedUserPerfume = {
  id: string
  perfumeId: string
  userId: string
  comments?: Array<{
    id: string
    userPerfumeId: string
    createdAt: string
    updatedAt: string
    [key: string]: unknown
  }>
  perfume: { id: string; name: string | null; image: string | null; [key: string]: unknown }
  [key: string]: unknown
}

type MySingleScentClientProps = {
  userPerfume: SerializedUserPerfume
  allUserPerfumes: SerializedUserPerfume[]
  userSlug: string
}

const MySingleScentClient = ({
  userPerfume: initialUserPerfume,
  allUserPerfumes: initialAllUserPerfumes,
  userSlug,
}: MySingleScentClientProps) => {
  const router = useRouter()
  const t = useTranslations("myScents.listItem")
  const { modalOpen, modalId, closeModal } = useSessionStore()
  const { addToFormData } = useCSRF()

  const safeAllUserPerfumes = initialAllUserPerfumes ?? []
  const thisPerfume = ((): UserPerfumeI => {
    const foundById = safeAllUserPerfumes.find(
      (up) => (up as { id: string }).id === initialUserPerfume.id
    )
    if (foundById) {
      return {
        ...foundById,
        comments: initialUserPerfume.comments || [],
      } as unknown as UserPerfumeI
    }
    const foundByPerfumeId = safeAllUserPerfumes.find(
      (up) => (up as { perfumeId: string }).perfumeId === initialUserPerfume.perfumeId
    )
    if (foundByPerfumeId) {
      return {
        ...foundByPerfumeId,
        comments: [],
      } as unknown as UserPerfumeI
    }
    return initialUserPerfume as unknown as UserPerfumeI
  })()

  const [fetchedComments, setFetchedComments] = useState<Comment[]>([])
  const [commentsRefetchedForId, setCommentsRefetchedForId] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)

  const thisPerfumeId = thisPerfume.id
  const initialId = initialUserPerfume.id
  const perfumeId = (thisPerfume.perfume as { id: string }).id

  useEffect(() => {
    if (thisPerfumeId !== initialId && thisPerfumeId) {
      setCommentsLoading(true)
      const formData = new FormData()
      formData.append("action", "get-comments")
      formData.append("userPerfumeId", thisPerfumeId)
      formData.append("perfumeId", perfumeId)
      addToFormData(formData)
      fetch(USER_PERFUMES_API, {
        method: "POST",
        body: formData,
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && Array.isArray(data.comments)) {
            setFetchedComments(data.comments)
          } else {
            setFetchedComments([])
          }
        })
        .catch(() => setFetchedComments([]))
        .finally(() => setCommentsLoading(false))
    } else {
      setFetchedComments([])
      setCommentsRefetchedForId(null)
    }
    // addToFormData is not memoized in useCSRF; only re-run when IDs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thisPerfumeId, initialId, perfumeId])

  const finalPerfume: UserPerfumeI =
    thisPerfume.id === initialUserPerfume.id
      ? commentsRefetchedForId === thisPerfume.id
        ? ({ ...thisPerfume, comments: fetchedComments } as UserPerfumeI)
        : thisPerfume
      : fetchedComments.length > 0
        ? ({ ...thisPerfume, comments: fetchedComments } as UserPerfumeI)
        : ({
            ...thisPerfume,
            comments: (initialUserPerfume.comments ?? []).filter(
              (c: { userPerfumeId: string }) => c.userPerfumeId === thisPerfume.id
            ) as unknown as Comment[],
          } as UserPerfumeI)

  const [userPerfumesListState, setUserPerfumesListState] = useState<UserPerfumeI[]>(
    safeAllUserPerfumes as unknown as UserPerfumeI[]
  )
  const lastLoaderDataRef = useRef<string>(
    JSON.stringify(
      (safeAllUserPerfumes as { id: string }[])
        .map((up) => up.id)
        .sort()
    )
  )

  useEffect(() => {
    const currentLoaderIds = JSON.stringify(
      (safeAllUserPerfumes as { id: string }[])
        .map((up) => up.id)
        .sort()
    )
    const lastLoaderIds = lastLoaderDataRef.current
    if (currentLoaderIds !== lastLoaderIds) {
      setUserPerfumesListState((prevState) => {
        const loaderIds = new Set(
          (safeAllUserPerfumes as { id: string }[]).map((up) => up.id)
        )
        const stateIds = new Set(prevState.map((up) => up.id))
        if (stateIds.size > loaderIds.size) {
          const manualUpdateIds = [...stateIds].filter((id) => !loaderIds.has(id))
          const manualUpdates = prevState.filter((up) =>
            manualUpdateIds.includes(up.id)
          )
          return [
            ...(safeAllUserPerfumes as unknown as UserPerfumeI[]),
            ...manualUpdates,
          ]
        }
        return safeAllUserPerfumes as unknown as UserPerfumeI[]
      })
      lastLoaderDataRef.current = currentLoaderIds
    }
  }, [safeAllUserPerfumes])

  const refreshComments = () => {
    const formData = new FormData()
    formData.append("action", "get-comments")
    formData.append("userPerfumeId", finalPerfume.id)
    formData.append("perfumeId", (finalPerfume.perfume as { id: string }).id)
    addToFormData(formData)
    fetch(USER_PERFUMES_API, {
      method: "POST",
      body: formData,
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.comments)) {
          setFetchedComments(data.comments)
          setCommentsRefetchedForId(finalPerfume.id)
        }
      })
      .catch(() => {})
  }

  const { uniqueModalId, addComment } = usePerfumeComments({
    userPerfume: finalPerfume,
    onCommentSuccess: refreshComments,
  })

  const handleRemovePerfume = async (userPerfumeId: string) => {
    closeModal()
    setIsRemoving(true)
    const formData = new FormData()
    formData.append("userPerfumeId", userPerfumeId)
    formData.append("action", "remove")
    formData.append("perfumeId", (finalPerfume.perfume as { id: string }).id)
    addToFormData(formData)
    try {
      const res = await fetch(USER_PERFUMES_API, {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      if (!data?.success) return
    } finally {
      setIsRemoving(false)
    }
    router.replace(`/${userSlug}/profile/my-scents`)
    router.refresh()
  }

  const perfume = finalPerfume.perfume as { id: string; name: string | null; image: string | null }
  const imageSrc =
    perfume?.image && !validImageRegex.test(perfume.image)
      ? perfume.image
      : BOTTLE_BANNER

  return (
    <>
      {modalOpen && modalId === "delete-item" && (
        <Modal innerType="dark" animateStart="top">
          <DangerModal
            heading="Are you sure you want to remove this perfume?"
            description="Once removed, you will lose all history, notes and entries in the exchange."
            action={() => handleRemovePerfume(finalPerfume.id)}
          />
        </Modal>
      )}
      {modalOpen && modalId === uniqueModalId && (
        <Modal innerType="dark" animateStart="top">
          <CommentsModal perfume={finalPerfume} addComment={addComment} />
        </Modal>
      )}
      <TitleBanner
        image={imageSrc}
        heading={perfume?.name ?? ""}
      />
      <div className="inner-container">
        <GeneralDetails
          userPerfume={finalPerfume}
          deletePerfume={handleRemovePerfume}
          isRemoving={isRemoving}
        />
        <VooDooDetails
          summary={t("viewComments")}
          className="text-start text-noir-dark py-3 mt-3 bg-noir-gold noir-border-dk px-2 relative open:bg-noir-gold-100"
          name="inner-details"
        >
          <PerfumeComments userPerfume={finalPerfume} onCommentSuccess={refreshComments} />
        </VooDooDetails>
        <VooDooDetails
          summary={t("manageDestashes")}
          className="text-start text-noir-dark font-bold py-3 mt-3 bg-noir-gold px-2 rounded noir-border-dk relative open:bg-noir-gold-100"
          name="inner-details"
        >
          <DestashManager
            perfumeId={perfume.id}
            userPerfumes={userPerfumesListState}
            setUserPerfumes={setUserPerfumesListState}
            apiBasePath={USER_PERFUMES_API}
          />
        </VooDooDetails>
      </div>
    </>
  )
}

export default MySingleScentClient

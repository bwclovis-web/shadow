"use client"

import { Link } from "next-view-transitions"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { RecentlyActiveBadge } from "@/components/Atoms/RecentlyActiveBadge"
import { TraderAvatar } from "@/components/Molecules/TraderAvatar"
import TitleBanner from "@/components/Organisms/TitleBanner"
import DangerModal from "@/components/Organisms/DangerModal"
import Modal from "@/components/Organisms/Modal"
import { useCSRF } from "@/hooks/useCSRF"
import { useSessionStore } from "@/hooks/sessionStore"
import { getTraderDisplayName } from "@/utils/user"
import { Button } from "@/components/Atoms/Button"
import { MdDeleteForever } from "react-icons/md"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const BANNER_IMAGE = "/images/messages.png"
const DELETE_MODAL_ID = "delete-conversation"

export interface ConversationSummary {
  otherUserId: string
  otherUserUsername: string | null
  otherUserFirstName: string | null
  otherUserLastName: string | null
  otherUserAvatarImage: string | null
  otherUserLastActiveAt?: Date | string | null
  lastMessageAt: Date | string
  lastMessagePreview: string | null
  unreadCount: number
  hasActiveTrade?: boolean
}

interface MessagesClientProps {
  userId: string
  initialConversations: ConversationSummary[]
}

export default function MessagesClient({
  userId: _userId,
  initialConversations,
}: MessagesClientProps) {
  const t = useTranslations("messagesPage")
  const tDm = useTranslations("directMessages")
  const router = useRouter()
  const { addToHeaders } = useCSRF()
  const { modalOpen, toggleModal, closeModal, modalId, modalData } =
    useSessionStore()
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null)
  const [conversations, setConversations] = useState(initialConversations)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setConversations(initialConversations)
  }, [initialConversations])

  const pendingDeleteName =
    typeof modalData?.displayName === "string" ? modalData.displayName : ""
  const pendingDeleteUserId =
    typeof modalData?.otherUserId === "string" ? modalData.otherUserId : ""

  const handleDeleteConversation = async () => {
    if (!pendingDeleteUserId || deletingId !== null) return
    setDeletingId(pendingDeleteUserId)
    try {
      const response = await fetch(
        `/api/messages?otherUserId=${encodeURIComponent(pendingDeleteUserId)}`,
        { method: "DELETE", headers: addToHeaders() }
      )
      closeModal()
      if (response.ok) {
        setConversations((prev) =>
          prev.filter((c) => c.otherUserId !== pendingDeleteUserId)
        )
        router.refresh()
      } else {
        window.alert(tDm("deleteConversationFailed"))
      }
    } catch {
      closeModal()
      window.alert(tDm("deleteConversationFailed"))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {modalOpen && modalId === DELETE_MODAL_ID && (
        <Modal innerType="dark" animateStart="top">
          <DangerModal
            heading={tDm("deleteConversationConfirm", {
              name: pendingDeleteName,
            })}
            description={tDm("deleteConversationDescription", {
              name: pendingDeleteName,
            })}
            action={handleDeleteConversation}
          />
        </Modal>
      )}
      <main id="main-content">
        <TitleBanner
          image={BANNER_IMAGE}
          heading={t("heading")}
          subheading={t("subheading")}
        />

        <PageWrapper>
          {conversations.length === 0 ? (
            <p className="text-noir-gold-500">You have no conversations yet.</p>
          ) : (
            <ul className="space-y-2">
              {conversations.map((conv) => {
                const displayName =
                  getTraderDisplayName({
                    firstName: conv.otherUserFirstName,
                    lastName: conv.otherUserLastName,
                    username: conv.otherUserUsername,
                  }) || "Unknown"
                return (
                  <li
                    key={conv.otherUserId}
                    className="flex flex-col lg:flex-row gap-2 rounded-lg border bg-noir-dark border-noir-gold hover:bg-noir-gold transition-colors group p-2 lg:px-4"
                  >
                    <Link
                      href={`/messages/${conv.otherUserId}`}
                      className="flex flex-1 min-w-0 items-center justify-between gap-4 p-2 lg:p-4 text-inherit no-underline"
                    >
                      <TraderAvatar
                        displayName={displayName}
                        avatarImage={conv.otherUserAvatarImage}
                        size="md"
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate text-noir-gold group-hover:text-noir-black transition-colors">
                            {displayName}
                          </span>
                          <RecentlyActiveBadge
                            lastActiveAt={conv.otherUserLastActiveAt}
                            variant="dot"
                          />
                          {conv.hasActiveTrade ? (
                            <span className="shrink-0 rounded-full border border-noir-gold/50 bg-noir-gold/20 px-2 py-0.5 text-xs font-medium text-noir-gold">
                              {t("activeTradeBadge")}
                            </span>
                          ) : null}
                          {conv.unreadCount > 0 && (
                            <span className="shrink-0 rounded-full bg-blue-600 text-white text-xs font-medium px-2 py-0.5">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        {conv.lastMessagePreview && (
                          <p className="text-sm text-noir-gold-500 group-hover:text-noir-dark transition-colors truncate mt-0.5">
                            {conv.lastMessagePreview}
                          </p>
                        )}
                      </div>
                      <time
                        className="text-xs text-noir-gold-100 group-hover:text-noir-black transition-colors shrink-0"
                        dateTime={
                          typeof conv.lastMessageAt === "string"
                            ? conv.lastMessageAt
                            : conv.lastMessageAt.toISOString()
                        }
                      >
                        {formatRelative(
                          typeof conv.lastMessageAt === "string"
                            ? new Date(conv.lastMessageAt)
                            : conv.lastMessageAt
                        )}
                      </time>
                    </Link>
                    <Button
                      type="button"
                      disabled={deletingId === conv.otherUserId}
                      variant="icon"
                      background="red"
                      size="sm"
                      className="ml-auto h-auto max-h-max max-w-max"
                      leftIcon={<MdDeleteForever size={20} fill="white" />}
                      onClick={(e) => {
                        e.preventDefault()
                        deleteButtonRef.current = e.currentTarget
                        toggleModal(deleteButtonRef, DELETE_MODAL_ID, {
                          otherUserId: conv.otherUserId,
                          displayName,
                        })
                      }}
                    >
                      {deletingId === conv.otherUserId
                        ? tDm("deleteConversationDeleting")
                        : tDm("deleteConversationShort")}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </PageWrapper>
      </main>
    </>
  )
}

const formatRelative = (date: Date | string): string => {
  const now = new Date()
  const d = typeof date === "string" ? new Date(date) : date
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

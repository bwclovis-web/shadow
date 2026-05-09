"use client"

import { Link } from "next-view-transitions"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import TitleBanner from "@/components/Organisms/TitleBanner"
import { useCSRF } from "@/hooks/useCSRF"
import { getTraderDisplayName } from "@/utils/user"

const BANNER_IMAGE = "/images/messages.png"

export interface ConversationSummary {
  otherUserId: string
  otherUserUsername: string | null
  otherUserFirstName: string | null
  otherUserLastName: string | null
  lastMessageAt: Date | string
  lastMessagePreview: string | null
  unreadCount: number
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
  const [conversations, setConversations] = useState(initialConversations)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setConversations(initialConversations)
  }, [initialConversations])

  const deleteConversation = async (otherUserId: string, displayName: string) => {
    if (
      !window.confirm(
        tDm("deleteConversationConfirm", { name: displayName })
      )
    ) {
      return
    }
    setDeletingId(otherUserId)
    try {
      const response = await fetch(
        `/api/messages?otherUserId=${encodeURIComponent(otherUserId)}`,
        { method: "DELETE", headers: addToHeaders() }
      )
      if (response.ok) {
        setConversations((prev) =>
          prev.filter((c) => c.otherUserId !== otherUserId)
        )
        router.refresh()
      } else {
        window.alert(tDm("deleteConversationFailed"))
      }
    } catch {
      window.alert(tDm("deleteConversationFailed"))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />

      <div className="inner-container py-8">
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
                  className="flex items-stretch gap-2 rounded-lg border bg-noir-dark border-noir-gold hover:bg-noir-gold-100 transition-colors group"
                >
                  <Link
                    href={`/messages/${conv.otherUserId}`}
                    className="flex flex-1 min-w-0 items-center justify-between gap-4 p-2 lg:p-4 text-inherit no-underline"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate text-noir-gold group-hover:text-noir-black transition-colors">
                          {displayName}
                        </span>
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
                  <button
                    type="button"
                    disabled={deletingId === conv.otherUserId}
                    className="shrink-0 self-center mr-2 lg:mr-4 px-2 py-1 text-sm text-noir-gold-100 hover:text-red-400 hover:bg-noir-black/20 rounded disabled:opacity-50"
                    aria-label={tDm("deleteConversationAria", {
                      name: displayName,
                    })}
                    onClick={(e) => {
                      e.preventDefault()
                      void deleteConversation(conv.otherUserId, displayName)
                    }}
                  >
                    {deletingId === conv.otherUserId
                      ? tDm("deleteConversationDeleting")
                      : tDm("deleteConversationShort")}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
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

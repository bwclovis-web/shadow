"use client"

import { useRouter } from "next/navigation"
import { Link } from "next-view-transitions"
import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import ContactTraderForm from "@/components/Containers/Forms/ContactTraderForm"
import { TraderAvatar } from "@/components/Molecules/TraderAvatar"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { useCSRF } from "@/hooks/useCSRF"
import { useConversationPresence } from "@/hooks/useConversationPresence"
import { formatDateTime } from "@/utils/formatters"
import { getTraderDisplayName } from "@/utils/user"
import { Button } from "@/components/Atoms/Button/Button"
import { MdDeleteForever } from "react-icons/md"
import DangerModal from "@/components/Organisms/DangerModal"
import { TradeStatusCard } from "@/components/Molecules/TradeStatusCard"
import { useSessionStore } from "@/hooks/sessionStore"
import Modal from "@/components/Organisms/Modal"
import type { TradeForClient } from "@/types/trade"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const BANNER_IMAGE = "/images/messages.png"

type ThreadMessage = {
  id: string
  senderId: string
  recipientId: string
  subject: string | null
  message: string
  read: boolean
  createdAt: Date | string
  sender: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
    avatarImage?: string | null
  }
  recipient: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
    avatarImage?: string | null
  }
}

interface ThreadClientProps {
  currentUserId: string
  userSlug: string
  otherUser: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
    avatarImage?: string | null
  }
  initialThread: ThreadMessage[]
  initialTrades?: TradeForClient[]
  activeDisputeTradeIds?: string[]
}

const ThreadClient = ({
  currentUserId,
  userSlug,
  otherUser,
  initialThread: thread,
  initialTrades = [],
  activeDisputeTradeIds = [],
}: ThreadClientProps) => {
  const router = useRouter()
  const { addToHeaders } = useCSRF()
  useConversationPresence(otherUser.id)
  const { modalOpen, toggleModal, closeModal, modalId } = useSessionStore()
  const DELETE_MODAL_ID = "delete-conversation"
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const tDm = useTranslations("directMessages")
  const [lastResult, setLastResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null)
  const [isDeletingThread, setIsDeletingThread] = useState(false)
  const otherUserName =
    getTraderDisplayName({
      firstName: otherUser.firstName,
      lastName: otherUser.lastName,
      username: otherUser.username,
    }) || "Unknown"

  const handleSubmit = async (formData: FormData) => {
    const response = await fetch("/api/contact-trader", {
      method: "POST",
      body: formData,
      headers: addToHeaders(),
    })
    const data = await response.json()
    setLastResult(data)
    if (data.success) {
      router.refresh()
    }
    return data
  }

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 15_000)
    const onVisibility = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [router])

  const handleDeleteConversation = async () => {
    if (isDeletingThread) return
    setIsDeletingThread(true)
    try {
      const response = await fetch(
        `/api/messages?otherUserId=${encodeURIComponent(otherUser.id)}`,
        { method: "DELETE", headers: addToHeaders() }
      )
      closeModal()
      if (response.ok) {
        router.push("/exchanges")
        router.refresh()
      } else {
        window.alert(tDm("deleteConversationFailed"))
      }
    } catch {
      closeModal()
      window.alert(tDm("deleteConversationFailed"))
    } finally {
      setIsDeletingThread(false)
    }
  }

  return (
    <>
    {modalOpen && modalId === DELETE_MODAL_ID && (
        <Modal innerType="dark" animateStart="top">
          <DangerModal
            heading={tDm("deleteConversationConfirm", { name: otherUserName })}
            description={tDm("deleteConversationDescription", { name: otherUserName })}
            action={handleDeleteConversation}
          />
        </Modal>
      )}
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={tDm("threadBannerHeading", { name: otherUserName })}
        subheading={tDm("threadBannerSubheading")}
      />

      <PageWrapper>
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Link
            href="/exchanges"
            className="text-noir-gold-100 hover:text-noir-gold-500 flex items-center gap-1 transition-colors"
          >
            <span aria-hidden>←</span> {tDm("backToConversations")}
          </Link>
          <Button
            type="button"
            variant="icon"
            background="red"
            ref={deleteButtonRef}
            size="sm"
            disabled={isDeletingThread}
            leftIcon={<MdDeleteForever size={20} fill="white" />}
            onClick={() => toggleModal(deleteButtonRef, DELETE_MODAL_ID)}
          >
            {isDeletingThread
              ? tDm("deleteConversationDeleting")
              : tDm("deleteConversationFull")}
          </Button>
        </div>

        {initialTrades.length > 0 ? (
          <div className="mb-6 space-y-3">
            {initialTrades.map(trade => (
              <TradeStatusCard
                key={trade.id}
                trade={trade}
                currentUserId={currentUserId}
                userSlug={userSlug}
                hasActiveDispute={activeDisputeTradeIds.includes(trade.id)}
                onUpdated={() => router.refresh()}
              />
            ))}
          </div>
        ) : null}

        <div className="space-y-4 mb-8">
          {thread.length === 0 ? (
            <p className="text-noir-gold">No messages yet. Send one below.</p>
          ) : (
            thread.map((msg) => {
              const isFromMe = msg.senderId === currentUserId
              const senderName = getTraderDisplayName({
                firstName: msg.sender.firstName,
                lastName: msg.sender.lastName,
                username: msg.sender.username,
              }) || "Unknown"
              const senderAvatar = msg.sender.avatarImage ?? null
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 max-w-[85%] ${isFromMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <TraderAvatar
                    displayName={senderName}
                    avatarImage={senderAvatar}
                    size="sm"
                    className="mt-1 shrink-0"
                  />
                  <div
                    className={`rounded-lg p-4 min-w-0 flex-1 ${
                      isFromMe
                        ? "bg-noir-gold/50 border border-noir-gold-500"
                        : "bg-noir-dark border border-noir-gold-100"
                    }`}
                  >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {senderName}{" "}
                      {isFromMe && (
                        <span className="text-xs">
                          (You)
                        </span>
                      )}
                    </span>
                    <time
                      className="text-xs text-noir-gold-100"
                      dateTime={
                        typeof msg.createdAt === "string"
                          ? msg.createdAt
                          : msg.createdAt.toISOString()
                      }
                    >
                      {formatDateTime(msg.createdAt)}
                    </time>
                  </div>
                  {msg.subject && (
                    <p className="text-sm font-medium text-noir-gold-500 mb-1">
                      Re: {msg.subject}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">Reply</h2>
          <ContactTraderForm
            recipientId={otherUser.id}
            recipientName={otherUserName}
            lastResult={lastResult ?? undefined}
            onSubmit={handleSubmit}
            onSuccess={() => router.refresh()}
          />
        </div>
      </PageWrapper>
    </main>
    </>
  )
}

export default ThreadClient
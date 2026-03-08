"use client"

import { useRouter } from "next/navigation"
import { Link } from "next-view-transitions"
import { useState } from "react"

import ContactTraderForm from "@/components/Containers/Forms/ContactTraderForm"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { useCSRF } from "@/hooks/useCSRF"
import { getTraderDisplayName } from "@/utils/user"

const BANNER_IMAGE = "/images/messages.png"

type ThreadMessage = {
  id: string
  senderId: string
  recipientId: string
  subject: string | null
  message: string
  read: boolean
  createdAt: Date | string
  sender: { id: string; username: string | null; firstName: string | null; lastName: string | null }
  recipient: { id: string; username: string | null; firstName: string | null; lastName: string | null }
}

interface ThreadClientProps {
  currentUserId: string
  otherUser: { id: string; username: string | null; firstName: string | null; lastName: string | null }
  initialThread: ThreadMessage[]
}

export default function ThreadClient({
  currentUserId,
  otherUser,
  initialThread: thread,
}: ThreadClientProps) {
  const router = useRouter()
  const { addToHeaders } = useCSRF()
  const [lastResult, setLastResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null)
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

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={`Conversation with ${otherUserName}`}
        subheading="Message thread"
      />

      <div className="inner-container py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/messages"
            className="text-noir-gold-100 hover:text-noir-gold-500 flex items-center gap-1 transition-colors"
          >
            <span aria-hidden>←</span> Back to messages
          </Link>
        </div>

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
              return (
                <div
                  key={msg.id}
                  className={`rounded-lg p-4 max-w-[85%] ${
                    isFromMe
                      ? "ml-auto bg-blue-50 border border-blue-100"
                      : "mr-auto bg-gray-50 border border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-sm">{senderName}</span>
                    <time
                      className="text-xs text-gray-500"
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
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Re: {msg.subject}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
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
      </div>
    </section>
  )
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  })
}

"use client"

import { Link } from "next-view-transitions"

import { getUserDisplayName } from "@/utils/user"

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
  userId,
  initialConversations: conversations,
}: MessagesClientProps) {
  return (
    <section className="inner-container py-8">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>

      {conversations.length === 0 ? (
        <p className="text-gray-600">You have no conversations yet.</p>
      ) : (
        <ul className="space-y-2">
          {conversations.map((conv) => {
            const displayName =
              getUserDisplayName({
                firstName: conv.otherUserFirstName,
                lastName: conv.otherUserLastName,
                username: conv.otherUserUsername,
              }) || "Unknown"
            return (
              <li key={conv.otherUserId}>
                <Link
                  href={`/messages/${conv.otherUserId}`}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{displayName}</span>
                      {conv.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-blue-600 text-white text-xs font-medium px-2 py-0.5">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.lastMessagePreview && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {conv.lastMessagePreview}
                      </p>
                    )}
                  </div>
                  <time
                    className="text-xs text-gray-400 shrink-0"
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
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function formatRelative(date: Date | string): string {
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

"use client"

import { useTranslations } from "next-intl"
import type { UserWithCounts } from "@/models/admin.server"

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

const totalDataRecords = (user: UserWithCounts) =>
  user._count.UserPerfume +
  user._count.UserPerfumeRating +
  user._count.UserPerfumeReview +
  user._count.UserPerfumeWishlist +
  user._count.userPerfumeComments +
  user._count.UserAlert +
  user._count.SecurityAuditLog

const UserRow = ({
  user,
  currentUserId,
  onDelete,
  onSoftDelete,
  pendingAction,
  pendingUserId,
}: {
  user: UserWithCounts
  currentUserId: string
  onDelete: (userId: string) => void
  onSoftDelete: (userId: string) => void
  pendingAction: string | null
  pendingUserId: string | null
}) => {
  const t = useTranslations("userAdmin.table")
  const isCurrentUser = user.id === currentUserId
  const isPending =
    (pendingAction === "delete" || pendingAction === "soft-delete") &&
    pendingUserId === user.id
  const isDeleted = user.email.startsWith("deleted_")

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.email

  return (
    <tr
      className={
        isPending
          ? "animate-pulse bg-noir-dark/50"
          : "bg-noir-black hover:bg-noir-dark/50"
      }
    >
      <td className="whitespace-nowrap px-6 py-4 text-sm text-noir-gold-100">
        <span className="font-medium">{displayName}</span>
        <br />
        <span className="text-noir-gold-100/70">{user.email}</span>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-noir-gold-100">
        {isCurrentUser ? (
          <span className="text-noir-gold">{t("currentUser")}</span>
        ) : isDeleted ? (
          t("deleted")
        ) : (
          user.role.charAt(0).toUpperCase() + user.role.slice(1)
        )}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-noir-gold-100">
        {totalDataRecords(user)}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-noir-gold-100">
        {formatDate(user.createdAt)}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
        {isCurrentUser ? (
          <span className="text-noir-gold-100/60">—</span>
        ) : (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onSoftDelete(user.id)}
              disabled={isPending}
              className="rounded border border-amber-600/70 px-2 py-1 text-amber-400 hover:bg-amber-600/20 disabled:opacity-50"
            >
              {t("softDelete")}
            </button>
            <button
              type="button"
              onClick={() => onDelete(user.id)}
              disabled={isPending}
              className="rounded border border-red-600/70 px-2 py-1 text-red-400 hover:bg-red-600/20 disabled:opacity-50"
            >
              {t("delete")}
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default UserRow

"use client"

import { useFormStatus } from "react-dom"
import { useTranslations } from "next-intl"
import type { UserRole } from "@prisma/client"
import type { UserWithCounts } from "@/models/admin.server"
import { CSRFToken } from "@/components/Molecules/CSRFToken"

const ROLES: UserRole[] = ["user", "editor", "admin"]

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

function RoleSelectControl({ user }: { user: UserWithCounts }) {
  const { pending } = useFormStatus()
  const t = useTranslations("userAdmin.table")

  return (
    <select
      name="newRole"
      defaultValue={user.role}
      disabled={pending}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="min-w-[6rem] rounded border border-noir-gold-500/50 bg-noir-black px-2 py-1 text-sm text-noir-gold-100 focus:border-noir-gold focus:outline-none focus:ring-1 focus:ring-noir-gold disabled:opacity-50"
      aria-label={t("changeRole")}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {t(`roles.${role}`)}
        </option>
      ))}
    </select>
  )
}

const UserRow = ({
  user,
  currentUserId,
  onDelete,
  onSoftDelete,
  pendingAction,
  pendingUserId,
  roleFormAction,
}: {
  user: UserWithCounts
  currentUserId: string
  onDelete: (userId: string) => void
  onSoftDelete: (userId: string) => void
  pendingAction: string | null
  pendingUserId: string | null
  roleFormAction?: (formData: FormData) => void
}) => {
  const t = useTranslations("userAdmin.table")
  const isCurrentUser = user.id === currentUserId
  const isPending =
    (pendingAction === "delete" || pendingAction === "soft-delete") &&
    pendingUserId === user.id
  const isDeleted = user.email.startsWith("deleted_")
  const canChangeRole =
    roleFormAction && !isCurrentUser && !isDeleted

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
        ) : canChangeRole ? (
          <form action={roleFormAction}>
            <CSRFToken />
            <input type="hidden" name="userId" value={user.id} />
            <RoleSelectControl user={user} />
          </form>
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

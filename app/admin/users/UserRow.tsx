"use client"

import { useFormStatus } from "react-dom"
import { useTranslations } from "next-intl"
import type { MembershipTier, UserRole } from "@prisma/client"
import type { UserWithCounts } from "@/models/admin.server"
import { CSRFToken, useCSRFToken } from "@/components/Molecules/CSRFToken"

import StrikeIndicators from "./StrikeIndicators"
import { getUserDisplayName } from "./userAdminFilters"

const ROLES: UserRole[] = ["user", "editor", "admin"]
const MEMBERSHIP_TIERS: MembershipTier[] = ["free", "premium", "collector"]

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

const totalDataRecords = (user: UserWithCounts) =>
  user._count.UserPerfume +
  user._count.UserPerfumeRating +
  user._count.UserPerfumeSeasonVote +
  user._count.UserPerfumeReview +
  user._count.UserPerfumeWishlist +
  user._count.userPerfumeComments +
  user._count.UserAlert +
  user._count.SecurityAuditLog

const RoleSelectControl = ({ user }: { user: UserWithCounts }) => {
  const { pending } = useFormStatus()
  const { csrfToken, isLoading } = useCSRFToken()
  const t = useTranslations("userAdmin.table")
  const csrfReady = !isLoading && !!csrfToken

  return (
    <select
      key={user.role}
      name="newRole"
      defaultValue={user.role}
      disabled={pending || !csrfReady}
      onChange={(e) => {
        if (!csrfReady) return
        e.currentTarget.form?.requestSubmit()
      }}
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

const MembershipSelectControl = ({ user }: { user: UserWithCounts }) => {
  const { pending } = useFormStatus()
  const { csrfToken, isLoading } = useCSRFToken()
  const t = useTranslations("userAdmin.table")
  const csrfReady = !isLoading && !!csrfToken

  return (
    <select
      key={user.membershipTier}
      name="newMembershipTier"
      defaultValue={user.membershipTier}
      disabled={pending || !csrfReady}
      onChange={(e) => {
        if (!csrfReady) return
        e.currentTarget.form?.requestSubmit()
      }}
      className="min-w-[7rem] rounded border border-noir-gold-500/50 bg-noir-black px-2 py-1 text-sm text-noir-gold-100 focus:border-noir-gold focus:outline-none focus:ring-1 focus:ring-noir-gold disabled:opacity-50"
      aria-label={t("changeMembership")}
    >
      {MEMBERSHIP_TIERS.map((tier) => (
        <option key={tier} value={tier}>
          {t(`membershipTiers.${tier}`)}
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
  onIssueStrike,
  pendingAction,
  pendingUserId,
  roleFormAction,
  membershipFormAction,
  resetTwoFactorFormAction,
}: {
  user: UserWithCounts
  currentUserId: string
  onDelete: (userId: string) => void
  onSoftDelete: (userId: string) => void
  onIssueStrike: (userId: string) => void
  pendingAction: string | null
  pendingUserId: string | null
  roleFormAction?: (formData: FormData) => void
  membershipFormAction?: (formData: FormData) => void
  resetTwoFactorFormAction?: (formData: FormData) => void
}) => {
  const t = useTranslations("userAdmin.table")
  const isCurrentUser = user.id === currentUserId
  const isPending =
    (pendingAction === "delete" || pendingAction === "soft-delete") &&
    pendingUserId === user.id
  const isDeleted = user.email.startsWith("deleted_")
  const canChangeRole = roleFormAction && !isCurrentUser && !isDeleted
  const canChangeMembership = membershipFormAction && !isDeleted

  const displayName = getUserDisplayName(user)
  const canIssueStrike = !isCurrentUser && !isDeleted && !user.isBanned
  const hasTwoFactor = user.twoFactorEnabledAt != null

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
        {isDeleted ? (
          t(`membershipTiers.${user.membershipTier}`)
        ) : canChangeMembership ? (
          <form action={membershipFormAction}>
            <CSRFToken />
            <input type="hidden" name="userId" value={user.id} />
            <MembershipSelectControl user={user} />
          </form>
        ) : (
          t(`membershipTiers.${user.membershipTier}`)
        )}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-noir-gold-100">
        <StrikeIndicators strikeCount={user.strikeCount} isBanned={user.isBanned} />
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
          <div className="flex justify-end gap-2 flex-wrap">
            {hasTwoFactor && resetTwoFactorFormAction && (
              <form
                action={resetTwoFactorFormAction}
                onSubmit={(e) => {
                  if (!window.confirm(t("reset2faConfirm"))) {
                    e.preventDefault()
                  }
                }}
              >
                <CSRFToken />
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded border border-noir-gold-500/70 px-2 py-1 text-noir-gold hover:bg-noir-gold/10 disabled:opacity-50"
                >
                  {t("reset2fa")}
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => onIssueStrike(user.id)}
              disabled={!canIssueStrike || isPending}
              className="rounded border border-orange-600/70 px-2 py-1 text-orange-400 hover:bg-orange-600/20 disabled:opacity-50"
            >
              {t("issueStrike")}
            </button>
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

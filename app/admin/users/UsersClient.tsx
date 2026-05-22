"use client"

import { useActionState, useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  CSRFToken,
  CSRFTokenProvider,
} from "@/components/Molecules/CSRFToken"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type { UserWithCounts } from "@/models/admin.server"

import {
  deleteUserAction,
  updateUserRoleAction,
  issueStrikeAction,
  resetTwoFactorAction,
  type DeleteUserActionState,
  type UpdateRoleActionState,
  type IssueStrikeActionState,
  type ResetTwoFactorActionState,
} from "./actions"
import ConfirmDeleteModal from "./ConfirmDeleteModal"
import ConfirmStrikeModal from "./ConfirmStrikeModal"
import FormPendingSync from "./FormPendingSync"
import UserRow from "./UserRow"
import {
  filterUsers,
  type RoleFilter,
  type StrikeFilter,
} from "./userAdminFilters"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const BANNER_IMAGE = "/images/userAdmin.webp"

type UsersClientProps = {
  users: UserWithCounts[]
  currentUserId: string
}

const UsersClient = ({ users, currentUserId }: UsersClientProps) => {
  const router = useRouter()
  const [state, formAction] = useActionState(
    deleteUserAction,
    null as DeleteUserActionState
  )
  const [roleState, roleFormAction] = useActionState(
    updateUserRoleAction,
    null as UpdateRoleActionState
  )
  const [strikeState, strikeFormAction] = useActionState(
    issueStrikeAction,
    null as IssueStrikeActionState
  )
  const [reset2faState, reset2faFormAction] = useActionState(
    resetTwoFactorAction,
    null as ResetTwoFactorActionState
  )
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showStrikeModal, setShowStrikeModal] = useState(false)
  const [deleteType, setDeleteType] = useState<"delete" | "soft-delete">("delete")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isStrikeSubmitting, setIsStrikeSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [strikeFilter, setStrikeFilter] = useState<StrikeFilter>("all")

  const t = useTranslations("userAdmin")

  const filteredUsers = useMemo(
    () => filterUsers(users, searchQuery, roleFilter, strikeFilter),
    [users, searchQuery, roleFilter, strikeFilter]
  )

  const handleDelete = useCallback((userId: string, type: "delete" | "soft-delete") => {
    setSelectedUserId(userId)
    setDeleteType(type)
    setShowConfirmModal(true)
  }, [])

  const handleIssueStrike = useCallback((userId: string) => {
    setSelectedUserId(userId)
    setShowStrikeModal(true)
  }, [])

  const cancelDelete = useCallback(() => {
    setShowConfirmModal(false)
    setSelectedUserId(null)
  }, [])

  const cancelStrike = useCallback(() => {
    setShowStrikeModal(false)
    setSelectedUserId(null)
  }, [])

  useEffect(() => {
    if (state !== null) {
      setShowConfirmModal(false)
      setSelectedUserId(null)
    }
  }, [state])

  useEffect(() => {
    if (roleState?.success) {
      router.refresh()
    }
  }, [roleState?.success, router])

  useEffect(() => {
    if (strikeState?.success) {
      setShowStrikeModal(false)
      setSelectedUserId(null)
      router.refresh()
    }
  }, [strikeState?.success, router])

  useEffect(() => {
    if (reset2faState?.success) {
      router.refresh()
    }
  }, [reset2faState?.success, router])

  const pendingAction = isSubmitting && selectedUserId ? deleteType : null
  const pendingUserId = isSubmitting ? selectedUserId : null

  const roleOptions: { value: RoleFilter; labelKey: string }[] = [
    { value: "all", labelKey: "filters.roleAll" },
    { value: "user", labelKey: "filters.roleUser" },
    { value: "editor", labelKey: "filters.roleEditor" },
    { value: "admin", labelKey: "filters.roleAdmin" },
  ]

  const strikeOptions: { value: StrikeFilter; labelKey: string }[] = [
    { value: "all", labelKey: "filters.strikeAll" },
    { value: "none", labelKey: "filters.strikeNone" },
    { value: "1", labelKey: "filters.strikeOne" },
    { value: "2", labelKey: "filters.strikeTwo" },
    { value: "banned", labelKey: "filters.strikeBanned" },
  ]

  return (
    <CSRFTokenProvider>
      <main id="main-content">
        <TitleBanner
          image={BANNER_IMAGE}
          heading={t("heading")}
          subheading={t("subheading")}
        />

        <PageWrapper>
          {state && !state.success && (
            <div className="mb-6 rounded-md border border-red-400 bg-red-100 p-4 text-red-700">
              {state.message}
            </div>
          )}

          {strikeState && !strikeState.success && (
            <div className="mb-6 rounded-md border border-red-400 bg-red-100 p-4 text-red-700">
              {strikeState.message}
            </div>
          )}

          {strikeState?.success && (
            <div className="mb-6 rounded-md border border-green-500/50 bg-green-900/20 p-4 text-green-300">
              {strikeState.message}
            </div>
          )}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[12rem] flex-1">
              <label htmlFor="user-search" className="mb-1 block text-sm text-noir-gold-100">
                {t("filters.searchLabel")}
              </label>
              <input
                id="user-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                className="w-full rounded border border-noir-gold-500/50 bg-noir-black px-3 py-2 text-sm text-noir-gold-100 focus:border-noir-gold focus:outline-none focus:ring-1 focus:ring-noir-gold"
              />
            </div>
            <div>
              <label htmlFor="role-filter" className="mb-1 block text-sm text-noir-gold-100">
                {t("filters.roleLabel")}
              </label>
              <select
                id="role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                className="min-w-[8rem] rounded border border-noir-gold-500/50 bg-noir-black px-3 py-2 text-sm text-noir-gold-100 focus:border-noir-gold focus:outline-none focus:ring-1 focus:ring-noir-gold"
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="strike-filter" className="mb-1 block text-sm text-noir-gold-100">
                {t("filters.strikeLabel")}
              </label>
              <select
                id="strike-filter"
                value={strikeFilter}
                onChange={(e) => setStrikeFilter(e.target.value as StrikeFilter)}
                className="min-w-[8rem] rounded border border-noir-gold-500/50 bg-noir-black px-3 py-2 text-sm text-noir-gold-100 focus:border-noir-gold focus:outline-none focus:ring-1 focus:ring-noir-gold"
              >
                {strikeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mb-4 text-sm text-noir-gold-100/80">
            {t("filters.showingCount", {
              shown: filteredUsers.length,
              total: users.length,
            })}
          </p>

          <div className="overflow-hidden rounded-md border border-noir-gold bg-noir-dark shadow sm:rounded-md">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-noir-gold-100">
                {t("userCount", { count: users.length })}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-noir-gold-100/80">
                {t("manageUsers")}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="border-y border-noir-gold-500 bg-noir-black">
                  <tr className="text-left text-xs font-medium uppercase tracking-wider text-noir-gold-100">
                    <th className="px-6 py-3">{t("table.user")}</th>
                    <th className="px-6 py-3">{t("table.role")}</th>
                    <th className="px-6 py-3">{t("table.strikes")}</th>
                    <th className="px-6 py-3">{t("table.dataRecords")}</th>
                    <th className="px-6 py-3">{t("table.joined")}</th>
                    <th className="px-6 py-3 text-right">{t("table.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-noir-black">
                  {filteredUsers.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      currentUserId={currentUserId}
                      onDelete={(id) => handleDelete(id, "delete")}
                      onSoftDelete={(id) => handleDelete(id, "soft-delete")}
                      onIssueStrike={handleIssueStrike}
                      pendingAction={pendingAction}
                      pendingUserId={pendingUserId}
                      roleFormAction={roleFormAction}
                      resetTwoFactorFormAction={reset2faFormAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ConfirmDeleteModal
            isOpen={showConfirmModal}
            deleteType={deleteType}
            isSubmitting={isSubmitting}
            onCancel={cancelDelete}
          />

          <ConfirmStrikeModal
            isOpen={showStrikeModal}
            isSubmitting={isStrikeSubmitting}
            onCancel={cancelStrike}
          />

          <form
            id="delete-form"
            action={formAction}
            className="hidden"
          >
            <CSRFToken />
            <input type="hidden" name="action" value={deleteType} />
            <input type="hidden" name="userId" value={selectedUserId ?? ""} />
            <FormPendingSync onPendingChange={setIsSubmitting} />
          </form>

          <form
            id="strike-form"
            action={strikeFormAction}
            className="hidden"
          >
            <CSRFToken />
            <input type="hidden" name="userId" value={selectedUserId ?? ""} />
            <FormPendingSync onPendingChange={setIsStrikeSubmitting} />
          </form>
        </PageWrapper>
      </main>
    </CSRFTokenProvider>
  )
}

export { UsersClient }

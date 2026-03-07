"use client"

import { useActionState, useState, useCallback, useEffect } from "react"
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
  type DeleteUserActionState,
  type UpdateRoleActionState,
} from "./actions"
import ConfirmDeleteModal from "./ConfirmDeleteModal"
import FormPendingSync from "./FormPendingSync"
import UserRow from "./UserRow"

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [deleteType, setDeleteType] = useState<"delete" | "soft-delete">("delete")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const t = useTranslations("userAdmin")

  const handleDelete = useCallback((userId: string, type: "delete" | "soft-delete") => {
    setSelectedUserId(userId)
    setDeleteType(type)
    setShowConfirmModal(true)
  }, [])

  const cancelDelete = useCallback(() => {
    setShowConfirmModal(false)
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

  const pendingAction = isSubmitting && selectedUserId ? deleteType : null
  const pendingUserId = isSubmitting ? selectedUserId : null

  return (
    <CSRFTokenProvider>
      <div>
        <TitleBanner
          image={BANNER_IMAGE}
          heading={t("heading")}
          subheading={t("subheading")}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {state && !state.success && (
            <div className="mb-6 rounded-md border border-red-400 bg-red-100 p-4 text-red-700">
              {state.message}
            </div>
          )}

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
                    <th className="px-6 py-3">{t("table.dataRecords")}</th>
                    <th className="px-6 py-3">{t("table.joined")}</th>
                    <th className="px-6 py-3 text-right">{t("table.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-noir-black">
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      currentUserId={currentUserId}
                      onDelete={(id) => handleDelete(id, "delete")}
                      onSoftDelete={(id) => handleDelete(id, "soft-delete")}
                      pendingAction={pendingAction}
                      pendingUserId={pendingUserId}
                      roleFormAction={roleFormAction}
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
            onConfirm={() => {}}
            onCancel={cancelDelete}
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
        </div>
      </div>
    </CSRFTokenProvider>
  )
}

export { UsersClient }

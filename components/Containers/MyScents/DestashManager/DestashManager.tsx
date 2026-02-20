import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {  MdAdd } from "react-icons/md"
import { useFetcher } from "react-router"

import { Button } from "~/components/Atoms/Button"
import { useCSRF } from "~/hooks/useCSRF"
import { useSessionStore } from "~/stores/sessionStore"
import type { UserPerfumeI } from "~/types"

import DestashForm from "../DeStashForm/DeStashForm"
import DestashItem from "./DestashItem"

interface DestashManagerProps {
  perfumeId: string
  userPerfumes: UserPerfumeI[]
  setUserPerfumes: Dispatch<SetStateAction<UserPerfumeI[]>>
}

const DestashManager = ({
  perfumeId,
  userPerfumes,
  setUserPerfumes,
}: DestashManagerProps) => {
  const { t } = useTranslation()
  const fetcher = useFetcher()
  const { addToFormData } = useCSRF()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const previousStateRef = useRef<string>(fetcher.state)
  const submittedRef = useRef(false)
  const { closeModal } = useSessionStore()

  // Revalidate data after successful fetcher submission and close form
  useEffect(() => {
    const responseData = fetcher.data
    const isSuccess = responseData && typeof responseData === "object" && "success" in responseData
      ? (responseData as { success?: boolean }).success
      : false

    const transitionedToIdle =
      previousStateRef.current === "submitting" && fetcher.state === "idle"

    if (transitionedToIdle && isSuccess) {
      if (responseData && typeof responseData === "object" && "userPerfume" in responseData) {
        const updatedUserPerfume = (responseData as { userPerfume: UserPerfumeI }).userPerfume
        if (updatedUserPerfume) {
          setUserPerfumes(prev => {
            const index = prev.findIndex(up => up.id === updatedUserPerfume.id)
            if (index >= 0) {
              const updated = [...prev]
              updated[index] = updatedUserPerfume
              return updated
            }
            return [...prev, updatedUserPerfume]
          })
        }
      }

      setIsCreating(false)
      setEditingId(null)
      submittedRef.current = false
    }

    // Fallback: close form when idle with success data and we had submitted
    // (handles remount or effect order issues)
    if (
      fetcher.state === "idle" &&
      isSuccess &&
      submittedRef.current
    ) {
      if (responseData && typeof responseData === "object" && "userPerfume" in responseData) {
        const updatedUserPerfume = (responseData as { userPerfume: UserPerfumeI }).userPerfume
        if (updatedUserPerfume) {
          setUserPerfumes(prev => {
            const index = prev.findIndex(up => up.id === updatedUserPerfume.id)
            if (index >= 0) {
              const updated = [...prev]
              updated[index] = updatedUserPerfume
              return updated
            }
            return [...prev, updatedUserPerfume]
          })
        }
      }
      setIsCreating(false)
      setEditingId(null)
      submittedRef.current = false
    }

    previousStateRef.current = fetcher.state
  }, [fetcher.state, fetcher.data, setUserPerfumes])

  // Filter destashes for this perfume
  const destashes = userPerfumes.filter(up => up.perfumeId === perfumeId && parseFloat(up.available || "0") > 0)

  // Calculate total owned and total destashed for this perfume
  const entriesForPerfume = userPerfumes.filter(up => up.perfumeId === perfumeId)
  const totalOwned = entriesForPerfume.reduce((sum, entry) => {
    const amt = parseFloat(entry.amount?.replace(/[^0-9.]/g, "") || "0")
    return sum + (isNaN(amt) ? 0 : amt)
  }, 0)
  const totalDestashed = entriesForPerfume.reduce((sum, entry) => {
    const avail = parseFloat(entry.available?.replace(/[^0-9.]/g, "") || "0")
    return sum + (isNaN(avail) ? 0 : avail)
  }, 0)

  const handleCreateNew = () => {
    setIsCreating(true)
    setEditingId(null)
  }

  const handleEdit = (id: string) => {
    setEditingId(id)
    setIsCreating(false)
  }

  const handleCancel = () => {
    setEditingId(null)
    setIsCreating(false)
  }

  const handleDelete = (userPerfumeId: string) => {
    const destash = userPerfumes.find(up => up.id === userPerfumeId)
    closeModal()
    if (destash) {
      setUserPerfumes(prev => prev.map(perfume => perfume.id === userPerfumeId
            ? { ...perfume, available: "0" }
            : perfume))

      const formData = new FormData()
      formData.append("action", "decant")
      formData.append("userPerfumeId", userPerfumeId)
      formData.append("availableAmount", "0")
      addToFormData(formData)
      fetcher.submit(formData, { method: "post", action: "/admin/my-scents" })
    }
  }

  const handleDecantConfirm = (data: {
    amount: string
    price?: string
    tradePreference: "cash" | "trade" | "both"
    tradeOnly: boolean
    createNew?: boolean
  }) => {
    const formData = new FormData()
    formData.append("perfumeId", perfumeId)

    const shouldEdit = editingId && !isCreating && !data.createNew

    if (shouldEdit) {
      // Editing existing destash
      formData.append("action", "decant")
      formData.append("userPerfumeId", editingId)
      formData.append("availableAmount", data.amount)
      if (data.price) {
        formData.append("tradePrice", data.price)
      }
    } else {
      // Creating new destash entry
      formData.append("action", "create-decant")
      formData.append("amount", data.amount)
      if (data.price) {
        formData.append("tradePrice", data.price)
      }
    }

    formData.append("tradePreference", data.tradePreference)
    formData.append("tradeOnly", data.tradeOnly.toString())

    addToFormData(formData)
    submittedRef.current = true
    fetcher.submit(formData, { method: "post", action: "/admin/my-scents" })
  }

  const editingDestash = editingId
    ? userPerfumes.find(up => up.id === editingId)
    : null

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:gap-0 justify-between items-center">
        <h3 className="!text-noir-dark text-xl font-semibold">
          {t("myScents.destashManager.title")}
        </h3>
        {!isCreating && !editingId && (
          <Button
            onClick={handleCreateNew}
            variant="primary"
            size="sm"
            leftIcon={<MdAdd size={18} />}
          >
            {t("myScents.destashManager.addNew")}
          </Button>
        )}
      </div>

      <p className="text-sm text-noir-gold-dark">
        {t("myScents.destashManager.description")}
      </p>

      {/* List of existing destashes */}
      {!isCreating && !editingId && (
        <div className="space-y-3">
          {destashes.length === 0 ? (
            <p className="text-noir-gold-300 italic text-center py-4">
              {t("myScents.destashManager.noDestashes")}
            </p>
          ) : (
            destashes.map(destash => (
              <DestashItem
                key={destash.id}
                destash={destash}
                onEdit={() => handleEdit(destash.id)}
                onDelete={() => handleDelete(destash.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="noir-border p-4 bg-noir-dark/30">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-noir-dark">
              {isCreating
                ? t("myScents.destashManager.createNew")
                : t("myScents.destashManager.editDestash")}
            </h4>
            <Button onClick={handleCancel} variant="secondary" size="sm">
              {t("myScents.destashManager.cancel")}
            </Button>
          </div>
          {editingDestash && (
            <DestashForm
              key={`edit-${editingDestash.id}`}
              userPerfume={editingDestash}
              handleDecantConfirm={handleDecantConfirm}
              isEditing={true}
              maxAvailable={totalOwned > 0
                ? totalOwned - totalDestashed + parseFloat(editingDestash.available || "0")
                : undefined}
            />
          )}
          {isCreating && (() => {
            const foundByPerfumeId = userPerfumes?.find(up => up.perfumeId === perfumeId);
            const fallbackFirst = userPerfumes?.[0];
            let finalUserPerfume = foundByPerfumeId || fallbackFirst;
            
            // If no userPerfume found, create a minimal fallback object for the form
            if (!finalUserPerfume) {
              // Try to get perfume info from any userPerfume in the array
              const anyUserPerfume = userPerfumes?.find(up => up.perfume?.id === perfumeId) || userPerfumes?.[0];
              const perfumeName = anyUserPerfume?.perfume?.name || "Unknown Perfume";
              
              finalUserPerfume = {
                id: `temp-${perfumeId}`, // Temporary ID for dependency tracking
                userId: "",
                perfumeId: perfumeId,
                perfume: { 
                  id: perfumeId, 
                  name: perfumeName 
                },
                amount: "0",
                available: "0",
                price: undefined,
                tradePrice: undefined,
                tradePreference: "cash",
                tradeOnly: false,
              } as UserPerfumeI;
            }
            
            // Ensure finalUserPerfume is always defined before rendering
            if (!finalUserPerfume) {
              return null; // Don't render if we can't create a valid userPerfume
            }
            
            return (
              <DestashForm
                key="create-new"
                userPerfume={finalUserPerfume}
                handleDecantConfirm={handleDecantConfirm}
                isCreating={true}
                maxAvailable={totalOwned > 0 ? totalOwned - totalDestashed : undefined}
              />
            );
          })()}
        </div>
      )}
    </div>
  )
}

export default DestashManager

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { MdAdd } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import { useCSRF } from "@/hooks/useCSRF"
import { useSessionStore } from "@/hooks/sessionStore"
import type { UserPerfumeI } from "@/types"

import DestashForm from "../DeStashForm/DeStashForm"
import DestashItem from "./DestashItem"

interface DestashManagerProps {
  perfumeId: string
  userPerfumes: UserPerfumeI[]
  setUserPerfumes: Dispatch<SetStateAction<UserPerfumeI[]>>
  apiBasePath?: string
  /** When on a single-bottle page, pass this bottle's id so new decants use it as source (no dropdown). */
  currentBottleId?: string
}

const DestashManager = ({
  perfumeId,
  userPerfumes,
  setUserPerfumes,
  apiBasePath = "/api/user-perfumes",
  currentBottleId,
}: DestashManagerProps) => {
  const t = useTranslations("myScents.destashManager")
  const { addToFormData } = useCSRF()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle")
  const [submitData, setSubmitData] = useState<{ success?: boolean; userPerfume?: UserPerfumeI } | null>(null)
  const previousStateRef = useRef<"idle" | "submitting">("idle")
  const submittedRef = useRef(false)
  const { closeModal } = useSessionStore()

  const submitForm = useCallback(
    async (formData: FormData) => {
      setSubmitState("submitting")
      submittedRef.current = true
      addToFormData(formData)
      try {
        const res = await fetch(apiBasePath, {
          method: "POST",
          body: formData,
          credentials: "include",
        })
        const data = await res.json().catch(() => ({}))
        setSubmitData(data)
        return data
      } finally {
        setSubmitState("idle")
      }
    },
    [apiBasePath, addToFormData]
  )

  useEffect(() => {
    const responseData = submitData
    const isSuccess =
      responseData &&
      typeof responseData === "object" &&
      "success" in responseData
        ? (responseData as { success?: boolean }).success
        : false

    const transitionedToIdle =
      previousStateRef.current === "submitting" && submitState === "idle"

    if (transitionedToIdle && isSuccess && submittedRef.current) {
      if (
        responseData &&
        typeof responseData === "object" &&
        "userPerfume" in responseData
      ) {
        const updatedUserPerfume = (responseData as { userPerfume: UserPerfumeI })
          .userPerfume
        if (updatedUserPerfume) {
          setUserPerfumes((prev) => {
            const index = prev.findIndex((up) => up.id === updatedUserPerfume.id)
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

    previousStateRef.current = submitState
  }, [submitState, submitData, setUserPerfumes])

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
    const destash = userPerfumes.find((up) => up.id === userPerfumeId)
    closeModal()
    if (destash) {
      setUserPerfumes((prev) =>
        prev.map((perfume) =>
          perfume.id === userPerfumeId ? { ...perfume, available: "0" } : perfume
        )
      )
      const formData = new FormData()
      formData.append("action", "decant")
      formData.append("userPerfumeId", userPerfumeId)
      formData.append("perfumeId", perfumeId)
      formData.append("amount", "0")
      submitForm(formData)
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
    formData.append("tradePreference", data.tradePreference)
    formData.append("tradeOnly", data.tradeOnly.toString())

    const isEditing = editingId && !isCreating && !data.createNew

    if (isEditing) {
      formData.append("action", "decant")
      formData.append("userPerfumeId", editingId)
      formData.append("amount", data.amount)
      if (data.price) formData.append("tradePrice", data.price)
    } else if (isCreating && currentBottleId) {
      // On single-bottle page: decant from this bottle
      formData.append("action", "decant")
      formData.append("userPerfumeId", currentBottleId)
      formData.append("amount", data.amount)
      if (data.price) formData.append("tradePrice", data.price)
    } else {
      // No current bottle context: standalone destash entry
      formData.append("action", "create-decant")
      formData.append("amount", data.amount)
      if (data.price) formData.append("tradePrice", data.price)
    }

    submitForm(formData)
  }

  const editingDestash = editingId
    ? userPerfumes.find(up => up.id === editingId)
    : null

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:gap-0 justify-between items-center">
        <h3 className="!text-noir-dark text-xl font-semibold">
          {t("title")}
        </h3>
        {!isCreating && !editingId && (
          <Button
            onClick={handleCreateNew}
            variant="primary"
            size="sm"
            leftIcon={<MdAdd size={18} />}
          >
            {t("addNew")}
          </Button>
        )}
      </div>

      <p className="text-sm text-noir-gold-dark">
        {t("description")}
      </p>

      {/* List of existing destashes */}
      {!isCreating && !editingId && (
        <div className="space-y-3">
          {destashes.length === 0 ? (
            <p className="text-noir-gold-300 italic text-center py-4">
              {t("noDestashes")}
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
                ? t("createNew")
                : t("editDestash")}
            </h4>
            <Button onClick={handleCancel} variant="secondary" size="sm">
              {t("cancel")}
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
            // Use current bottle when on single-bottle page; otherwise first entry for this perfume or fallback
            const sourceBottle = currentBottleId
              ? userPerfumes.find(up => up.id === currentBottleId)
              : userPerfumes.find(up => up.perfumeId === perfumeId)
            const fallbackFirst = userPerfumes?.[0]
            let finalUserPerfume = sourceBottle || fallbackFirst

            if (!finalUserPerfume) {
              const anyUserPerfume = userPerfumes?.find(up => up.perfume?.id === perfumeId) || userPerfumes?.[0]
              const perfumeName = anyUserPerfume?.perfume?.name || "Unknown Perfume"
              finalUserPerfume = {
                id: `temp-${perfumeId}`,
                userId: "",
                perfumeId,
                perfume: { id: perfumeId, name: perfumeName },
                amount: "0",
                available: "0",
                price: undefined,
                tradePrice: undefined,
                tradePreference: "cash",
                tradeOnly: false,
              } as UserPerfumeI
            }

            let formMaxAvailable: number | undefined
            if (sourceBottle) {
              const rawAmt = (sourceBottle.amount ?? "").replace(/[^0-9.]/g, "")
              const sAmt = rawAmt ? parseFloat(rawAmt) : NaN
              const sAvail = parseFloat((sourceBottle.available ?? "").replace(/[^0-9.]/g, "") || "0")
              formMaxAvailable = isNaN(sAmt) ? undefined : Math.max(0, sAmt - sAvail)
            } else {
              formMaxAvailable = totalOwned > 0 ? totalOwned - totalDestashed : undefined
            }

            return (
              <DestashForm
                key={`create-new-${currentBottleId ?? "standalone"}`}
                userPerfume={finalUserPerfume}
                handleDecantConfirm={handleDecantConfirm}
                isCreating={true}
                maxAvailable={formMaxAvailable}
              />
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default DestashManager

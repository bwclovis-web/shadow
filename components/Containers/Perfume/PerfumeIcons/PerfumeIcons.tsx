import { useEffect, useRef, useState } from "react"
import { BsHeartFill, BsHearts } from "react-icons/bs"
import { GrEdit } from "react-icons/gr"
import { MdDeleteForever } from "react-icons/md"

import { Button, VooDooLink } from "@/components/Atoms/Button"
import VooDooCheck from "@/components/Atoms/VooDooCheck/VooDooCheck"
import AddToCollectionModal from "@/components/Organisms/AddToCollectionModal"
import DangerModal from "@/components/Organisms/DangerModal"
import Modal from "@/components/Organisms/Modal"
import { useSessionStore } from "@/hooks/sessionStore"
import {
  useToggleWishlist,
  WISHLIST_BOTTLE_PREFERENCE_OPTIONS,
  type WishlistBottlePreference,
} from "@/lib/mutations/wishlist"
import { useTranslations } from "next-intl"

const DELETE_MODAL_ID = "delete-perfume-item"
const ACTION_ANIMATION_MS = 560

const wishlistModalIdForPerfume = (perfumeId: string) => `wishlist-${perfumeId}`

interface Perfume {
  id: string
  name: string
  slug: string
}

interface PerfumeIconsProps {
  perfume: Perfume
  handleDelete: () => void
  userRole: string
  isInWishlist: boolean
}

import { IconLabel } from "@/components/Molecules/IconLabel/IconLabel"

const PerfumeIcons = ({
  perfume,
  handleDelete,
  userRole,
  isInWishlist,
}: PerfumeIconsProps) => {
  const [inWishlist, setInWishlist] = useState(isInWishlist)
  const [animatedAction, setAnimatedAction] = useState<string | null>(null)
  const { modalOpen, toggleModal, modalId, closeModal } = useSessionStore()
  const [isPublic, setIsPublic] = useState(false)
  const [bottlePreference, setBottlePreference] =
    useState<WishlistBottlePreference>("any")
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const wishlistButtonRef = useRef<HTMLButtonElement>(null)
  const wishlistModalId = wishlistModalIdForPerfume(perfume.id)
  const tCommon = useTranslations("common")
  const tIcons = useTranslations("singlePerfume")
  const tWishlist = useTranslations("wishlist.itemCard")
  const tBottle = useTranslations("wishlist.bottlePreference")
  const toggleWishlist = useToggleWishlist()

  useEffect(() => {
    setInWishlist(isInWishlist)
  }, [isInWishlist])

  useEffect(() => {
    if (!animatedAction) return

    const timeoutId = window.setTimeout(() => {
      setAnimatedAction(current => (current === animatedAction ? null : current))
    }, ACTION_ANIMATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [animatedAction])

  const handleWishlistToggle = () => {
    if (inWishlist) {
      toggleWishlist.mutate(
        { perfumeId: perfume.id, action: "remove" },
        {
          onSuccess: () => {
            setInWishlist(false)
            setAnimatedAction("wishlist")
            closeModal()
          },
          onError: error => console.error("Failed to remove from wishlist:", error),
        }
      )
    } else {
      setIsPublic(false)
      setBottlePreference("any")
      toggleModal(wishlistButtonRef, wishlistModalId)
    }
  }

  const handleAddToWishlist = () => {
    toggleWishlist.mutate(
      {
        perfumeId: perfume.id,
        action: "add",
        isPublic,
        bottlePreference,
      },
      {
        onSuccess: () => {
          setInWishlist(true)
          setAnimatedAction("wishlist")
          closeModal()
        },
        onError: error => console.error("Failed to add to wishlist:", error),
      }
    )
  }

  const wishlistAriaLabel = `${inWishlist ? tCommon("remove") : tCommon("add")} ${perfume.name} ${inWishlist ? "from" : "to"} wishlist`
  const isAdmin = userRole === "admin"
  const actionButtonClassName =
    "group relative overflow-hidden min-w-full justify-between border-noir-gold-100 bg-noir-gold/10 " +
    "transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out " +
    "motion-safe:hover:-translate-y-0.5 hover:bg-noir-gold/16 hover:border-noir-gold-500"
  const activeActionButtonClassName =
    "border-noir-gold-100 bg-noir-gold/18 -translate-y-0.5"
  const iconLabelClassName =
    "font-medium tracking-[0.08em] transition-[transform,color] duration-300 group-hover:translate-x-0.5"

  return (
    <>
      {modalOpen && modalId === DELETE_MODAL_ID && (
        <Modal innerType="dark" animateStart="top">
          <DangerModal
            heading={tIcons("dangerModal.heading")}
            description={tIcons("dangerModal.description")}
            action={handleDelete}
          />
        </Modal>
      )}
      {modalOpen && modalId === wishlistModalId && (
        <Modal innerType="dark" animateStart="top">
          <div className="space-y-4 p-6 pt-12 max-w-md mx-auto">
            <h2 className="text-lg font-medium text-center text-noir-gold">
              {tIcons("icons.addButton")}
            </h2>
            <p className="text-sm text-noir-gold-500 text-center">
              {perfume.name}
            </p>
            <div className="space-y-2">
              <label
                htmlFor={`bottle-pref-${perfume.id}`}
                className="block text-sm text-center text-noir-gold-100"
              >
                {tBottle("label")}
              </label>
              <select
                id={`bottle-pref-${perfume.id}`}
                value={bottlePreference}
                onChange={e =>
                  setBottlePreference(e.target.value as WishlistBottlePreference)
                }
                className="w-full rounded border border-noir-gold bg-noir-dark px-3 py-2 text-sm text-noir-gold-500 cursor-pointer"
              >
                {WISHLIST_BOTTLE_PREFERENCE_OPTIONS.map(v => (
                  <option key={v} value={v} className="cursor-pointer">
                    {tBottle(v)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-center text-noir-gold-100">
                {tBottle("hint")}
              </p>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <VooDooCheck
                id={`public-${perfume.id}`}
                checked={isPublic}
                onChange={() => setIsPublic(prev => !prev)}
                labelChecked={tWishlist("public")}
                labelUnchecked={tWishlist("private")}
              />
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                onClick={handleAddToWishlist}
                variant="icon"
                background="gold"
                size="sm"
                disabled={toggleWishlist.isPending}
              >
                {toggleWishlist.isPending ? tCommon("adding") : tIcons("icons.addButton")}
              </Button>
              <Button
                onClick={closeModal}
                variant="icon"
                background="gold"
                size="sm"
              >
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      <div className="grid grid-cols-1 gap-2 noir-border relative rounded-lg bg-noir-black/20 p-4 shadow-[0_16px_34px_rgba(0,0,0,0.26)]">
        <Button
          ref={wishlistButtonRef}
          onClick={handleWishlistToggle}
          variant="icon"
          background="gold"
          size="sm"
          className={`${actionButtonClassName} ${
            inWishlist ? activeActionButtonClassName : ""
          } ${animatedAction === "wishlist" ? "motion-safe:animate-vault-stamp" : ""}`}
          disabled={toggleWishlist.isPending}
          aria-label={wishlistAriaLabel}
        >
          {inWishlist ? (
            <IconLabel
              label={tIcons("icons.inWishlist")}
              icon={BsHeartFill}
              size={22}
              className={iconLabelClassName}
            />
          ) : (
            <IconLabel
              label={tIcons("icons.addButton")}
              icon={BsHearts}
              size={22}
              className={iconLabelClassName}
            />
          )}
        </Button>
        <AddToCollectionModal
          type="icon"
          perfume={perfume}
          className={actionButtonClassName}
        />
        {isAdmin && (
          <div>
            <h2 className="text-center mb-2">
              Admin
            </h2>
            <div className="flex flex-col items-center justify-between gap-2">
              <VooDooLink
                aria-label={`edit ${perfume.name}`}
                variant="icon"
                background="gold"
                size="sm"
                className={`${actionButtonClassName} flex items-center justify-between gap-2`}
                rightIcon={<GrEdit size={22} />}
                url={`/admin/perfume/${perfume.slug}/edit`}
              >
                {tIcons("icons.editButton")}
              </VooDooLink>
              <Button
                ref={deleteButtonRef}
                onClick={() => toggleModal(deleteButtonRef, DELETE_MODAL_ID)}
                aria-label={`delete ${perfume.name}`}
                variant="icon"
                className={`${actionButtonClassName} flex items-center justify-between gap-2`}
                rightIcon={<MdDeleteForever size={22} />}
                background="gold"
                size="sm"
              >
                {tIcons("icons.deleteButton")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default PerfumeIcons

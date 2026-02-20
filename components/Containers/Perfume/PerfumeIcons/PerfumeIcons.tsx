import { useState } from "react"
import { BsHeartFill, BsHearts } from "react-icons/bs"
import { GrEdit } from "react-icons/gr"
import { MdDeleteForever } from "react-icons/md"

import { Button, VooDooLink } from "~/components/Atoms/Button"
import VooDooCheck from "~/components/Atoms/VooDooCheck/VooDooCheck"
import AddToCollectionModal from "~/components/Organisms/AddToCollectionModal"
import DangerModal from "~/components/Organisms/DangerModal"
import Modal from "~/components/Organisms/Modal"
import { useToggleWishlist } from "~/lib/mutations/wishlist"
import { useSessionStore } from "~/stores/sessionStore"
import { useTranslation } from "react-i18next"

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

const PerfumeIcons = ({
  perfume,
  handleDelete,
  userRole,
  isInWishlist,
}: PerfumeIconsProps) => {
  const [inWishlist, setInWishlist] = useState(isInWishlist)
  const { modalOpen, toggleModal, modalId } = useSessionStore()
  const [isPublic, setIsPublic] = useState(false)
  const [showWishlistForm, setShowWishlistForm] = useState(false)
  const { t } = useTranslation()
  
  // Use TanStack Query mutation for wishlist
  const toggleWishlist = useToggleWishlist()

  const handleWishlistToggle = async () => {
    if (inWishlist) {
      // Remove from wishlist
      toggleWishlist.mutate(
        {
          perfumeId: perfume.id,
          action: "remove",
        },
        {
          onSuccess: () => {
            setInWishlist(false)
            setShowWishlistForm(false)
          },
          onError: error => {
            console.error("Failed to remove from wishlist:", error)
            // The mutation's optimistic update will rollback on error
          },
        }
      )
    } else {
      // Show form to add to wishlist with public/private option
      setShowWishlistForm(true)
    }
  }

  const handleAddToWishlist = async () => {
    toggleWishlist.mutate(
      {
        perfumeId: perfume.id,
        action: "add",
        isPublic,
      },
      {
        onSuccess: () => {
          setInWishlist(true)
          setShowWishlistForm(false)
        },
        onError: error => {
          console.error("Failed to add to wishlist:", error)
          // The mutation's optimistic update will rollback on error
        },
      }
    )
  }

  return (
    <>
    {modalOpen && modalId === "delete-perfume-item" && (
        <Modal innerType="dark" animateStart="top">
          <DangerModal
          heading={t("singlePerfume.dangerModal.heading")}
          description={t("singlePerfume.dangerModal.description")}
          action={handleDelete} />
        </Modal>
      )}    
    <div className="grid grid-cols-1 gap-2 noir-border relative p-4">
      {!showWishlistForm ? (
        <Button
          onClick={handleWishlistToggle}
          variant="icon"
          background="gold"
          size={"sm"}
          disabled={toggleWishlist.isPending}
          aria-label={`${inWishlist ? t("common.remove") : t("common.add")} ${perfume.name} ${
            inWishlist ? "from" : "to"
          } wishlist`}
        >
          {inWishlist ? (
            <div className="flex items-center justify-between gap-2">
              <span>{t("singlePerfume.icons.inWishlist")}</span>
              <BsHeartFill size={20} />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span>{t("singlePerfume.icons.addButton")}</span>
              <BsHearts size={20} />
            </div>
          )}
        </Button>
      ) : (
        <div className="space-y-2 p-3 bg-noir-dark/10 rounded-lg border border-noir-gold">
          <div className="flex items-center gap-2">
            <VooDooCheck
              id={`public-${perfume.id}`}
              checked={isPublic}
              onChange={() => setIsPublic(!isPublic)}
              labelChecked={t("wishlist.itemCard.public")}
              labelUnchecked={t("wishlist.itemCard.private")}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleAddToWishlist}
              variant="icon"
              background="gold"
              size={"sm"}
              disabled={toggleWishlist.isPending}
            >
              {toggleWishlist.isPending ? t("common.adding") : t("singlePerfume.icons.addButton")}
            </Button>
            <Button
              onClick={() => setShowWishlistForm(false)}
              variant="icon"
              background="gold"
              size={"sm"}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
      <AddToCollectionModal type="icon" perfume={perfume} />
      {userRole === "admin" && (
        <div>
          <h2 className="text-lg font-semibold text-center text-noir-gold-500 mb-2">
            Admin
          </h2>
          <div className="flex flex-col items-center justify-between gap-2">
            <VooDooLink
              aria-label={`edit ${perfume.name}`}
              variant="icon"
              background={"gold"}
              size={"sm"}
              className="flex items-center justify-between gap-2"
              url={`/admin/perfume/${perfume.slug}/edit`}
            >
              <span>{t("singlePerfume.icons.editButton")}</span>
              <GrEdit size={22} />
            </VooDooLink>
            <Button
              onClick={() => {
                const buttonRef = { current: document.createElement("button") }
                toggleModal(buttonRef as any, "delete-perfume-item", "delete-perfume-item")
              }}
              aria-label={`delete ${perfume.name}`}
              variant="icon"
              className="flex items-center justify-between gap-2"
              background={"gold"}
              size={"sm"}
            >
              <span>{t("singlePerfume.icons.deleteButton")}</span>
              <MdDeleteForever size={22} />
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
export default PerfumeIcons

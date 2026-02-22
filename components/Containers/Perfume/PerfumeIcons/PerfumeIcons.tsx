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
import { useToggleWishlist } from "@/lib/mutations/wishlist"
import { useTranslations } from "next-intl"

const DELETE_MODAL_ID = "delete-perfume-item"
const ICON_BUTTON_CLASS = "flex items-center justify-between gap-2"

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

const IconLabel = ({
  label,
  icon: Icon,
  size = 20,
}: {
  label: string
  icon: React.ComponentType<{ size?: number }>
  size?: number
}) => (
  <div className={ICON_BUTTON_CLASS}>
    <span>{label}</span>
    <Icon size={size} />
  </div>
)

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
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const tCommon = useTranslations("common")
  const tIcons = useTranslations("singlePerfume")
  const tWishlist = useTranslations("wishlist.itemCard")
  const toggleWishlist = useToggleWishlist()

  useEffect(() => {
    setInWishlist(isInWishlist)
  }, [isInWishlist])

  const handleWishlistToggle = () => {
    if (inWishlist) {
      toggleWishlist.mutate(
        { perfumeId: perfume.id, action: "remove" },
        {
          onSuccess: () => {
            setInWishlist(false)
            setShowWishlistForm(false)
          },
          onError: error => console.error("Failed to remove from wishlist:", error),
        }
      )
    } else {
      setShowWishlistForm(true)
    }
  }

  const handleAddToWishlist = () => {
    toggleWishlist.mutate(
      { perfumeId: perfume.id, action: "add", isPublic },
      {
        onSuccess: () => {
          setInWishlist(true)
          setShowWishlistForm(false)
        },
        onError: error => console.error("Failed to add to wishlist:", error),
      }
    )
  }

  const wishlistAriaLabel = `${inWishlist ? tCommon("remove") : tCommon("add")} ${perfume.name} ${inWishlist ? "from" : "to"} wishlist`
  const isAdmin = userRole === "admin"

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
      <div className="grid grid-cols-1 gap-2 noir-border relative p-4">
        {!showWishlistForm ? (
          <Button
            onClick={handleWishlistToggle}
            variant="icon"
            background="gold"
            size="sm"
            disabled={toggleWishlist.isPending}
            aria-label={wishlistAriaLabel}
          >
            {inWishlist ? (
              <IconLabel label={tIcons("icons.inWishlist")} icon={BsHeartFill} />
            ) : (
              <IconLabel label={tIcons("icons.addButton")} icon={BsHearts} />
            )}
          </Button>
        ) : (
          <div className="space-y-2 p-3 bg-noir-dark/10 rounded-lg border border-noir-gold">
            <div className="flex items-center gap-2">
              <VooDooCheck
                id={`public-${perfume.id}`}
                checked={isPublic}
                onChange={() => setIsPublic(prev => !prev)}
                labelChecked={tWishlist("public")}
                labelUnchecked={tWishlist("private")}
              />
            </div>
            <div className="flex gap-2">
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
                onClick={() => setShowWishlistForm(false)}
                variant="icon"
                background="gold"
                size="sm"
              >
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        )}
        <AddToCollectionModal type="icon" perfume={perfume} />
        {isAdmin && (
          <div>
            <h2 className="text-lg font-semibold text-center text-noir-gold-500 mb-2">
              Admin
            </h2>
            <div className="flex flex-col items-center justify-between gap-2">
              <VooDooLink
                aria-label={`edit ${perfume.name}`}
                variant="icon"
                background="gold"
                size="sm"
                className={ICON_BUTTON_CLASS}
                url={`/admin/perfume/${perfume.slug}/edit`}
              >
                <IconLabel label={tIcons("icons.editButton")} icon={GrEdit} size={22} />
              </VooDooLink>
              <Button
                ref={deleteButtonRef}
                onClick={() => toggleModal(deleteButtonRef, DELETE_MODAL_ID)}
                aria-label={`delete ${perfume.name}`}
                variant="icon"
                className={ICON_BUTTON_CLASS}
                background="gold"
                size="sm"
              >
                <IconLabel label={tIcons("icons.deleteButton")} icon={MdDeleteForever} size={22} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default PerfumeIcons

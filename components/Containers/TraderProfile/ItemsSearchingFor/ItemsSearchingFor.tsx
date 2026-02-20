import { useTranslation } from "react-i18next"
import { BsHeartFill } from "react-icons/bs"

import { OptimizedImage } from "~/components/Atoms/OptimizedImage"

interface WishlistItem {
  id: string
  perfumeId: string
  isPublic: boolean
  createdAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    username: string
    email: string
  }
  perfume: {
    id: string
    name: string
    image?: string
    perfumeHouse?: {
      id: string
      name: string
    }
  }
}

interface ItemsSearchingForProps {
  wishlistItems: WishlistItem[]
}

const ItemsSearchingFor = ({ wishlistItems }: ItemsSearchingForProps) => {
  const { t } = useTranslation()

  if (wishlistItems.length === 0) {
    return (
      <div className="mt-6 px-2">
        <p className="text-noir-gold-100 italic">
          {t("traderProfile.noItemsSearchingFor")}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <ul className="space-y-4">
        {wishlistItems.map(item => (
          <li
            key={item.id}
            className="border bg-noir-gold/10 border-noir-gold rounded p-3 flex items-center gap-3 relative"
          >
            <div className="flex items-center gap-0.5">
              {item.perfume.image && (
                <OptimizedImage
                  src={item.perfume.image}
                  alt={item.perfume.name}
                  width={48}
                  height={48}
                  priority={false}
                  quality={70}
                  className="w-12 h-12 object-cover rounded"
                  sizes="48px"
                />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-noir-gold">{item.perfume.name}</h3>
              {item.perfume.perfumeHouse && (
                <p className="text-sm text-noir-gold-100">
                  by {item.perfume.perfumeHouse.name}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 absolute right-1 bottom-0">
              <p className="text-xs text-noir-gold-500">
                Added {new Date(item.createdAt).toLocaleDateString("en-US")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ItemsSearchingFor

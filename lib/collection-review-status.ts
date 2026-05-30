type CollectionPerfumeLike = {
  isPending?: boolean | null
}

type CollectionItemLike = {
  perfume?: CollectionPerfumeLike | null
}

export const isCollectionItemInReview = (item: CollectionItemLike | null | undefined): boolean =>
  item?.perfume?.isPending === true

import type { IconType } from "react-icons/lib"
import { LuX } from "react-icons/lu"

const iconMap = {
  x: LuX,
} as const satisfies Record<string, IconType>

export type IconName = keyof typeof iconMap

type IconProps = {
  name: IconName
}

export const Icon = ({ name }: IconProps) => {
  const Cmp = iconMap[name]
  return <Cmp aria-hidden className="inline-block shrink-0" />
}

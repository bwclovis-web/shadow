import type { Metadata } from "next"
import type { ReactNode } from "react"

/** Private account area — keep out of search indexes. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

const ProfileLayout = ({ children }: { children: ReactNode }) => children

export default ProfileLayout

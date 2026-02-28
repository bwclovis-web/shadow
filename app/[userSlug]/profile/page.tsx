import type { Metadata } from "next"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"

import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getUserByProfileSlug } from "@/models/user.query"
import { createSafeUser } from "@/utils/user"

import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"

type PageProps = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata> => {
  const { userSlug } = await params
  const user = await getUserByProfileSlug(userSlug)
  if (!user) return { title: "Profile | Not found" }
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.email
  return {
    title: `${name} | Profile`,
    description: `Profile for ${name}`,
  }
}

const ProfilePage = async ({ params }: PageProps) => {
  const { userSlug } = await params
  const user = await getUserByProfileSlug(userSlug)
  if (!user) notFound()

  const safeUser = createSafeUser(user)
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const isOwnProfile = session?.userId === user.id
  const displayName =
    [safeUser?.firstName, safeUser?.lastName].filter(Boolean).join(" ") ||
    safeUser?.username ||
    safeUser?.email ||
    "User"

  return (
    <article>
      <TitleBanner
        imagePos="object-center"
        image="/images/terms.webp"
        heading="Profile"
        subheading={displayName}
      />
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        {isOwnProfile && (
          <p className="text-noir-gold-100 text-lg">This is your profile page.</p>
        )}
        {!isOwnProfile && safeUser && (
          <p className="text-noir-gold-100 text-lg">
            Viewing profile for {safeUser.username || safeUser.email}.
          </p>
        )}
      </section>
    </article>
  )
}

export default ProfilePage

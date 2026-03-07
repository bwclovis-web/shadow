import { prisma } from '@/lib/db'
import { getAllFeatures } from '@/models/feature.server'
import HomeClient from './home-client'
import { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: "New Smell",
  description: "Discover and trade perfumes.",
}

const HomePage = async () => {
  const features = await getAllFeatures()
  const [userCount, houseCount, perfumeCount] = await Promise.all([
    prisma.user.count(),
    prisma.perfumeHouse.count(),
    prisma.perfume.count(),
  ])

  const counts = {
    users: userCount,
    houses: houseCount,
    perfumes: perfumeCount,
  }

  return (
    <HomeClient
      features={features}
      counts={counts}
    />
  )
}

export default HomePage
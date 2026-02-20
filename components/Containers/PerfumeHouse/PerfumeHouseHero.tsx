import { HeroHeader } from "~/components/Molecules/HeroHeader"
interface PerfumeHouseHeroProps {
  name: string
  image?: string | null
  transitionKey: string | number
  type: string
}


const PerfumeHouseHero = ({
  name,
  image,
  transitionKey,
  type
}: PerfumeHouseHeroProps) => (
  <HeroHeader
    title={name}
    type="house"
    image={ image}
    transitionKey={transitionKey}
    viewTransitionName={`perfume-image-${transitionKey}`}
    titleClassName="text-noir-gold"
    imageWidth={900}
    imageHeight={600}
    imageQuality={85}
  />
)

export default PerfumeHouseHero



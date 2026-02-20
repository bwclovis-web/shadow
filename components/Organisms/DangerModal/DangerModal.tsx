import { Button } from "~/components/Atoms/Button"
interface DangerModalProps {
  heading: string
  description: string
  action: () => void
}

const DangerModal = ({ heading, description, action }: DangerModalProps) => (
  <div className="text-center mx-auto">
    <h2>{heading}</h2>
    <p className="text-noir-gold-100 text-xl">
      {description}
    </p>
    <Button
      className="bg-red-500 animate-pulse hover:bg-red-600 border-2 border-red-600 text-noir-light hover:animate-none focus:bg-red-700 disabled:bg-red-400 mt-4"
        onClick={() => action()}
        >
        Remove
      </Button>
  </div>
)
export default DangerModal

import { type FC } from "react"

interface SuccessMessageProps {
  message: string
}

const SuccessMessage: FC<SuccessMessageProps> = ({ message }) => (
  <div className="bg-green-50 border border-green-200 rounded-md p-4">
    <div className="flex">
      <div className="flex-shrink-0">
        <span className="text-green-400">✅</span>
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-green-800">Success</h3>
        <div className="mt-2 text-sm text-green-700">
          <p>{message}</p>
        </div>
      </div>
    </div>
  </div>
)

export default SuccessMessage

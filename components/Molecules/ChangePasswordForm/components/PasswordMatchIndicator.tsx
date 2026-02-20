import { type FC } from "react"

interface PasswordMatchIndicatorProps {
  confirmPassword: string
  newPassword: string
}

const PasswordMatchIndicator: FC<PasswordMatchIndicatorProps> = ({
  confirmPassword,
  newPassword,
}) => {
  const passwordsMatch = newPassword === confirmPassword

  if (!confirmPassword) {
    return null
  }

  return (
    <div className="mt-1 text-sm">
      {passwordsMatch ? (
        <span className="text-green-600 flex items-center space-x-1">
          <span>✅</span>
          <span>Passwords match</span>
        </span>
      ) : (
        <span className="text-red-600 flex items-center space-x-1">
          <span>❌</span>
          <span>Passwords do not match</span>
        </span>
      )}
    </div>
  )
}

export default PasswordMatchIndicator

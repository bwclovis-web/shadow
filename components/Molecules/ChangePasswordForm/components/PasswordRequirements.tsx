import { type FC } from "react"

const PasswordRequirements: FC = () => (
  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
    <h4 className="text-sm font-medium text-blue-800 mb-2">
      Password Requirements:
    </h4>
    <ul className="text-sm text-blue-700 space-y-1">
      <li>• At least 8 characters long</li>
      <li>• Contains uppercase and lowercase letters</li>
      <li>• Contains at least one number</li>
      <li>• Contains at least one special character (!@#$%^&*)</li>
      <li>• No spaces allowed</li>
      <li>• Different from your current password</li>
    </ul>
  </div>
)

export default PasswordRequirements

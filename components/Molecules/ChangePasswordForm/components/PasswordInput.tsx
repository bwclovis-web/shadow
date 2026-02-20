import { type FC } from "react"

interface PasswordInputProps {
  id: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  showPassword: boolean
  onToggleVisibility: () => void
  hasError?: boolean
  required?: boolean
}

const PasswordInput: FC<PasswordInputProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder,
  showPassword,
  onToggleVisibility,
  hasError = false,
  required = false,
}) => (
  <div className="relative">
    <input
      type={showPassword ? "text" : "password"}
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
        hasError
          ? "border-red-300 focus:ring-red-500 focus:border-red-500"
          : "border-gray-300"
      }`}
      placeholder={placeholder}
      required={required}
    />
    <button
      type="button"
      onClick={onToggleVisibility}
      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
    >
      {showPassword ? "🙈" : "👁️"}
    </button>
  </div>
)

export default PasswordInput

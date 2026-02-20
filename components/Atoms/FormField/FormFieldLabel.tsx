import { type ReactNode } from "react"

export interface FormFieldLabelProps {
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

const FormFieldLabel = ({
  label,
  required = false,
  disabled = false,
  className = "",
}: FormFieldLabelProps): ReactNode => {
  if (!label) {
    return null
  }

  return (
    <label
      className={`
        block text-sm font-medium text-noir-gold-100
        ${required ? 'after:content-["*"] after:ml-1 after:text-red-500' : ""}
        ${disabled ? "text-gray-400" : ""}
        ${className}
      `}
    >
      {label}
    </label>
  )
}

export default FormFieldLabel


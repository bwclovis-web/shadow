import { type ReactNode } from "react"

export interface FormFieldLabelProps {
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
  /** Associates the label with a control (`id` on the control). */
  htmlFor?: string
  /** Stable id for `aria-labelledby` when `htmlFor` cannot be resolved. */
  id?: string
}

const FormFieldLabel = ({
  label,
  required = false,
  disabled = false,
  className = "",
  htmlFor,
  id,
}: FormFieldLabelProps): ReactNode => {
  if (!label) {
    return null
  }

  return (
    <label
      id={id}
      htmlFor={htmlFor}
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


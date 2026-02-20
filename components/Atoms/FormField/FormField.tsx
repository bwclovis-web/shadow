import { cloneElement, forwardRef, type ReactElement, type ReactNode } from "react"

import ValidationMessage from "../ValidationMessage/ValidationMessage"
import FormFieldLabel from "./FormFieldLabel"
import { getAriaDescribedBy, getFieldStateClasses } from "./utils"
import ValidationIcon from "./ValidationIcon"

export interface FormFieldProps {
  label?: string
  error?: string
  success?: string
  warning?: string
  info?: string
  required?: boolean
  disabled?: boolean
  className?: string
  labelClassName?: string
  fieldClassName?: string
  children: ReactNode
  helpText?: string
  showValidationIcon?: boolean
}

const FormField = forwardRef<HTMLDivElement, FormFieldProps>((
    {
      label,
      error,
      success,
      warning,
      info,
      required = false,
      disabled = false,
      className = "",
      labelClassName = "",
      fieldClassName = "",
      children,
      helpText,
      showValidationIcon = true,
    },
    ref
  ) => {
    const hasError = !!error
    const hasSuccess = !!success
    const hasWarning = !!warning
    const hasInfo = !!info

    const fieldStateClasses = getFieldStateClasses({
      hasError,
      hasSuccess,
      hasWarning,
      hasInfo,
      disabled,
    })

    const ariaDescribedBy = 
      getAriaDescribedBy(error, helpText, success, warning, info)

    const shouldShowValidationIcon =
      showValidationIcon && (hasError || hasSuccess || hasWarning || hasInfo)

    const childElement = children as ReactElement<{
      className?: string
      disabled?: boolean
      "aria-invalid"?: boolean
      "aria-describedby"?: string
    }>

    return (
      <div ref={ref} className={`space-y-1 ${className}`}>
        <FormFieldLabel
          label={label}
          required={required}
          disabled={disabled}
          className={labelClassName}
        />

        <div className={`relative ${fieldClassName}`}>
          {cloneElement(childElement, {
            className: `${childElement.props.className || ""} ${fieldStateClasses}`,
            disabled,
            "aria-invalid": hasError,
            "aria-describedby": ariaDescribedBy,
          })}

          {shouldShowValidationIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ValidationIcon 
                error={error} success={success} warning={warning} info={info} />
            </div>
          )}
        </div>

        {helpText && (
          <p id="help-text" className="text-sm text-noir-gold-500">
            {helpText}
          </p>
        )}

        <ValidationMessage
          error={error}
          success={success}
          warning={warning}
          info={info}
          size="sm"
        />
      </div>
    )
  })

FormField.displayName = "FormField"

export default FormField

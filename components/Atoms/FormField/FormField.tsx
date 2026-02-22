import {
  cloneElement,
  forwardRef,
  useId,
  type ReactElement,
  type ReactNode,
} from "react"

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

type ChildProps = {
  className?: string
  disabled?: boolean
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  (
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
    const helpTextId = useId()
    const state = {
      hasError: !!error,
      hasSuccess: !!success,
      hasWarning: !!warning,
      hasInfo: !!info,
      disabled,
    }
    const fieldStateClasses = getFieldStateClasses(state)
    const ariaDescribedBy = getAriaDescribedBy(
      error,
      helpText ? helpTextId : undefined,
      success,
      warning,
      info
    )
    const shouldShowValidationIcon =
      showValidationIcon &&
      (state.hasError || state.hasSuccess || state.hasWarning || state.hasInfo)

    const childElement = children as ReactElement<ChildProps>
    const mergedClassName = [childElement.props.className, fieldStateClasses]
      .filter(Boolean)
      .join(" ")

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
            className: mergedClassName,
            disabled,
            "aria-invalid": state.hasError,
            "aria-describedby": ariaDescribedBy,
          })}

          {shouldShowValidationIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ValidationIcon
                error={error}
                success={success}
                warning={warning}
                info={info}
              />
            </div>
          )}
        </div>

        {helpText && (
          <p id={helpTextId} className="text-sm text-noir-gold-500">
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
  }
)

FormField.displayName = "FormField"

export default FormField

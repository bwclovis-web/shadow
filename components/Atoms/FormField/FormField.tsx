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
  "aria-labelledby"?: string
  inputId?: string
  selectId?: string
  id?: string
  action?: { id?: string }
}

const getControlIdFromChild = (child: ReactElement<ChildProps>): string | undefined => {
  const p = child.props
  if (typeof p.inputId === "string" && p.inputId.length > 0) return p.inputId
  if (typeof p.selectId === "string" && p.selectId.length > 0) return p.selectId
  if (typeof p.id === "string" && p.id.length > 0) return p.id
  const aid = p.action?.id
  if (typeof aid === "string" && aid.length > 0) return aid
  return undefined
}

const mergeAriaLabelledBy = (
  existing: string | undefined,
  addition: string | undefined
): string | undefined => {
  if (!addition) return existing
  if (!existing) return addition
  return `${addition} ${existing}`
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
    const labelFallbackId = useId()
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

    const controlId = getControlIdFromChild(childElement)
    const useLabelledByFallback = Boolean(label) && !controlId

    return (
      <div ref={ref} className={`space-y-1 ${className}`}>
        <FormFieldLabel
          label={label}
          required={required}
          disabled={disabled}
          className={labelClassName}
          htmlFor={label && controlId ? controlId : undefined}
          id={useLabelledByFallback ? labelFallbackId : undefined}
        />

        <div className={`relative ${fieldClassName}`}>
          {cloneElement(childElement, {
            className: mergedClassName,
            disabled,
            "aria-invalid": state.hasError,
            "aria-describedby": ariaDescribedBy,
            ...(useLabelledByFallback
              ? {
                  "aria-labelledby": mergeAriaLabelledBy(
                    childElement.props["aria-labelledby"],
                    labelFallbackId
                  ),
                }
              : {}),
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

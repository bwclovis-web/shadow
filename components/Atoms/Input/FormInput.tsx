import { type FieldMetadata } from "@conform-to/react"
import { forwardRef } from "react"

import FormField from "../FormField/FormField"
import Input, { type InputProps } from "./Input"

export interface FormInputProps extends Omit<InputProps, "inputId"> {
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
  helpText?: string
  showValidationIcon?: boolean
  inputId?: string
  action?: FieldMetadata<unknown>
  actionData?: {
    errors?: { [key: string]: string }
  }
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
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
      helpText,
      showValidationIcon = true,
      inputId,
      action,
      actionData,
      ...inputProps
    },
    ref
  ) => {
    // Extract error from Conform action.errors or actionData if available
    const conformError = action?.errors?.[0]
    const actionDataError = actionData?.errors?.[action?.name || ""]
    const fieldError = error || conformError || actionDataError

    return (
      <FormField
        label={label}
        error={fieldError}
        success={success}
        warning={warning}
        info={info}
        required={required}
        disabled={disabled}
        className={className}
        labelClassName={labelClassName}
        fieldClassName={fieldClassName}
        helpText={helpText}
        showValidationIcon={showValidationIcon}
      >
        <Input
          ref={ref}
          inputId={inputId}
          action={action}
          actionData={actionData}
          disabled={disabled}
          {...inputProps}
        />
      </FormField>
    )
  }
)

FormInput.displayName = "FormInput"

export default FormInput


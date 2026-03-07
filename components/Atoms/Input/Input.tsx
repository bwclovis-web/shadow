import { type FieldMetadata, getInputProps } from "@conform-to/react"
import { type VariantProps } from "class-variance-authority"
import { forwardRef, useId, type HTMLProps, type RefObject } from "react"

import { styleMerge } from "@/utils/styleUtils"

import { inputVariants } from "./input-variants"

export interface InputProps
  extends Omit<HTMLProps<HTMLInputElement>, "action" | "type">,
    VariantProps<typeof inputVariants> {
  inputType?: "email" | "password" | "text" | "number" | "tel" | "url" | "search" | "date" | "datetime-local" | "file" | "month" | "range" | "time" | "week"
  inputId?: string
  label?: string
  placeholder?: string
  shading?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  action?: FieldMetadata<string, Record<string, unknown>, unknown>
  actionData?: {
    errors?: { [key: string]: string }
  }
  autoComplete?: string
}

const resolveAutoComplete = (
  inputType: InputProps["inputType"],
  autoComplete?: string
): string | undefined =>
  autoComplete ??
  (inputType === "password" ? "current-password" : inputType === "email" ? "email" : undefined)

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      inputType = "text",
      inputId,
      label,
      className,
      defaultValue,
      value,
      actionData,
      action,
      placeholder,
      shading,
      autoComplete,
      inputRef,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const resolvedAutoComplete = resolveAutoComplete(inputType, autoComplete)
    const resolvedId = inputId ?? action?.id ?? (label ? generatedId : undefined)
    const inputProps = action
      ? {
          ...getInputProps(action, { ariaAttributes: true, type: inputType }),
          id: resolvedId,
          placeholder,
          autoComplete: resolvedAutoComplete,
        }
      : {
          id: resolvedId,
          type: inputType,
          placeholder,
          autoComplete: resolvedAutoComplete,
        }

    const setRef = (el: HTMLInputElement | null) => {
      if (typeof ref === "function") ref(el)
      else if (ref) ref.current = el
      if (inputRef) inputRef.current = el
    }

    const controlled = value !== undefined
    const inputPropsWithValue = inputProps as Record<string, unknown> & {
      value?: unknown
      defaultValue?: string | number | readonly string[] | undefined
    }
    const { value: _v, defaultValue: conformDefault, ...restInputProps } = inputPropsWithValue
    const resolvedDefault =
      defaultValue ?? conformDefault ?? ""
    const valueProps = controlled
      ? { value }
      : {
          defaultValue:
            typeof resolvedDefault === "string" ||
            typeof resolvedDefault === "number" ||
            Array.isArray(resolvedDefault)
              ? resolvedDefault
              : "",
        }

    const inputElement = (
      <input
        ref={setRef}
        name={action?.name}
        aria-invalid={actionData?.errors?.[action?.name ?? ""] ? true : undefined}
        className={styleMerge(inputVariants({ shading }), className)}
        data-testid="Input"
        {...(restInputProps as Omit<HTMLProps<HTMLInputElement>, "value" | "defaultValue">)}
        {...valueProps}
        {...props}
      />
    )

    if (label !== undefined) {
      return (
        <div className="flex flex-col gap-1" data-input-has-label>
          <label
            htmlFor={inputProps.id}
            className="block text-sm font-medium text-noir-gold-100"
          >
            {label}
          </label>
          {inputElement}
        </div>
      )
    }

    return inputElement
  }
)

Input.displayName = "Input"

export default Input

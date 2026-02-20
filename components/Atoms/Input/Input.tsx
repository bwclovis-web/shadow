import { type FieldMetadata, getInputProps } from "@conform-to/react"
import { type VariantProps } from "class-variance-authority"
import { forwardRef, type HTMLProps, type RefObject } from "react"

import { styleMerge } from "~/utils/styleUtils"

import { inputVariants } from "./input-variants"

interface InputProps
  extends Omit<HTMLProps<HTMLInputElement>, "action" | "type">,
    VariantProps<typeof inputVariants> {
  inputType?: "email" | "password" | "text" | "number" | "tel" | "url" | "search" | "date" | "datetime-local" | "file" | "month" | "range" | "time" | "week"
  inputId?: string
  placeholder?: string
  shading?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  action?: FieldMetadata<unknown>
  actionData?: {
    errors?: { [key: string]: string }
  }
  autoComplete?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      inputType = "text",
      inputId,
      className,
      defaultValue,
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
    const inputProps = action
      ? {
          ...getInputProps(action, { ariaAttributes: true, type: inputType }),
          id: inputId || action.id,
          placeholder,
          autoComplete:
            autoComplete ||
            (inputType === "password"
              ? "current-password"
              : inputType === "email"
              ? "email"
              : undefined),
        }
      : {
          id: inputId,
          type: inputType,
          placeholder,
          autoComplete:
            autoComplete ||
            (inputType === "password"
              ? "current-password"
              : inputType === "email"
              ? "email"
              : undefined),
        }

    const setRef = (el: HTMLInputElement | null) => {
      if (typeof ref === "function") ref(el)
      else if (ref) ref.current = el
      if (inputRef) inputRef.current = el
    }

    return (
      <input
        ref={setRef}
        name={action?.name}
        defaultValue={defaultValue ?? ""}
        aria-invalid={actionData?.errors?.[action?.name || ""] ? true : undefined}
        className={styleMerge(inputVariants({ shading }), className)}
        data-testid="Input"
        {...inputProps}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export default Input

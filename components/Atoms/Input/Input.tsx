import { type FieldMetadata, getInputProps } from "@conform-to/react"
import { type VariantProps } from "class-variance-authority"
import { forwardRef, useId, useState, type HTMLProps, type RefObject } from "react"
import { BsFillEyeFill, BsFillEyeSlashFill } from "react-icons/bs"

import { Button } from "@/components/Atoms/Button"
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
  helpText?: string
  passwordToggle?: boolean
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
      helpText,
      passwordToggle = false,
      ...props
    },
    ref
  ) => {
    const [passwordVisible, setPasswordVisible] = useState(false)
    const generatedId = useId()
    const resolvedAutoComplete = resolveAutoComplete(inputType, autoComplete)
    const resolvedId = inputId ?? action?.id ?? (label ? generatedId : undefined)
    const resolvedInputType =
      passwordToggle && inputType === "password"
        ? passwordVisible
          ? "text"
          : "password"
        : inputType
    const inputProps = action
      ? {
          ...getInputProps(action, { ariaAttributes: true, type: resolvedInputType }),
          id: resolvedId,
          placeholder,
          autoComplete: resolvedAutoComplete,
        }
      : {
          id: resolvedId,
          type: resolvedInputType,
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
        aria-invalid={actionData?.errors?.[action?.name ?? ""] ? true : undefined}
        className={styleMerge(
          inputVariants({ shading }),
          passwordToggle && "pr-10",
          className
        )}
        data-testid="Input"
        {...(restInputProps as Omit<HTMLProps<HTMLInputElement>, "value" | "defaultValue">)}
        {...valueProps}
        {...props}
        name={action?.name ?? (props as { name?: string }).name}
      />
    )

    const inputWithToggle = passwordToggle ? (
      <div className="relative">
        {inputElement}
        <Button
          type="button"
          variant="icon"
          className="absolute inset-y-0 right-0 flex h-full w-auto items-center border-none bg-transparent px-2 text-noir-dark/60 hover:text-noir-dark right-2"
          onClick={() => setPasswordVisible((visible) => !visible)}
          aria-label={passwordVisible ? "Hide password" : "Show password"}
        >
          {passwordVisible ? <BsFillEyeSlashFill /> : <BsFillEyeFill />}
        </Button>
      </div>
    ) : (
      inputElement
    )

    if (label !== undefined) {
      return (
        <div className="flex flex-col gap-1" data-input-has-label>
          <label
            htmlFor={resolvedId}
            className="block text-sm font-medium text-noir-gold-100"
          >
            {label}
          </label>
          {inputWithToggle}
          {helpText && <p className="text-noir-gold-100 text-xs ml-1" role="note">{helpText}</p>}
        </div>
      )
    }

    return inputWithToggle
  }
)

Input.displayName = "Input"

export default Input

import type { VariantProps } from "class-variance-authority"
import type { HTMLProps } from "react"

import { styleMerge } from "~/utils/styleUtils"

import {
  checkboxInputVariants,
  checkboxLabelVariants,
  checkboxVariants,
} from "./checkbox-variants"

interface CheckBoxProps
  extends Omit<HTMLProps<HTMLDivElement>, "onChange">,
    VariantProps<typeof checkboxVariants> {
  inputType?: VariantProps<typeof checkboxInputVariants>["inputType"]
  labelSize?: VariantProps<typeof checkboxLabelVariants>["labelSize"]
  htmlLabel?: string
  checked?: boolean
  onChange?: () => void
}

const CheckBox = ({
  className,
  defaultChecked,
  checked,
  onChange,
  label,
  htmlLabel,
  labelPosition,
  labelSize,
  value,
  inputType,
  id,
  name,
  ...props
}: CheckBoxProps) => {
  const inputId = id || label
  return (
    <div
      className={styleMerge(checkboxVariants({ className, labelPosition }))}
      data-cy="CheckBox"
      {...props}
    >
      <label
        className={styleMerge(checkboxLabelVariants({ labelSize }))}
        aria-label="group"
        htmlFor={inputId}
      >
        {htmlLabel ? <div dangerouslySetInnerHTML={{ __html: htmlLabel }} /> : label}
      </label>
      <input
        className={styleMerge(checkboxInputVariants({ inputType }))}
        type="checkbox"
        id={inputId}
        name={name}
        aria-describedby=""
        checked={checked !== undefined ? checked : defaultChecked}
        onChange={onChange}
        value={value}
      />
    </div>
  )
}
export default CheckBox

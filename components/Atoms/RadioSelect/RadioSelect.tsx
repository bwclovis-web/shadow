import { type VariantProps } from "class-variance-authority"
import { type ChangeEvent } from "react"

import { styleMerge } from "~/utils/styleUtils"

import { radioSelectVariants } from "./radioSelect-variants"

interface RadioSelectProps extends VariantProps<typeof radioSelectVariants> {
  handleRadioChange: (evt: ChangeEvent<HTMLInputElement>) => void
  data: any[]
  className?: string
}

const RadioSelect = ({ className, data, handleRadioChange }: RadioSelectProps) => (
  <div className="flex gap-2 flex-wrap">
    {data?.map(item => (
      <div key={item.id} className={styleMerge(radioSelectVariants({ className }))}>
        <input
          type="radio"
          value={item.value}
          defaultChecked={item.defaultChecked}
          onChange={handleRadioChange}
          name={item.name}
          id={item.id}
          className="hidden peer"
        />
        <label
          className="inline-flex items-center justify-between w-full py-1 px-3 text-noir-dark bg-noir-gray/80 border-2 border-noir-dark/80 rounded-md cursor-pointer dark:hover:text-gray-300 dark:border-noir-blue/80 dark:peer-checked:text-noir-light peer-checked:border-noir-gold peer-checked:bg-noir-blue dark:peer-checked:border-noir-light/80 peer-checked:text-noir-gold hover:text-gray-600 hover:bg-noir-gold/60 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700"
          htmlFor={item.id}
        >
          {item.label}
        </label>
      </div>
    ))}
  </div>
)
export default RadioSelect

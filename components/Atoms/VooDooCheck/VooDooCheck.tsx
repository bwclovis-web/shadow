interface VooDooCheckProps {
  checked: boolean
  onChange: () => void
  labelChecked: string
  labelUnchecked: string
  id?: string
}

const VooDooCheck = ({
  checked,
  onChange,
  labelChecked,
  labelUnchecked,
  id,
}: VooDooCheckProps) => (
  <label className="flex cursor-pointer select-none items-center">
    <div className="relative rounded-full border-noir-gold-100 border-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <div
        className={`box block h-8 w-14 rounded-full ${
          checked ? "bg-noir-gold-100" : "bg-noir-black"
        }`}
      />
      <div
        className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-300 ease-in-out
          ${checked ? "bg-noir-gold-500" : "bg-noir-gray"}
          ${checked ? "translate-x-6" : "translate-x-0"}
          ${checked ? "border-noir-gold-100 border-2" : "border-noir-black border-2"}`}
      />
    </div>
    <span className="text-sm font-medium text-noir-gold-100 ml-2">
      {checked ? labelChecked : labelUnchecked}
    </span>
  </label>
)

export default VooDooCheck

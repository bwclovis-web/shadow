interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

export const Field = ({ label, hint, children }: FieldProps) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-foreground">{label}</label>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    {children}
  </div>
)

export const inputClass = (extra = "") =>
  `w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${extra}`

interface IconLabelProps {
  label: string
  icon: React.ComponentType<{ size?: number }>
  size?: number
  className?: string
}

export const IconLabel = ({
    label,
    icon: Icon,
    size = 20,
    className = "",
  }: IconLabelProps) => (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <span>{label}</span>
      <Icon size={size} />
    </div>
  )
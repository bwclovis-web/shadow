import { useCSRF } from "~/hooks/useCSRF"

interface CSRFTokenProps {
  name?: string
}

export const CSRFToken = ({ name = "_csrf" }: CSRFTokenProps) => {
  const { csrfToken, isLoading } = useCSRF()

  if (isLoading || !csrfToken) {
    return null
  }

  return <input type="hidden" name={name} value={csrfToken} />
}

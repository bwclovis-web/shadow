const USER_PERFUMES_API = "/api/user-perfumes"

export type DecantListingResponse = {
  success?: boolean
  userPerfume?: Record<string, unknown>
  error?: string
  errorCode?: string
}

export const postDecantListingAmount = async (
  params: {
    userPerfumeId: string
    perfumeId: string
    amount: string
    resumePaused?: boolean
  },
  addToFormData: (formData: FormData) => void
): Promise<DecantListingResponse> => {
  const formData = new FormData()
  formData.append("action", "decant")
  formData.append("userPerfumeId", params.userPerfumeId)
  formData.append("perfumeId", params.perfumeId)
  formData.append("amount", params.amount)
  if (params.resumePaused) {
    formData.append("resumePaused", "true")
  }
  addToFormData(formData)

  const res = await fetch(USER_PERFUMES_API, {
    method: "POST",
    body: formData,
    credentials: "include",
  })
  return (await res.json()) as DecantListingResponse
}

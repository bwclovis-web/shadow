import { z } from "zod"

export const ContactTraderSchema = z.object({
  recipientId: z.string().min(1, "Recipient is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
})

export type ContactTraderFormData = z.infer<typeof ContactTraderSchema>

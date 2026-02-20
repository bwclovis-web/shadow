import { prisma } from "@/lib/db"

export interface CreateContactMessageInput {
  senderId: string
  recipientId: string
  subject: string | null
  message: string
}

export async function createContactMessage(input: CreateContactMessageInput) {
  const { senderId, recipientId, subject, message } = input

  if (senderId === recipientId) {
    throw new Error("Cannot send message to yourself")
  }

  // Verify sender exists
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true },
  })

  if (!sender) {
    throw new Error("Sender not found")
  }

  // Verify recipient exists
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  })

  if (!recipient) {
    throw new Error("Recipient trader not found")
  }

  // Create the contact message
  return await prisma.traderContactMessage.create({
    data: {
      senderId,
      recipientId,
      subject,
      message,
    },
  })
}

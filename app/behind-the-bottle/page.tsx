import { redirect } from "next/navigation"

/** Legacy route - redirect to /houses (Behind the Bottle) */
export default function BehindTheBottlePage() {
  redirect("/houses")
}

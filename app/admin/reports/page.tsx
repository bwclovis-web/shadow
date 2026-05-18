import { redirect } from "next/navigation"

const AdminReportsRedirectPage = () => {
  redirect("/admin/disputes?tab=profile")
}

export default AdminReportsRedirectPage

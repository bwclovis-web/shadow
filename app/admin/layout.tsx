import { requireAdminSession } from "@/utils/requireAdmin.server"

import { ADMIN_PATH } from "@/constants/routes"

type AdminLayoutProps = {
  children: React.ReactNode
}

/**
 * Protects all routes under /admin. Requires an authenticated admin session;
 * redirects to sign-in or unauthorized when not allowed.
 * Individual pages do not need to call requireAdminSession.
 */
const AdminLayout = async ({ children }: AdminLayoutProps) => {
  await requireAdminSession(ADMIN_PATH)
  return <>{children}</>
}

export default AdminLayout

import { useTranslations } from "next-intl"
import { RiLogoutBoxRLine } from "react-icons/ri"

import { Button } from "@/components/Atoms/Button/Button"
//import { clearCacheOnLogout } from "@/utils/cacheManagement"

const LogoutButton = () => {
  const t = useTranslations("navigation")
  
  const handleSubmit = () => {
    // Clear cache before logout redirect
    // clearCacheOnLogout()
    // Form will continue with default submission
    console.log("LogoutButton")
  }
  
  return (
    <form method="post" action="/api/log-out" onSubmit={handleSubmit}>
      <Button
        variant="icon"
        type="submit"
        aria-label={t("logout")}
        className="bg-noir-light hover:bg-noir-dark hover:text-noir-light rounded-full p-2 transition-colors duration-300 text-noir-black"
      >
        <RiLogoutBoxRLine size={20} />
      </Button>
    </form>
  )
}
export default LogoutButton

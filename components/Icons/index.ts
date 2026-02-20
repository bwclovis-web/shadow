/**
 * Icon barrel file - consolidates all icon imports for better tree-shaking
 * 
 * This file re-exports only the icons used in the app, which helps Vite's
 * tree-shaking to eliminate unused icons and reduce bundle size.
 * 
 * Instead of importing from react-icons/* in each file, import from this barrel:
 * 
 * Before: import { MdDeleteForever } from "react-icons/md"
 * After:  import { MdDeleteForever } from "~/components/Icons"
 */

// Material Design Icons (md)
export { MdDeleteForever, MdDelete, MdEdit, MdAdd, MdLibraryAdd } from "react-icons/md"

// Lucide Icons (lu)
export { LuSearch, LuX, LuBadge, LuBadgeAlert, LuBadgeCheck } from "react-icons/lu"

// Ionicons (io)
export { IoMdCloseCircle } from "react-icons/io"

// Font Awesome (fa, fa6)
export { FaChevronDown, FaStar, FaBars, FaHeart } from "react-icons/fa"
export { FaUser } from "react-icons/fa6"

// Bootstrap Icons (bs)
export { 
  BsFillEyeFill, 
  BsFillEyeSlashFill,
  BsBell,
  BsEnvelope,
  BsGear,
  BsX,
  BsHeartFill,
  BsHearts
} from "react-icons/bs"

// Game Icons (gi)
export { GiTrade, GiSpiralBottle } from "react-icons/gi"

// Grommet Icons (gr)
export { GrEdit } from "react-icons/gr"

// Ant Design Icons (ai)
export { AiFillHome } from "react-icons/ai"

// Remix Icons (ri)
export { RiLogoutBoxRLine } from "react-icons/ri"

// Feather Icons (fi)
export { FiAlertCircle, FiCheckCircle, FiInfo } from "react-icons/fi"

/** Barrel re-exports — prefer domain modules for new code. See docs/architecture.md */
export {
  getAllUsers,
  getUserByEmail,
  getUserById,
  getUserByName,
} from "./user.query"

export {
  FreeSignupLimitReachedError,
  type CreateUserOptions,
  createUser,
  getPublicTraderById,
  getTraderById,
  type SignInCustomerResult,
  signInCustomer,
  changePassword,
  checkPasswordStrength,
} from "./user-profile.server"

export {
  getUserPerfumes,
  getUserCollectionOrDestashPerfumeIds,
  getUserPerfumeById,
  findUserPerfume,
  addUserPerfume,
  createDestashEntry,
  removeUserPerfume,
  updateAvailableAmount,
  updateUserPerfumeAmount,
} from "./user-inventory.server"

export {
  addPerfumeComment,
  updatePerfumeComment,
  deletePerfumeComment,
  getUserPerfumeComments,
  getCommentsByUserPerfumeId,
  getPublicPerfumeComments,
} from "./user-comments.server"


import { getUserDisplayName } from "~/utils/user"

interface WishListAvailabilityInfoI {
  userPerfumes: any[]
  availableAmount: number
  perfumeName: string
}

const WishListAvailabilityInfo = ({
  userPerfumes,
  availableAmount,
  perfumeName,
}: WishListAvailabilityInfoI) => (
  <div className="mb-4 p-3 bg-green-100 dark:bg-green-800/30 rounded-lg border border-green-200 dark:border-green-700">
    <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
      Available from {userPerfumes.length} seller
      {userPerfumes.length > 1 ? "s" : ""}:
    </h4>
    {userPerfumes.map((userPerfume: any) => (
      <div
        key={userPerfume.id}
        className="flex justify-between items-center text-sm mb-1"
      >
        <div>
          <span className="font-medium text-green-700 dark:text-green-300">
            {getUserDisplayName(userPerfume.user)}
          </span>
          <span className="text-green-600 dark:text-green-400 ml-2">
            ({userPerfume.available}ml available)
          </span>
        </div>
        <a
          href={`mailto:${userPerfume.user.email}?subject=Interest in ${perfumeName}&body=Hi! I saw that you have ${perfumeName} available for decanting in the trading post. I'm interested in purchasing some. Please let me know the details!`}
          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 underline"
        >
          Contact
        </a>
      </div>
    ))}
    <div className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
      Total: {availableAmount}ml available
    </div>
  </div>
)

export default WishListAvailabilityInfo

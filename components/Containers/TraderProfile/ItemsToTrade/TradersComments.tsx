import type { Comment } from "~/types/comments"

interface TradersCommentsProps {
  comments: Comment[]
}

const TradersComments = ({ comments }: TradersCommentsProps) => (
  <ul className="space-y-2">
    {comments.map(comment => (
      <li
        key={comment.id}
        className="text-sm p-2 rounded border-l-4 border-noir-gold-500 bg-noir-gold/10"
      >
        <div className="flex justify-between items-start mb-1">
          <span className="text-xs text-noir-gold-100">
            {new Date(comment.createdAt).toLocaleDateString("en-US")}
          </span>
          <span className="text-xs text-noir-gold-500 bg-noir-gold/20 px-2 py-1 rounded">
            Public
          </span>
        </div>
        <p className="text-noir-gold text-base">{comment.comment}</p>
      </li>
    ))}
  </ul>
)

export default TradersComments

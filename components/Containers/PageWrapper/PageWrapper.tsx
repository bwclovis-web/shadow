interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  isArticle?: boolean
}

const PageWrapper = ({ children, className, isArticle = false }: PageWrapperProps) => {
  const Tag = isArticle ? "article" : "section"

  return (
    <Tag className={`inner-container py-12 shadow-lg shadow-black bg-gradient-to-b from-noir-gold/8 to-noir-gold-100/5 via-noir-black noir-border my-4 rounded-sm ${className}`}>
      {children}
    </Tag>
  )
}

export default PageWrapper
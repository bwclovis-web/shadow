interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  isArticle?: boolean
}

const PageWrapper = ({ children, className, isArticle = false }: PageWrapperProps) => {
  const Tag = isArticle ? "article" : "section"

  return (
    <Tag className={`inner-container py-12 ${className}`}>
      {children}
    </Tag>
  )
}

export default PageWrapper
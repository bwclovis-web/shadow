import SignUpClient from "./SignUpClient"

export const ROUTE_PATH = "/sign-up"

export const metadata = {
  title: "Sign Up | New Smell",
  description: "Create your account.",
}

type PageProps = {
  searchParams: Promise<{ session_id?: string; email?: string }>
}

const SignUpPage = async ({ searchParams }: PageProps) => {
  const params = await searchParams
  const sessionId = params.session_id ?? null
  const email = params.email ?? null

  return (
    <SignUpClient sessionId={sessionId} prefillEmail={email} />
  )
}

export default SignUpPage

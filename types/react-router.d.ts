declare module "react-router" {
  import type { ReactNode } from "react"
  export function Form(props: { children: ReactNode; method?: string; action?: string; className?: string }): JSX.Element
  export function useActionData<T = unknown>(): T | undefined
  export function useFetcher<T = unknown>(): { data: T | undefined; state: string; Form: (props: { children: ReactNode }) => JSX.Element; load: (url: string) => void }
  export function NavLink(props: { to: string; children: ReactNode; className?: string | ((p: { isActive: boolean }) => string) }): JSX.Element
  export function MemoryRouter(props: { children: ReactNode }): JSX.Element
}

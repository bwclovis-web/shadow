"use client"

import { ViewTransitions } from "next-view-transitions"

/**
 * The provider must stay mounted: `next-view-transitions` links and routers
 * throw without it. Reduced motion is handled in `globals.css`.
 */
export const ViewTransitionsWrapper = ({
  children,
}: {
  children: React.ReactNode
}) => <ViewTransitions>{children}</ViewTransitions>

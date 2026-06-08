import { useSyncExternalStore } from 'react'

/**
 * Subscribe to a CSS media query. Mobile-first layouts can use min-width queries.
 */
export function useMediaQuery(query, serverFallback = false) {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onStoreChange)
      return () => media.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(query).matches,
    () => serverFallback,
  )
}

import { useEffect, useState } from 'react'

const RECENTLY_VIEWED_KEY = 'bom-store-recently-viewed'
const MAX_RECENTLY_VIEWED = 12

export function useRecentlyViewed() {
  const [viewedIds, setViewedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENTLY_VIEWED_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(viewedIds))
  }, [viewedIds])

  function addViewed(productId: string) {
    setViewedIds(current => [productId, ...current.filter(id => id !== productId)].slice(0, MAX_RECENTLY_VIEWED))
  }

  return { viewedIds, addViewed }
}

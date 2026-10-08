import { useCallback, useState } from 'react'
import { safeSessionStorageGetItem } from '@/lib/utils'

/** A `useState` that survives a window reload (but not closing the app). */
export function useSessionState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => safeSessionStorageGetItem<T>(key) ?? initial)

  const set = useCallback(
    (next: T) => {
      setValue(next)
      sessionStorage.setItem(key, JSON.stringify(next))
    },
    [key]
  )

  return [value, set]
}

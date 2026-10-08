import { useCallback, useState } from 'react'
import { safeSessionStorageGetItem } from '@/lib/utils'

/** `useState` que sobrevive a um recarregamento da janela (mas não a fechar o app). */
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

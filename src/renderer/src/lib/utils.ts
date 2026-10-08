import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Lê um JSON do sessionStorage; devolve `null` se não existir ou estiver corrompido. */
export function safeSessionStorageGetItem<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(key)
    return item === null ? null : (JSON.parse(item) as T)
  } catch {
    return null
  }
}

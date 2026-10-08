/** Agrupa gravações: só a última versão de cada chave é salva, depois de uma pausa. */
export function createSaver<T>(save: (key: string, value: T) => void, delay = 500) {
  const pending = new Map<string, { value: T; timer: ReturnType<typeof setTimeout> }>()

  const commit = (key: string): void => {
    const entry = pending.get(key)
    if (!entry) return
    clearTimeout(entry.timer)
    pending.delete(key)
    save(key, entry.value)
  }

  return {
    schedule(key: string, value: T): void {
      const previous = pending.get(key)
      if (previous) clearTimeout(previous.timer)
      pending.set(key, { value, timer: setTimeout(() => commit(key), delay) })
    },
    /** Grava tudo o que está esperando (ao fechar a janela, por exemplo). */
    flush(): void {
      for (const key of [...pending.keys()]) commit(key)
    }
  }
}

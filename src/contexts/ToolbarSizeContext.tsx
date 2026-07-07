import { createContext, useContext, type ReactNode } from 'react'
import { useToolbarSize } from '../hooks/useToolbarSize'

interface Ctx {
  toolbarSize: number
  setToolbarSize: (s: number) => void
  increaseToolbar: () => void
  decreaseToolbar: () => void
  resetToolbar: () => void
}

const ToolbarSizeContext = createContext<Ctx>({
  toolbarSize: 1, setToolbarSize: () => {}, increaseToolbar: () => {}, decreaseToolbar: () => {}, resetToolbar: () => {},
})

export function ToolbarSizeProvider({ children }: { children: ReactNode }) {
  const { toolbarSize, setToolbarSize, increaseToolbar, decreaseToolbar, resetToolbar } = useToolbarSize()
  return (
    <ToolbarSizeContext.Provider value={{ toolbarSize, setToolbarSize, increaseToolbar, decreaseToolbar, resetToolbar }}>
      {children}
    </ToolbarSizeContext.Provider>
  )
}

export function useToolbarSizeCtx() { return useContext(ToolbarSizeContext) }

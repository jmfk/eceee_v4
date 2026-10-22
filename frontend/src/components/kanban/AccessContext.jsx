import { createContext, useContext } from 'react'

export const KanbanAccessContext = createContext('')
export const useKanbanAccess = () => useContext(KanbanAccessContext)

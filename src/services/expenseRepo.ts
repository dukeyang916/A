import type { Expense } from '@/types/models'
import { storage } from './storage'

const KEY = 'expenses'

export const expenseRepo = {
  listByTrip(tripId: string): Expense[] {
    return storage
      .readCollection<Expense>(KEY)
      .filter((e) => e.tripId === tripId)
      .sort((a, b) => b.occurredAt - a.occurredAt)
  },
  get(id: string): Expense | undefined {
    return storage.readCollection<Expense>(KEY).find((e) => e._id === id)
  },
  save(expense: Expense): void {
    const all = storage.readCollection<Expense>(KEY)
    const index = all.findIndex((e) => e._id === expense._id)
    if (index >= 0) all[index] = expense
    else all.push(expense)
    storage.writeCollection(KEY, all)
  },
  remove(id: string): void {
    storage.writeCollection(
      KEY,
      storage.readCollection<Expense>(KEY).filter((e) => e._id !== id)
    )
  },
  removeByTrip(tripId: string): void {
    storage.writeCollection(
      KEY,
      storage.readCollection<Expense>(KEY).filter((e) => e.tripId !== tripId)
    )
  },
}

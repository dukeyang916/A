import type { Trip } from '@/types/models'
import { storage } from './storage'

const KEY = 'trips'

export const tripRepo = {
  list(): Trip[] {
    return storage
      .readCollection<Trip>(KEY)
      .filter((t) => !t.isArchived)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },
  listArchived(): Trip[] {
    return storage.readCollection<Trip>(KEY).filter((t) => t.isArchived)
  },
  get(id: string): Trip | undefined {
    return storage.readCollection<Trip>(KEY).find((t) => t._id === id)
  },
  save(trip: Trip): void {
    const all = storage.readCollection<Trip>(KEY)
    const index = all.findIndex((t) => t._id === trip._id)
    if (index >= 0) all[index] = trip
    else all.push(trip)
    storage.writeCollection(KEY, all)
  },
  remove(id: string): void {
    storage.writeCollection(
      KEY,
      storage.readCollection<Trip>(KEY).filter((t) => t._id !== id)
    )
  },
}

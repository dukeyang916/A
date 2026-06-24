import type { Member } from '@/types/models'
import { storage } from './storage'

const KEY = 'members'

export const memberRepo = {
  listByTrip(tripId: string): Member[] {
    return storage
      .readCollection<Member>(KEY)
      .filter((m) => m.tripId === tripId)
      .sort((a, b) => a.createdAt - b.createdAt)
  },
  get(id: string): Member | undefined {
    return storage.readCollection<Member>(KEY).find((m) => m._id === id)
  },
  save(member: Member): void {
    const all = storage.readCollection<Member>(KEY)
    const index = all.findIndex((m) => m._id === member._id)
    if (index >= 0) all[index] = member
    else all.push(member)
    storage.writeCollection(KEY, all)
  },
  remove(id: string): void {
    storage.writeCollection(
      KEY,
      storage.readCollection<Member>(KEY).filter((m) => m._id !== id)
    )
  },
  removeByTrip(tripId: string): void {
    storage.writeCollection(
      KEY,
      storage.readCollection<Member>(KEY).filter((m) => m.tripId !== tripId)
    )
  },
}

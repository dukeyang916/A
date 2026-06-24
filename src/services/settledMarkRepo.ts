import { storage } from './storage'

interface SettledMark {
  tripId: string
  fromMemberId: string
  toMemberId: string
}

const KEY = 'settledMarks'

function markKey(fromMemberId: string, toMemberId: string): string {
  return `${fromMemberId}->${toMemberId}`
}

// v1 简化：按"谁转给谁"这一对人标记已结清，不绑定具体金额。
// 如果后续新增支出导致这对人之间的转账金额变化，标记不会自动失效——
// 这是有意为之的简化，双向确认/金额敏感的精确对账留给 v1.x 协作版做。
export const settledMarkRepo = {
  listByTrip(tripId: string): Set<string> {
    const marks = storage.readCollection<SettledMark>(KEY).filter((m) => m.tripId === tripId)
    return new Set(marks.map((m) => markKey(m.fromMemberId, m.toMemberId)))
  },
  toggle(tripId: string, fromMemberId: string, toMemberId: string): void {
    const all = storage.readCollection<SettledMark>(KEY)
    const idx = all.findIndex(
      (m) => m.tripId === tripId && m.fromMemberId === fromMemberId && m.toMemberId === toMemberId
    )
    if (idx >= 0) all.splice(idx, 1)
    else all.push({ tripId, fromMemberId, toMemberId })
    storage.writeCollection(KEY, all)
  },
  markKey,
}

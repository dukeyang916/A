import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Trip } from '@/types/models'
import { expenseRepo } from '@/services/expenseRepo'
import { memberRepo } from '@/services/memberRepo'
import { tripRepo } from '@/services/tripRepo'
import { randomAvatarColor } from '@/utils/avatar'
import { createId } from '@/utils/id'
import { settleTrip } from '@/utils/settlement'

export interface TripSummary {
  totalAmount: number
  /** "我"的净余额：正数=该收，负数=该付，0=已平 */
  myNet: number
}

export interface CreateTripInput {
  name: string
  destinationName: string
  startDate: string
  endDate: string
  coverImage?: string
}

export const useTripListStore = defineStore('tripList', () => {
  const trips = ref<Trip[]>([])

  function refresh(): void {
    trips.value = tripRepo.list()
  }

  function createTrip(input: CreateTripInput): Trip {
    const now = Date.now()
    const trip: Trip = {
      _id: createId('trip'),
      name: input.name,
      destination: { name: input.destinationName },
      startDate: input.startDate,
      endDate: input.endDate,
      coverImage: input.coverImage,
      currency: 'CNY',
      creatorId: 'me',
      isPublic: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }
    tripRepo.save(trip)

    // 创建行程时自动把"我"加入成员列表，省掉一次额外操作
    memberRepo.save({
      _id: createId('member'),
      tripId: trip._id,
      name: '我',
      avatarColor: randomAvatarColor(),
      isMe: true,
      createdAt: now,
    })

    refresh()
    return trip
  }

  function removeTrip(id: string): void {
    tripRepo.remove(id)
    memberRepo.removeByTrip(id)
    expenseRepo.removeByTrip(id)
    refresh()
  }

  function archiveTrip(id: string, archived = true): void {
    const trip = tripRepo.get(id)
    if (!trip) return
    trip.isArchived = archived
    trip.updatedAt = Date.now()
    tripRepo.save(trip)
    refresh()
  }

  /** 首页卡片用：总花费 + "我"的净余额，不需要进入行程详情就能一眼看出该收还是该付 */
  function getTripSummary(tripId: string): TripSummary {
    const members = memberRepo.listByTrip(tripId)
    const expenses = expenseRepo.listByTrip(tripId)
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
    const me = members.find((m) => m.isMe)
    if (!me) return { totalAmount, myNet: 0 }
    const { balances } = settleTrip(expenses, members)
    const myNet = balances.find((b) => b.memberId === me._id)?.net ?? 0
    return { totalAmount, myNet }
  }

  return { trips, refresh, createTrip, removeTrip, archiveTrip, getTripSummary }
})

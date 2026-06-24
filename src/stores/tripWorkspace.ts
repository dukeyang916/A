import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  Expense,
  ExpenseCategory,
  ExpenseSource,
  ExpenseSplit,
  Member,
  SplitMethod,
  Trip,
} from '@/types/models'
import { createShare, pullShare, pushShare } from '@/services/cloudShare'
import { expenseRepo } from '@/services/expenseRepo'
import { memberRepo } from '@/services/memberRepo'
import { tripRepo } from '@/services/tripRepo'
import { randomAvatarColor } from '@/utils/avatar'
import { createId } from '@/utils/id'
import { settleTrip } from '@/utils/settlement'

export interface AddExpenseInput {
  amount: number
  payerId: string
  category: ExpenseCategory
  note?: string
  splitMethod: SplitMethod
  splits: ExpenseSplit[]
  source: ExpenseSource
  occurredAt: number
}

/**
 * 当前正在查看的单个行程的工作区状态：成员、支出、结算结果。
 * 行程详情/成员管理/记一笔/结算页都共享这一个 store，避免逐层传 props。
 */
export const useTripWorkspaceStore = defineStore('tripWorkspace', () => {
  const trip = ref<Trip | null>(null)
  const members = ref<Member[]>([])
  const expenses = ref<Expense[]>([])

  function load(tripId: string): void {
    trip.value = tripRepo.get(tripId) ?? null
    members.value = memberRepo.listByTrip(tripId)
    expenses.value = expenseRepo.listByTrip(tripId)
  }

  const totalAmount = computed(() => expenses.value.reduce((sum, e) => sum + e.amount, 0))

  const settlement = computed(() => settleTrip(expenses.value, members.value))

  function memberName(memberId: string): string {
    return members.value.find((m) => m._id === memberId)?.name ?? '未知成员'
  }

  function touchTrip(): void {
    if (!trip.value) return
    trip.value.updatedAt = Date.now()
    tripRepo.save(trip.value)
  }

  /** 开了协作的行程，每次本地改动后顺便同步一份到云端；失败静默，不影响本地操作 */
  function pushToCloud(): void {
    if (!trip.value?.shareCode) return
    pushShare(trip.value._id, trip.value, members.value, expenses.value)
  }

  function addMember(name: string): Member {
    if (!trip.value) throw new Error('no trip loaded')
    const member: Member = {
      _id: createId('member'),
      tripId: trip.value._id,
      name,
      avatarColor: randomAvatarColor(),
      isMe: false,
      createdAt: Date.now(),
    }
    memberRepo.save(member)
    members.value.push(member)
    touchTrip()
    pushToCloud()
    return member
  }

  /** 有关联支出的成员不能删，返回 false 表示删除被拒绝 */
  function removeMember(memberId: string): boolean {
    const inUse = expenses.value.some(
      (e) => e.payerId === memberId || e.splits.some((s) => s.memberId === memberId)
    )
    if (inUse) return false
    memberRepo.remove(memberId)
    members.value = members.value.filter((m) => m._id !== memberId)
    touchTrip()
    pushToCloud()
    return true
  }

  function addExpense(input: AddExpenseInput): Expense {
    if (!trip.value) throw new Error('no trip loaded')
    const now = Date.now()
    const expense: Expense = {
      _id: createId('expense'),
      tripId: trip.value._id,
      ...input,
      createdAt: now,
      updatedAt: now,
    }
    expenseRepo.save(expense)
    expenses.value.unshift(expense)
    touchTrip()
    pushToCloud()
    return expense
  }

  function updateExpense(expenseId: string, patch: Partial<Expense>): void {
    const index = expenses.value.findIndex((e) => e._id === expenseId)
    if (index < 0) return
    const updated = { ...expenses.value[index], ...patch, updatedAt: Date.now() }
    expenses.value[index] = updated
    expenseRepo.save(updated)
    touchTrip()
    pushToCloud()
  }

  function removeExpense(expenseId: string): void {
    expenses.value = expenses.value.filter((e) => e._id !== expenseId)
    expenseRepo.remove(expenseId)
    touchTrip()
    pushToCloud()
  }

  /** 开启多人协作：把当前快照上传到云端并拿到邀请码；已经开过的话直接返回已有邀请码 */
  async function inviteCollaborator(): Promise<string> {
    if (!trip.value) throw new Error('no trip loaded')
    if (trip.value.shareCode) return trip.value.shareCode
    const shareCode = await createShare(trip.value, members.value, expenses.value)
    trip.value.shareCode = shareCode
    touchTrip()
    return shareCode
  }

  /**
   * 从云端拉取最新快照，只有云端比本地新时才覆盖本地（整份覆盖，不做字段级合并）。
   * isMe 是纯本地概念，按成员 id 从本地旧数据里找回来，云端没见过的新成员（比如刚加入的
   * 协作者）才会落到默认的 isMe=false。
   */
  async function syncFromCloud(): Promise<void> {
    if (!trip.value?.shareCode) return
    const tripId = trip.value._id
    const snapshot = await pullShare(tripId)
    if (!snapshot || snapshot.updatedAt <= trip.value.updatedAt) return

    const localIsMeById = new Map(members.value.map((m) => [m._id, m.isMe]))
    const mergedMembers = snapshot.members.map((m) => ({
      ...m,
      isMe: localIsMeById.get(m._id) ?? false,
    }))

    memberRepo.removeByTrip(tripId)
    expenseRepo.removeByTrip(tripId)
    mergedMembers.forEach((m) => memberRepo.save(m))
    snapshot.expenses.forEach((e) => expenseRepo.save(e))
    tripRepo.save(snapshot.trip)

    trip.value = snapshot.trip
    members.value = mergedMembers
    expenses.value = snapshot.expenses
  }

  return {
    trip,
    members,
    expenses,
    totalAmount,
    settlement,
    memberName,
    load,
    addMember,
    removeMember,
    addExpense,
    updateExpense,
    removeExpense,
    inviteCollaborator,
    syncFromCloud,
  }
})

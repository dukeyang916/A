import type {
  Balance,
  Expense,
  ExpenseSplit,
  Member,
  SettlementResult,
  SplitMethod,
  Transfer,
} from '@/types/models'

const CENT = 100

function toCents(yuan: number): number {
  return Math.round(yuan * CENT)
}

function toYuan(cents: number): number {
  return cents / CENT
}

/**
 * 把整数"分"尽量平均分成 n 份，余数依次分给前面的人，
 * 保证 sum(parts) === total，不会因四舍五入丢钱或多算钱。
 */
function distributeCents(totalCents: number, n: number): number[] {
  const base = Math.floor(totalCents / n)
  const remainder = totalCents - base * n
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0))
}

/**
 * 按权重(份数/百分比通用)分配整数"分"，用最大余数法保证总和精确等于 totalCents。
 */
function distributeCentsByWeight(totalCents: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  if (totalWeight <= 0) return weights.map(() => 0)
  const raw = weights.map((w) => (totalCents * w) / totalWeight)
  const floors = raw.map((r) => Math.floor(r))
  const used = floors.reduce((a, b) => a + b, 0)
  const remainder = totalCents - used
  const order = raw
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac)
  const cents = [...floors]
  for (let k = 0; k < remainder; k++) {
    cents[order[k % order.length].i] += 1
  }
  return cents
}

export function computeEqualSplits(amount: number, memberIds: string[]): ExpenseSplit[] {
  if (memberIds.length === 0) return []
  const parts = distributeCents(toCents(amount), memberIds.length)
  return memberIds.map((memberId, i) => ({ memberId, amount: toYuan(parts[i]) }))
}

export function computeShareSplits(
  amount: number,
  entries: { memberId: string; shares: number }[]
): ExpenseSplit[] {
  if (entries.length === 0) return []
  const cents = distributeCentsByWeight(toCents(amount), entries.map((e) => e.shares))
  return entries.map((e, i) => ({
    memberId: e.memberId,
    inputValue: e.shares,
    amount: toYuan(cents[i]),
  }))
}

export function computePercentageSplits(
  amount: number,
  entries: { memberId: string; percentage: number }[]
): ExpenseSplit[] {
  if (entries.length === 0) return []
  const cents = distributeCentsByWeight(toCents(amount), entries.map((e) => e.percentage))
  return entries.map((e, i) => ({
    memberId: e.memberId,
    inputValue: e.percentage,
    amount: toYuan(cents[i]),
  }))
}

export function computeAmountSplits(
  entries: { memberId: string; amount: number }[]
): ExpenseSplit[] {
  return entries.map((e) => ({ memberId: e.memberId, inputValue: e.amount, amount: e.amount }))
}

type SplitParams =
  | { memberIds: string[] }
  | { entries: { memberId: string; percentage: number }[] }
  | { entries: { memberId: string; shares: number }[] }
  | { entries: { memberId: string; amount: number }[] }

export function computeSplits(
  method: SplitMethod,
  amount: number,
  params: SplitParams
): ExpenseSplit[] {
  switch (method) {
    case 'equal':
      return computeEqualSplits(amount, (params as { memberIds: string[] }).memberIds)
    case 'percentage':
      return computePercentageSplits(
        amount,
        (params as { entries: { memberId: string; percentage: number }[] }).entries
      )
    case 'shares':
      return computeShareSplits(
        amount,
        (params as { entries: { memberId: string; shares: number }[] }).entries
      )
    case 'amount':
      return computeAmountSplits(
        (params as { entries: { memberId: string; amount: number }[] }).entries
      )
  }
}

/** 校验一笔支出的分账明细之和是否等于总金额(按分级精度比较，避免浮点误差误判) */
export function validateSplits(amount: number, splits: ExpenseSplit[]): boolean {
  const sum = splits.reduce((acc, s) => acc + toCents(s.amount), 0)
  return sum === toCents(amount)
}

export function computeBalances(expenses: Expense[], members: Member[]): Balance[] {
  const centsByMember = new Map<string, number>(members.map((m) => [m._id, 0]))
  for (const expense of expenses) {
    centsByMember.set(
      expense.payerId,
      (centsByMember.get(expense.payerId) ?? 0) + toCents(expense.amount)
    )
    for (const split of expense.splits) {
      centsByMember.set(
        split.memberId,
        (centsByMember.get(split.memberId) ?? 0) - toCents(split.amount)
      )
    }
  }
  return members.map((m) => ({ memberId: m._id, net: toYuan(centsByMember.get(m._id) ?? 0) }))
}

/**
 * 最小转账方案：贪心法——每次让欠最多的人转给收最多的人，直到所有人清零。
 * 不是数学最优(精确最优是 NP-hard)，但实践中笔数已经很少，
 * 是 Splitwise 等主流产品采用的同款策略，正确性和速度都更可控。
 */
export function minimizeTransfers(balances: Balance[]): Transfer[] {
  const THRESHOLD = 1 // 1 分以内视为已结清，避免浮点残留多算一笔
  const creditors = balances
    .filter((b) => toCents(b.net) > THRESHOLD)
    .map((b) => ({ memberId: b.memberId, cents: toCents(b.net) }))
    .sort((a, b) => b.cents - a.cents)
  const debtors = balances
    .filter((b) => toCents(b.net) < -THRESHOLD)
    .map((b) => ({ memberId: b.memberId, cents: -toCents(b.net) }))
    .sort((a, b) => b.cents - a.cents)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amountCents = Math.min(debtors[i].cents, creditors[j].cents)
    if (amountCents > THRESHOLD) {
      transfers.push({
        fromMemberId: debtors[i].memberId,
        toMemberId: creditors[j].memberId,
        amount: toYuan(amountCents),
      })
    }
    debtors[i].cents -= amountCents
    creditors[j].cents -= amountCents
    if (debtors[i].cents <= THRESHOLD) i++
    if (creditors[j].cents <= THRESHOLD) j++
  }
  return transfers
}

export function settleTrip(expenses: Expense[], members: Member[]): SettlementResult {
  const balances = computeBalances(expenses, members)
  const transfers = minimizeTransfers(balances)
  return { balances, transfers }
}

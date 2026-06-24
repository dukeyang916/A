import { describe, expect, it } from 'vitest'
import type { Expense, Member } from '@/types/models'
import {
  computeBalances,
  computeEqualSplits,
  computePercentageSplits,
  computeShareSplits,
  minimizeTransfers,
  settleTrip,
  validateSplits,
} from '@/utils/settlement'

function makeMembers(ids: string[]): Member[] {
  return ids.map((id) => ({
    _id: id,
    tripId: 't1',
    name: id,
    avatarColor: '#000',
    isMe: false,
    createdAt: 0,
  }))
}

function makeExpense(partial: Partial<Expense>): Expense {
  return {
    _id: 'e1',
    tripId: 't1',
    amount: 0,
    payerId: '',
    category: 'other',
    splitMethod: 'equal',
    splits: [],
    source: 'manual',
    occurredAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

describe('computeEqualSplits', () => {
  it('splits evenly when amount divides cleanly', () => {
    const splits = computeEqualSplits(300, ['a', 'b', 'c'])
    expect(splits.map((s) => s.amount)).toEqual([100, 100, 100])
  })

  it('distributes rounding remainder instead of losing cents', () => {
    const splits = computeEqualSplits(100, ['a', 'b', 'c'])
    const total = splits.reduce((sum, s) => sum + s.amount, 0)
    expect(total).toBeCloseTo(100, 5)
    // 33.34 + 33.33 + 33.33 顺序分配余数给前面的人
    expect(splits[0].amount).toBeCloseTo(33.34, 2)
    expect(splits[1].amount).toBeCloseTo(33.33, 2)
    expect(splits[2].amount).toBeCloseTo(33.33, 2)
  })
})

describe('computeShareSplits / computePercentageSplits', () => {
  it('splits by weighted shares and sums exactly to total', () => {
    const splits = computeShareSplits(100, [
      { memberId: 'a', shares: 1 },
      { memberId: 'b', shares: 2 },
    ])
    const total = splits.reduce((sum, s) => sum + s.amount, 0)
    expect(total).toBeCloseTo(100, 5)
  })

  it('splits by percentage and sums exactly to total even with awkward numbers', () => {
    const splits = computePercentageSplits(33.33, [
      { memberId: 'a', percentage: 33.3 },
      { memberId: 'b', percentage: 33.3 },
      { memberId: 'c', percentage: 33.4 },
    ])
    const total = splits.reduce((sum, s) => sum + s.amount, 0)
    expect(total).toBeCloseTo(33.33, 2)
  })
})

describe('validateSplits', () => {
  it('accepts splits that sum exactly to the total', () => {
    expect(validateSplits(100, computeEqualSplits(100, ['a', 'b', 'c']))).toBe(true)
  })

  it('rejects splits that do not sum to the total', () => {
    expect(
      validateSplits(100, [
        { memberId: 'a', amount: 40 },
        { memberId: 'b', amount: 40 },
      ])
    ).toBe(false)
  })
})

describe('computeBalances', () => {
  it('nets to zero across all members for a single equal-split expense', () => {
    const members = makeMembers(['a', 'b', 'c'])
    const expense = makeExpense({
      amount: 300,
      payerId: 'a',
      splits: computeEqualSplits(300, ['a', 'b', 'c']),
    })
    const balances = computeBalances([expense], members)
    const sum = balances.reduce((s, b) => s + b.net, 0)
    expect(sum).toBeCloseTo(0, 5)
    expect(balances.find((b) => b.memberId === 'a')?.net).toBeCloseTo(200, 2) // 付300, 自己分摊100
    expect(balances.find((b) => b.memberId === 'b')?.net).toBeCloseTo(-100, 2)
    expect(balances.find((b) => b.memberId === 'c')?.net).toBeCloseTo(-100, 2)
  })
})

describe('minimizeTransfers', () => {
  it('produces no transfers when everyone is already settled', () => {
    const transfers = minimizeTransfers([
      { memberId: 'a', net: 0 },
      { memberId: 'b', net: 0 },
    ])
    expect(transfers).toEqual([])
  })

  it('uses at most n-1 transfers for n people with non-zero balances', () => {
    // 经典场景：三人行，A付300(人均100)，B付120的两人份打车(B和C各60)
    const members = makeMembers(['a', 'b', 'c'])
    const dinner = makeExpense({
      amount: 300,
      payerId: 'a',
      splits: computeEqualSplits(300, ['a', 'b', 'c']),
    })
    const taxi = makeExpense({
      amount: 120,
      payerId: 'b',
      splits: computeEqualSplits(120, ['b', 'c']),
    })
    const { balances, transfers } = settleTrip([dinner, taxi], members)
    const nonZero = balances.filter((b) => Math.abs(b.net) > 0.01)
    expect(transfers.length).toBeLessThanOrEqual(nonZero.length - 1)

    // 转账方案本身要能让所有人净额清零
    const net = new Map(balances.map((b) => [b.memberId, b.net]))
    for (const t of transfers) {
      net.set(t.fromMemberId, (net.get(t.fromMemberId) ?? 0) + t.amount)
      net.set(t.toMemberId, (net.get(t.toMemberId) ?? 0) - t.amount)
    }
    for (const [, remaining] of net) {
      expect(Math.abs(remaining)).toBeLessThan(0.01)
    }
  })

  it('handles a more complex multi-person scenario correctly', () => {
    const balances = [
      { memberId: 'a', net: 150 },
      { memberId: 'b', net: -30 },
      { memberId: 'c', net: -50 },
      { memberId: 'd', net: 20 },
      { memberId: 'e', net: -90 },
    ]
    const transfers = minimizeTransfers(balances)
    const net = new Map(balances.map((b) => [b.memberId, b.net]))
    for (const t of transfers) {
      net.set(t.fromMemberId, (net.get(t.fromMemberId) ?? 0) + t.amount)
      net.set(t.toMemberId, (net.get(t.toMemberId) ?? 0) - t.amount)
    }
    for (const [, remaining] of net) {
      expect(Math.abs(remaining)).toBeLessThan(0.01)
    }
    expect(transfers.length).toBeLessThanOrEqual(4) // n-1 = 5-1
  })
})

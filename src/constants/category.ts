import type { ExpenseCategory } from '@/types/models'

export interface CategoryMeta {
  value: ExpenseCategory
  label: string
  icon: string
}

export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  { value: 'transport', label: '交通', icon: '🚗' },
  { value: 'lodging', label: '住宿', icon: '🏨' },
  { value: 'food', label: '餐饮', icon: '🍜' },
  { value: 'ticket', label: '门票', icon: '🎫' },
  { value: 'shopping', label: '购物', icon: '🛍️' },
  { value: 'other', label: '其他', icon: '📦' },
]

export function getCategoryMeta(value: ExpenseCategory): CategoryMeta {
  return EXPENSE_CATEGORIES.find((c) => c.value === value) ?? EXPENSE_CATEGORIES[5]
}

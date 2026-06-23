<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { EXPENSE_CATEGORIES } from '@/constants/category'
import type { ExpenseCategory, SplitMethod } from '@/types/models'
import { useTripWorkspaceStore } from '@/stores/tripWorkspace'
import { formatLocalDate } from '@/utils/date'
import { computeSplits, validateSplits } from '@/utils/settlement'

const workspace = useTripWorkspaceStore()

const tripId = ref('')
const expenseId = ref<string | undefined>(undefined)

const amountText = ref('')
const payerId = ref('')
const category = ref<ExpenseCategory>('food')
const note = ref('')
const occurredDate = ref(formatLocalDate())
const participantIds = ref<string[]>([])
const splitMethod = ref<SplitMethod>('equal')
const perMemberInputText = ref<Record<string, string>>({})

const SPLIT_METHOD_LABELS: Record<SplitMethod, string> = {
  equal: '均摊',
  percentage: '比例',
  shares: '份数',
  amount: '自定义金额',
}
const splitMethodEntries = Object.entries(SPLIT_METHOD_LABELS) as [SplitMethod, string][]

onLoad((query) => {
  const q = query as { tripId: string; expenseId?: string }
  tripId.value = q.tripId
  workspace.load(q.tripId)

  if (q.expenseId) {
    const expense = workspace.expenses.find((e) => e._id === q.expenseId)
    if (expense) {
      expenseId.value = q.expenseId
      amountText.value = String(expense.amount)
      payerId.value = expense.payerId
      category.value = expense.category
      note.value = expense.note ?? ''
      occurredDate.value = formatLocalDate(new Date(expense.occurredAt))
      splitMethod.value = expense.splitMethod
      participantIds.value = expense.splits.map((s) => s.memberId)
      const inputs: Record<string, string> = {}
      for (const s of expense.splits) {
        if (s.inputValue !== undefined) inputs[s.memberId] = String(s.inputValue)
      }
      perMemberInputText.value = inputs
      return
    }
  }

  // 新建：默认付款人是"我"，默认全员参与+均摊 —— 覆盖最常见场景，最少操作即可保存
  const me = workspace.members.find((m) => m.isMe)
  payerId.value = me?._id ?? workspace.members[0]?._id ?? ''
  participantIds.value = workspace.members.map((m) => m._id)
})

const amount = computed(() => Number.parseFloat(amountText.value) || 0)

function payerIndex(): number {
  return workspace.members.findIndex((m) => m._id === payerId.value)
}

function onPayerChange(e: { detail: { value: number } }) {
  payerId.value = workspace.members[e.detail.value]?._id ?? payerId.value
}

function onDateChange(e: { detail: { value: string } }) {
  occurredDate.value = e.detail.value
}

function selectCategory(value: ExpenseCategory) {
  category.value = value
}

function selectSplitMethod(method: SplitMethod) {
  splitMethod.value = method
}

function isParticipant(memberId: string): boolean {
  return participantIds.value.includes(memberId)
}

function toggleParticipant(memberId: string) {
  const idx = participantIds.value.indexOf(memberId)
  if (idx >= 0) {
    if (participantIds.value.length === 1) {
      uni.showToast({ title: '至少需要 1 人参与分摊', icon: 'none' })
      return
    }
    participantIds.value.splice(idx, 1)
  } else {
    participantIds.value.push(memberId)
  }
}

// 切换分账方式或参与人变化时，给一个合理的默认输入值，避免用户面对空白输入框
watch([splitMethod, participantIds], () => {
  if (splitMethod.value === 'equal') return
  const inputs: Record<string, string> = { ...perMemberInputText.value }
  const n = participantIds.value.length || 1
  for (const id of participantIds.value) {
    if (inputs[id] !== undefined) continue
    if (splitMethod.value === 'percentage') inputs[id] = (100 / n).toFixed(1)
    else if (splitMethod.value === 'shares') inputs[id] = '1'
    else if (splitMethod.value === 'amount') inputs[id] = (amount.value / n).toFixed(2)
  }
  perMemberInputText.value = inputs
})

const previewSplits = computed(() => {
  if (participantIds.value.length === 0) return []
  if (splitMethod.value === 'equal') {
    return computeSplits('equal', amount.value, { memberIds: participantIds.value })
  }
  const values = participantIds.value.map(
    (id) => Number.parseFloat(perMemberInputText.value[id] ?? '0') || 0
  )
  if (splitMethod.value === 'percentage') {
    return computeSplits('percentage', amount.value, {
      entries: participantIds.value.map((id, i) => ({ memberId: id, percentage: values[i] })),
    })
  }
  if (splitMethod.value === 'shares') {
    return computeSplits('shares', amount.value, {
      entries: participantIds.value.map((id, i) => ({ memberId: id, shares: values[i] })),
    })
  }
  return computeSplits('amount', amount.value, {
    entries: participantIds.value.map((id, i) => ({ memberId: id, amount: values[i] })),
  })
})

const splitSumWarning = computed(() => {
  if (splitMethod.value === 'amount' && previewSplits.value.length > 0) {
    if (!validateSplits(amount.value, previewSplits.value)) {
      const sum = previewSplits.value.reduce((s, sp) => s + sp.amount, 0)
      return `分摊合计 ¥${sum.toFixed(2)}，与总金额不一致`
    }
  }
  return ''
})

function splitAmountFor(memberId: string): number {
  return previewSplits.value.find((s) => s.memberId === memberId)?.amount ?? 0
}

function buildOccurredAt(): number {
  const now = new Date()
  const [y, m, d] = occurredDate.value.split('-').map(Number)
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).getTime()
}

function save() {
  if (amount.value <= 0) {
    uni.showToast({ title: '请输入金额', icon: 'none' })
    return
  }
  if (!payerId.value) {
    uni.showToast({ title: '请选择付款人', icon: 'none' })
    return
  }
  if (participantIds.value.length === 0) {
    uni.showToast({ title: '请至少选择 1 位参与分摊的人', icon: 'none' })
    return
  }
  if (splitSumWarning.value) {
    uni.showToast({ title: splitSumWarning.value, icon: 'none' })
    return
  }

  const payload = {
    amount: amount.value,
    payerId: payerId.value,
    category: category.value,
    note: note.value.trim() || undefined,
    splitMethod: splitMethod.value,
    splits: previewSplits.value,
    source: 'manual' as const,
    occurredAt: buildOccurredAt(),
  }

  if (expenseId.value) {
    workspace.updateExpense(expenseId.value, payload)
  } else {
    workspace.addExpense(payload)
  }
  uni.navigateBack()
}

function removeExpense() {
  const id = expenseId.value
  if (!id) return
  uni.showModal({
    title: '删除这笔支出',
    content: '删除后不可恢复',
    success: (res) => {
      if (!res.confirm) return
      workspace.removeExpense(id)
      uni.navigateBack()
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="amount-field">
      <text class="currency">¥</text>
      <input
        v-model="amountText"
        type="digit"
        class="amount-input"
        placeholder="0.00"
        placeholder-class="placeholder"
      />
    </view>

    <view class="field">
      <text class="label">付款人</text>
      <picker :range="workspace.members" range-key="name" :value="payerIndex()" @change="onPayerChange">
        <view class="picker-display">{{ workspace.memberName(payerId) }}</view>
      </picker>
    </view>

    <view class="field">
      <text class="label">消费日期</text>
      <picker mode="date" :value="occurredDate" @change="onDateChange">
        <view class="picker-display">{{ occurredDate }}</view>
      </picker>
    </view>

    <view class="field">
      <text class="label">分类</text>
      <view class="category-grid">
        <view
          v-for="c in EXPENSE_CATEGORIES"
          :key="c.value"
          class="category-item"
          :class="{ active: category === c.value }"
          @tap="selectCategory(c.value)"
        >
          <text class="category-icon">{{ c.icon }}</text>
          <text class="category-label">{{ c.label }}</text>
        </view>
      </view>
    </view>

    <view class="field">
      <text class="label">备注（可选）</text>
      <input v-model="note" class="input" placeholder="例如：海底捞晚饭" placeholder-class="placeholder" />
    </view>

    <view class="field">
      <text class="label">参与分摊（{{ participantIds.length }} 人）</text>
      <view class="chip-list">
        <view
          v-for="m in workspace.members"
          :key="m._id"
          class="chip"
          :class="{ active: isParticipant(m._id) }"
          @tap="toggleParticipant(m._id)"
        >
          <text>{{ m.name }}</text>
        </view>
      </view>
    </view>

    <view class="field">
      <text class="label">分账方式</text>
      <view class="method-tabs">
        <view
          v-for="[method, methodLabel] in splitMethodEntries"
          :key="method"
          class="method-tab"
          :class="{ active: splitMethod === method }"
          @tap="selectSplitMethod(method)"
        >
          <text>{{ methodLabel }}</text>
        </view>
      </view>

      <view class="split-detail">
        <view v-for="id in participantIds" :key="id" class="split-row">
          <text class="split-name">{{ workspace.memberName(id) }}</text>
          <input
            v-if="splitMethod !== 'equal'"
            v-model="perMemberInputText[id]"
            type="digit"
            class="split-input"
          />
          <text class="split-amount">¥{{ splitAmountFor(id).toFixed(2) }}</text>
        </view>
      </view>
      <text v-if="splitSumWarning" class="warning">{{ splitSumWarning }}</text>
    </view>

    <button class="submit-btn" @tap="save">保存</button>
    <view v-if="expenseId" class="delete-btn" @tap="removeExpense">
      <text>删除这笔支出</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx;
  padding-bottom: 80rpx;
}

.amount-field {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.currency {
  font-size: 40rpx;
  font-weight: 700;
}

.amount-input {
  flex: 1;
  font-size: 48rpx;
  font-weight: 700;
}

.field {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.label {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 12rpx;
}

.input {
  font-size: 30rpx;
  height: 44rpx;
}

.placeholder {
  color: #bbb;
}

.picker-display {
  font-size: 30rpx;
  min-height: 44rpx;
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.category-item {
  width: 140rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 16rpx 0;
  border-radius: 12rpx;
  background: #f5f6fa;
}

.category-item.active {
  background: #1a1a1a;
}

.category-item.active .category-label {
  color: #fff;
}

.category-icon {
  font-size: 32rpx;
}

.category-label {
  font-size: 22rpx;
  color: #666;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: #f5f6fa;
  font-size: 26rpx;
  color: #666;
}

.chip.active {
  background: #1a1a1a;
  color: #fff;
}

.method-tabs {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.method-tab {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 12rpx;
  background: #f5f6fa;
  font-size: 24rpx;
  color: #666;
}

.method-tab.active {
  background: #1a1a1a;
  color: #fff;
}

.split-detail {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.split-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.split-name {
  width: 120rpx;
  font-size: 26rpx;
  flex-shrink: 0;
}

.split-input {
  flex: 1;
  background: #f5f6fa;
  border-radius: 8rpx;
  padding: 8rpx 16rpx;
  font-size: 26rpx;
}

.split-amount {
  width: 140rpx;
  text-align: right;
  font-size: 26rpx;
  color: #666;
  flex-shrink: 0;
}

.warning {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #e8543e;
}

.submit-btn {
  margin-top: 20rpx;
  background: #1a1a1a;
  color: #fff;
  border-radius: 999rpx;
}

.delete-btn {
  margin-top: 24rpx;
  text-align: center;
  font-size: 26rpx;
  color: #e8543e;
}
</style>

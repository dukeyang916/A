<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { EXPENSE_CATEGORIES } from '@/constants/category'
import type { ExpenseCategory, ExpenseSource } from '@/types/models'
import { useTripWorkspaceStore } from '@/stores/tripWorkspace'
import { computeSplits } from '@/utils/settlement'

const props = defineProps<{
  tripId: string
  source: ExpenseSource
  draft: {
    amount?: number
    category: ExpenseCategory
    note?: string
    payerMemberId?: string
  }
}>()

const emit = defineEmits<{ discard: [] }>()

const workspace = useTripWorkspaceStore()

const amountText = ref('')
const category = ref<ExpenseCategory>('other')
const note = ref('')
const payerId = ref('')

watch(
  () => props.draft,
  (draft) => {
    amountText.value = draft.amount ? String(draft.amount) : ''
    category.value = draft.category
    note.value = draft.note ?? ''
    const fallbackPayer = workspace.members.find((m) => m.isMe) ?? workspace.members[0]
    payerId.value = draft.payerMemberId ?? fallbackPayer?._id ?? ''
  },
  { immediate: true }
)

const amount = computed(() => Number.parseFloat(amountText.value) || 0)

function payerIndex(): number {
  return workspace.members.findIndex((m) => m._id === payerId.value)
}

function onPayerChange(e: { detail: { value: number } }) {
  payerId.value = workspace.members[e.detail.value]?._id ?? payerId.value
}

function selectCategory(value: ExpenseCategory) {
  category.value = value
}

// 快速保存固定用全员均摊：AI 录入场景下用户要的是"先记上"，均摊是最常见情况，
// 不均摊的小概率场景走"编辑后保存"即可，不在这里加分账方式选择。
function quickSave() {
  if (amount.value <= 0) {
    uni.showToast({ title: '请输入正确的金额', icon: 'none' })
    return
  }
  if (!payerId.value) {
    uni.showToast({ title: '请选择付款人', icon: 'none' })
    return
  }
  const memberIds = workspace.members.map((m) => m._id)
  workspace.addExpense({
    amount: amount.value,
    payerId: payerId.value,
    category: category.value,
    note: note.value.trim() || undefined,
    splitMethod: 'equal',
    splits: computeSplits('equal', amount.value, { memberIds }),
    source: props.source,
    occurredAt: Date.now(),
  })
  uni.showToast({ title: '已保存', icon: 'success' })
  uni.navigateBack()
}

function editThenSave() {
  const params: Record<string, string> = { tripId: props.tripId }
  if (amount.value > 0) params.prefillAmount = String(amount.value)
  params.prefillCategory = category.value
  if (note.value.trim()) params.prefillNote = note.value.trim()
  if (payerId.value) params.prefillPayerId = payerId.value

  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')
  // 用 redirectTo 替换当前页（而不是 navigateTo 叠一层），这样 expense-edit 保存后
  // navigateBack 能直接回到行程详情页，不会卡在已经用完的语音/拍照/对话页上。
  uni.redirectTo({ url: `/pages/expense-edit/index?${query}` })
}
</script>

<template>
  <view class="card">
    <text class="title">识别结果，确认后保存</text>

    <view class="amount-row">
      <text class="currency">¥</text>
      <input
        v-model="amountText"
        type="digit"
        class="amount-input"
        placeholder="未识别到金额，请手动输入"
        placeholder-class="placeholder"
      />
    </view>

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

    <view class="field-row">
      <text class="field-label">付款人</text>
      <picker :range="workspace.members" range-key="name" :value="payerIndex()" @change="onPayerChange">
        <view class="picker-display">{{ workspace.memberName(payerId) }}</view>
      </picker>
    </view>

    <view class="field-row">
      <text class="field-label">备注</text>
      <input v-model="note" class="note-input" placeholder="可选" placeholder-class="placeholder" />
    </view>

    <view class="actions">
      <view class="action-btn ghost" @tap="emit('discard')">
        <text>重新识别</text>
      </view>
      <view class="action-btn" @tap="editThenSave">
        <text>✏️ 编辑后保存</text>
      </view>
      <view class="action-btn primary" @tap="quickSave">
        <text>✓ 直接保存</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 20rpx;
}

.amount-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-bottom: 20rpx;
  margin-bottom: 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.currency {
  font-size: 36rpx;
  font-weight: 700;
}

.amount-input {
  flex: 1;
  font-size: 44rpx;
  font-weight: 700;
}

.placeholder {
  color: #bbb;
  font-size: 26rpx;
  font-weight: 400;
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 20rpx;
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

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
}

.field-label {
  font-size: 26rpx;
  color: #999;
}

.picker-display {
  font-size: 28rpx;
}

.note-input {
  flex: 1;
  text-align: right;
  font-size: 28rpx;
  margin-left: 24rpx;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  border-radius: 999rpx;
  background: #f5f6fa;
  font-size: 24rpx;
  color: #666;
}

.action-btn.ghost {
  background: transparent;
  color: #999;
}

.action-btn.primary {
  background: #1a1a1a;
  color: #fff;
}
</style>

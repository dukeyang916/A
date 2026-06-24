<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getCategoryMeta } from '@/constants/category'
import { useTripWorkspaceStore } from '@/stores/tripWorkspace'

const workspace = useTripWorkspaceStore()
const tripId = ref('')

onLoad((query) => {
  tripId.value = (query as { tripId: string }).tripId
})

onShow(() => {
  if (tripId.value) workspace.load(tripId.value)
})

function formatDateRange(start: string, end: string): string {
  return `${start} ~ ${end}`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const ADD_EXPENSE_ROUTES = [
  '/pages/expense-edit/index',
  '/pages/ai-chat/index',
  '/pages/ai-photo/index',
  '/pages/ai-voice/index',
]

function goAddExpense() {
  uni.showActionSheet({
    itemList: ['手动记一笔', '对话记账', '拍照记账', '语音记账'],
    success: (res) => {
      uni.navigateTo({ url: `${ADD_EXPENSE_ROUTES[res.tapIndex]}?tripId=${tripId.value}` })
    },
  })
}

function goEditExpense(expenseId: string) {
  uni.navigateTo({ url: `/pages/expense-edit/index?tripId=${tripId.value}&expenseId=${expenseId}` })
}

function goMembers() {
  uni.navigateTo({ url: `/pages/member-manage/index?tripId=${tripId.value}` })
}

function goSettlement() {
  uni.navigateTo({ url: `/pages/settlement/index?tripId=${tripId.value}` })
}
</script>

<template>
  <view class="page">
    <view v-if="workspace.trip" class="overview">
      <text class="trip-name">{{ workspace.trip.name }}</text>
      <text class="trip-meta">
        {{ workspace.trip.destination.name }} ·
        {{ formatDateRange(workspace.trip.startDate, workspace.trip.endDate) }}
      </text>
      <view class="overview-stats">
        <view class="stat">
          <text class="stat-value">¥{{ workspace.totalAmount.toFixed(2) }}</text>
          <text class="stat-label">总花费</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ workspace.members.length }}</text>
          <text class="stat-label">成员</text>
        </view>
      </view>
      <view class="overview-actions">
        <view class="action-btn" @tap="goMembers">
          <text>成员管理</text>
        </view>
        <view class="action-btn primary" @tap="goSettlement">
          <text>查看结算</text>
        </view>
      </view>
    </view>

    <view class="expense-section">
      <text class="section-title">支出明细</text>
      <view v-if="workspace.expenses.length === 0" class="empty">
        <text class="empty-text">还没有记账，点右下角加一笔</text>
      </view>
      <view v-else class="expense-list">
        <view
          v-for="expense in workspace.expenses"
          :key="expense._id"
          class="expense-item"
          @tap="goEditExpense(expense._id)"
        >
          <view class="expense-icon">{{ getCategoryMeta(expense.category).icon }}</view>
          <view class="expense-main">
            <text class="expense-note">{{ expense.note || getCategoryMeta(expense.category).label }}</text>
            <text class="expense-sub">
              {{ workspace.memberName(expense.payerId) }} 付款 · {{ formatTime(expense.occurredAt) }}
            </text>
          </view>
          <text class="expense-amount">¥{{ expense.amount.toFixed(2) }}</text>
        </view>
      </view>
    </view>

    <view class="fab" @tap="goAddExpense">
      <text class="fab-text">+ 记一笔</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  padding-bottom: 160rpx;
  box-sizing: border-box;
}

.overview {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  display: flex;
  flex-direction: column;
}

.trip-name {
  font-size: 34rpx;
  font-weight: 700;
}

.trip-meta {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.overview-stats {
  display: flex;
  margin-top: 24rpx;
  gap: 48rpx;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 36rpx;
  font-weight: 700;
}

.stat-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

.overview-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 999rpx;
  background: #f5f6fa;
  font-size: 26rpx;
}

.action-btn.primary {
  background: #1a1a1a;
  color: #fff;
}

.section-title {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 16rpx;
  display: block;
}

.empty {
  margin-top: 80rpx;
  display: flex;
  justify-content: center;
}

.empty-text {
  color: #999;
  font-size: 26rpx;
}

.expense-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.expense-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.expense-icon {
  font-size: 36rpx;
}

.expense-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.expense-note {
  font-size: 28rpx;
}

.expense-sub {
  font-size: 22rpx;
  color: #999;
}

.expense-amount {
  font-size: 30rpx;
  font-weight: 600;
}

.fab {
  position: fixed;
  bottom: 60rpx;
  right: 40rpx;
  background: #1a1a1a;
  border-radius: 999rpx;
  padding: 24rpx 40rpx;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.2);
}

.fab-text {
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
}
</style>

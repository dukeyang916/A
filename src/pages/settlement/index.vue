<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { settledMarkRepo } from '@/services/settledMarkRepo'
import { useTripWorkspaceStore } from '@/stores/tripWorkspace'
import type { Transfer } from '@/types/models'

const workspace = useTripWorkspaceStore()
const tripId = ref('')
const settledKeys = ref<Set<string>>(new Set())

onLoad((query) => {
  tripId.value = (query as { tripId: string }).tripId
})

onShow(() => {
  if (!tripId.value) return
  workspace.load(tripId.value)
  settledKeys.value = settledMarkRepo.listByTrip(tripId.value)
})

function balanceText(net: number): string {
  if (Math.abs(net) < 0.01) return '已平'
  return net > 0 ? `该收 ¥${net.toFixed(2)}` : `该付 ¥${Math.abs(net).toFixed(2)}`
}

function balanceClass(net: number): string {
  if (Math.abs(net) < 0.01) return 'settled'
  return net > 0 ? 'positive' : 'negative'
}

function isSettled(t: Transfer): boolean {
  return settledKeys.value.has(settledMarkRepo.markKey(t.fromMemberId, t.toMemberId))
}

function toggleSettled(t: Transfer) {
  settledMarkRepo.toggle(tripId.value, t.fromMemberId, t.toMemberId)
  settledKeys.value = settledMarkRepo.listByTrip(tripId.value)
}

function goShare() {
  uni.navigateTo({ url: `/pages/settlement-share/index?tripId=${tripId.value}` })
}
</script>

<template>
  <view class="page">
    <view class="section">
      <text class="section-title">每人余额</text>
      <view class="balance-list">
        <view v-for="b in workspace.settlement.balances" :key="b.memberId" class="balance-item">
          <text class="balance-name">{{ workspace.memberName(b.memberId) }}</text>
          <text class="balance-value" :class="balanceClass(b.net)">{{ balanceText(b.net) }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">转账方案（已最小化笔数）</text>
      <view v-if="workspace.settlement.transfers.length === 0" class="empty">
        <text class="empty-text">大家已经两清啦</text>
      </view>
      <view v-else class="transfer-list">
        <view
          v-for="(t, i) in workspace.settlement.transfers"
          :key="i"
          class="transfer-item"
          :class="{ done: isSettled(t) }"
          @tap="toggleSettled(t)"
        >
          <text class="transfer-text">
            {{ workspace.memberName(t.fromMemberId) }} 转给 {{ workspace.memberName(t.toMemberId) }}
          </text>
          <text class="transfer-amount">¥{{ t.amount.toFixed(2) }}</text>
          <text class="transfer-status">{{ isSettled(t) ? '已转' : '点击标记' }}</text>
        </view>
      </view>
    </view>

    <button class="share-btn" @tap="goShare">分享结算结果</button>
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx;
}

.section {
  margin-bottom: 32rpx;
}

.section-title {
  display: block;
  font-size: 26rpx;
  color: #999;
  margin-bottom: 16rpx;
}

.balance-list,
.transfer-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.balance-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.balance-name {
  font-size: 28rpx;
}

.balance-value {
  font-size: 28rpx;
  font-weight: 600;
}

.balance-value.positive {
  color: #19a974;
}

.balance-value.negative {
  color: #e8543e;
}

.balance-value.settled {
  color: #999;
}

.empty {
  padding: 40rpx 0;
  display: flex;
  justify-content: center;
}

.empty-text {
  color: #999;
  font-size: 26rpx;
}

.transfer-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.transfer-item.done {
  opacity: 0.5;
}

.transfer-text {
  flex: 1;
  font-size: 28rpx;
}

.transfer-amount {
  font-size: 28rpx;
  font-weight: 600;
}

.transfer-status {
  font-size: 22rpx;
  color: #999;
  width: 110rpx;
  text-align: right;
  flex-shrink: 0;
}

.share-btn {
  margin-top: 12rpx;
  background: #1a1a1a;
  color: #fff;
  border-radius: 999rpx;
}
</style>

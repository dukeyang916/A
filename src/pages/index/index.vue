<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useTripListStore } from '@/stores/trip'

const tripListStore = useTripListStore()

onShow(() => {
  tripListStore.refresh()
})

function formatDateRange(start: string, end: string): string {
  return `${start.slice(5)} ~ ${end.slice(5)}`
}

function balanceText(myNet: number): string {
  if (Math.abs(myNet) < 0.01) return '已结清'
  return myNet > 0 ? `该收 ¥${myNet.toFixed(2)}` : `该付 ¥${Math.abs(myNet).toFixed(2)}`
}

function balanceClass(myNet: number): string {
  if (Math.abs(myNet) < 0.01) return 'settled'
  return myNet > 0 ? 'positive' : 'negative'
}

function goCreate() {
  uni.navigateTo({ url: '/pages/trip-create/index' })
}

function goDetail(tripId: string) {
  uni.navigateTo({ url: `/pages/trip-detail/index?tripId=${tripId}` })
}

function goSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">我的行程</text>
      <view class="settings-entry" @tap="goSettings">
        <text>设置</text>
      </view>
    </view>

    <view v-if="tripListStore.trips.length === 0" class="empty">
      <text class="empty-text">还没有行程，创建一个开始记账吧</text>
    </view>

    <view v-else class="trip-list">
      <view
        v-for="trip in tripListStore.trips"
        :key="trip._id"
        class="trip-card"
        @tap="goDetail(trip._id)"
      >
        <view class="trip-card-main">
          <text class="trip-name">{{ trip.name }}</text>
          <text class="trip-meta"
            >{{ trip.destination.name }} · {{ formatDateRange(trip.startDate, trip.endDate) }}</text
          >
        </view>
        <view class="trip-card-side">
          <text class="trip-total"
            >¥{{ tripListStore.getTripSummary(trip._id).totalAmount.toFixed(2) }}</text
          >
          <text
            class="trip-balance"
            :class="balanceClass(tripListStore.getTripSummary(trip._id).myNet)"
            >{{ balanceText(tripListStore.getTripSummary(trip._id).myNet) }}</text
          >
        </view>
      </view>
    </view>

    <view class="fab" @tap="goCreate">
      <text class="fab-text">+ 创建行程</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
}

.settings-entry {
  font-size: 26rpx;
  color: #888;
}

.empty {
  margin-top: 200rpx;
  display: flex;
  justify-content: center;
}

.empty-text {
  color: #999;
  font-size: 28rpx;
}

.trip-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.trip-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.trip-card-main {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.trip-name {
  font-size: 32rpx;
  font-weight: 600;
}

.trip-meta {
  font-size: 24rpx;
  color: #999;
}

.trip-card-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.trip-total {
  font-size: 26rpx;
  color: #666;
}

.trip-balance {
  font-size: 26rpx;
  font-weight: 600;
}

.trip-balance.positive {
  color: #19a974;
}

.trip-balance.negative {
  color: #e8543e;
}

.trip-balance.settled {
  color: #999;
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

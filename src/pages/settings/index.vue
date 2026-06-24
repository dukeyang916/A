<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useTripListStore } from '@/stores/trip'
import { tripRepo } from '@/services/tripRepo'
import { ref } from 'vue'
import type { Trip } from '@/types/models'

const tripListStore = useTripListStore()
const archivedTrips = ref<Trip[]>([])

onShow(() => {
  archivedTrips.value = tripRepo.listArchived()
})

function restoreTrip(id: string) {
  tripListStore.archiveTrip(id, false)
  archivedTrips.value = tripRepo.listArchived()
  uni.showToast({ title: '已恢复', icon: 'success' })
}

function deleteTripForever(id: string) {
  uni.showModal({
    title: '永久删除',
    content: '行程、成员和支出记录都会被删除，且不可恢复',
    confirmColor: '#e8543e',
    success: (res) => {
      if (!res.confirm) return
      tripListStore.removeTrip(id)
      archivedTrips.value = tripRepo.listArchived()
    },
  })
}

function clearAllData() {
  uni.showModal({
    title: '清除所有数据',
    content: '将删除本机保存的全部行程数据，且不可恢复，请谨慎操作',
    confirmColor: '#e8543e',
    success: (res) => {
      if (!res.confirm) return
      uni.clearStorageSync()
      tripListStore.refresh()
      archivedTrips.value = []
      uni.showToast({ title: '已清除', icon: 'success' })
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="section">
      <text class="section-title">已归档行程</text>
      <view v-if="archivedTrips.length === 0" class="empty">
        <text class="empty-text">没有归档的行程</text>
      </view>
      <view v-else class="archived-list">
        <view v-for="trip in archivedTrips" :key="trip._id" class="archived-item">
          <text class="archived-name">{{ trip.name }}</text>
          <view class="archived-actions">
            <text class="action-link" @tap="restoreTrip(trip._id)">恢复</text>
            <text class="action-link danger" @tap="deleteTripForever(trip._id)">删除</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">关于</text>
      <view class="about-card">
        <text class="about-name">旅程拼账</text>
        <text class="about-desc">面向旅行场景的多人分账与结算工具 · v0.1.0</text>
        <text class="about-desc">当前数据保存在本机，暂不支持多人云端协作</text>
      </view>
    </view>

    <view class="section">
      <view class="danger-btn" @tap="clearAllData">
        <text>清除所有本地数据</text>
      </view>
    </view>
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

.empty {
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx 0;
  display: flex;
  justify-content: center;
}

.empty-text {
  color: #999;
  font-size: 26rpx;
}

.archived-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.archived-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.archived-name {
  font-size: 28rpx;
}

.archived-actions {
  display: flex;
  gap: 24rpx;
}

.action-link {
  font-size: 26rpx;
  color: #4d96ff;
}

.action-link.danger {
  color: #e8543e;
}

.about-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.about-name {
  font-size: 30rpx;
  font-weight: 600;
}

.about-desc {
  font-size: 24rpx;
  color: #999;
}

.danger-btn {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  text-align: center;
  color: #e8543e;
  font-size: 28rpx;
}
</style>

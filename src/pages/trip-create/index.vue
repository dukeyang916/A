<script setup lang="ts">
import { ref } from 'vue'
import { useTripListStore } from '@/stores/trip'
import { formatLocalDate } from '@/utils/date'

const tripListStore = useTripListStore()

const name = ref('')
const destinationName = ref('')
const regionValue = ref<string[]>([])
const today = formatLocalDate()
const startDate = ref(today)
const endDate = ref(today)

function onRegionChange(e: { detail: { value: string[] } }) {
  regionValue.value = e.detail.value
  // 直辖市省/市同名，只展示一次，避免"上海市上海市"
  const [province, city] = e.detail.value
  destinationName.value = province === city ? city : city || province
}

function onStartDateChange(e: { detail: { value: string } }) {
  startDate.value = e.detail.value
  if (endDate.value < startDate.value) endDate.value = startDate.value
}

function onEndDateChange(e: { detail: { value: string } }) {
  endDate.value = e.detail.value
}

function submit() {
  if (!name.value.trim()) {
    uni.showToast({ title: '请填写行程名称', icon: 'none' })
    return
  }
  if (!destinationName.value.trim()) {
    uni.showToast({ title: '请选择目的地', icon: 'none' })
    return
  }
  if (endDate.value < startDate.value) {
    uni.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
    return
  }

  const trip = tripListStore.createTrip({
    name: name.value.trim(),
    destinationName: destinationName.value.trim(),
    startDate: startDate.value,
    endDate: endDate.value,
  })

  uni.redirectTo({ url: `/pages/trip-detail/index?tripId=${trip._id}` })
}
</script>

<template>
  <view class="page">
    <view class="field">
      <text class="label">行程名称</text>
      <input
        v-model="name"
        class="input"
        placeholder="例如：成都三日游"
        placeholder-class="placeholder"
      />
    </view>

    <view class="field">
      <text class="label">目的地</text>
      <picker mode="region" :value="regionValue" @change="onRegionChange">
        <view class="picker-display" :class="{ placeholder: !destinationName }">
          {{ destinationName || '请选择目的地' }}
        </view>
      </picker>
    </view>

    <view class="field">
      <text class="label">开始日期</text>
      <picker mode="date" :value="startDate" @change="onStartDateChange">
        <view class="picker-display">{{ startDate }}</view>
      </picker>
    </view>

    <view class="field">
      <text class="label">结束日期</text>
      <picker mode="date" :value="endDate" :start="startDate" @change="onEndDateChange">
        <view class="picker-display">{{ endDate }}</view>
      </picker>
    </view>

    <button class="submit-btn" @tap="submit">创建行程</button>
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx;
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

.submit-btn {
  margin-top: 40rpx;
  background: #1a1a1a;
  color: #fff;
  border-radius: 999rpx;
}
</style>

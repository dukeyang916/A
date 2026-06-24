<script setup lang="ts">
import { ref } from 'vue'
import { useTripListStore } from '@/stores/trip'

const tripListStore = useTripListStore()

const shareCode = ref('')
const memberName = ref('')
const submitting = ref(false)

async function submit() {
  const code = shareCode.value.trim()
  const name = memberName.value.trim()
  if (!code) {
    uni.showToast({ title: '请输入邀请码', icon: 'none' })
    return
  }
  if (!name) {
    uni.showToast({ title: '请输入你的称呼', icon: 'none' })
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const trip = await tripListStore.joinTrip(code, name)
    uni.redirectTo({ url: `/pages/trip-detail/index?tripId=${trip._id}` })
  } catch (err) {
    uni.showToast({ title: err instanceof Error ? err.message : '加入失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="field">
      <text class="label">邀请码</text>
      <input
        v-model="shareCode"
        class="input"
        placeholder="向行程创建者要一个邀请码"
        placeholder-class="placeholder"
      />
    </view>

    <view class="field">
      <text class="label">你的称呼</text>
      <input
        v-model="memberName"
        class="input"
        placeholder="同行的人能看到这个名字"
        placeholder-class="placeholder"
      />
    </view>

    <button class="submit-btn" :disabled="submitting" @tap="submit">
      {{ submitting ? '加入中...' : '加入行程' }}
    </button>
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

.submit-btn {
  margin-top: 40rpx;
  background: #1a1a1a;
  color: #fff;
  border-radius: 999rpx;
}
</style>

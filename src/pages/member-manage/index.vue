<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { avatarInitial } from '@/utils/avatar'
import { useTripWorkspaceStore } from '@/stores/tripWorkspace'

const workspace = useTripWorkspaceStore()
const newName = ref('')

onLoad((query) => {
  const tripId = (query as { tripId: string }).tripId
  workspace.load(tripId)
})

function addMember() {
  const name = newName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return
  }
  if (workspace.members.some((m) => m.name === name)) {
    uni.showToast({ title: '已有同名成员', icon: 'none' })
    return
  }
  workspace.addMember(name)
  newName.value = ''
}

function removeMember(memberId: string) {
  uni.showModal({
    title: '删除成员',
    content: '确定要删除这位成员吗？',
    success: (res) => {
      if (!res.confirm) return
      const ok = workspace.removeMember(memberId)
      if (!ok) {
        uni.showToast({ title: '该成员有关联支出，无法删除', icon: 'none' })
      }
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="add-bar">
      <input
        v-model="newName"
        class="add-input"
        placeholder="输入姓名，添加同行的人"
        placeholder-class="placeholder"
        confirm-type="done"
        @confirm="addMember"
      />
      <view class="add-btn" @tap="addMember">
        <text>添加</text>
      </view>
    </view>

    <view class="member-list">
      <view v-for="member in workspace.members" :key="member._id" class="member-item">
        <view class="avatar" :style="{ backgroundColor: member.avatarColor }">
          <text class="avatar-text">{{ avatarInitial(member.name) }}</text>
        </view>
        <text class="member-name">{{ member.name }}</text>
        <text v-if="member.isMe" class="me-tag">我</text>
        <view v-else class="remove-btn" @tap="removeMember(member._id)">
          <text>删除</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx;
}

.add-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.add-input {
  flex: 1;
  background: #fff;
  border-radius: 999rpx;
  padding: 16rpx 28rpx;
  font-size: 28rpx;
}

.placeholder {
  color: #bbb;
}

.add-btn {
  background: #1a1a1a;
  color: #fff;
  border-radius: 999rpx;
  padding: 16rpx 32rpx;
  display: flex;
  align-items: center;
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.member-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
}

.member-name {
  flex: 1;
  font-size: 30rpx;
}

.me-tag {
  font-size: 22rpx;
  color: #999;
  background: #f5f6fa;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}

.remove-btn {
  font-size: 24rpx;
  color: #e8543e;
  padding: 8rpx 16rpx;
}
</style>

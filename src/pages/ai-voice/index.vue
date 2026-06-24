<script setup lang="ts">
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import ExpenseDraftCard from '@/components/ExpenseDraftCard.vue'
import { parseExpenseText, transcribeVoice, uploadMediaFile } from '@/services/cloud'
import { useTripWorkspaceStore } from '@/stores/tripWorkspace'
import type { ExpenseCategory } from '@/types/models'

const workspace = useTripWorkspaceStore()
const tripId = ref('')

type Status = 'idle' | 'recording' | 'processing' | 'done' | 'error'

const status = ref<Status>('idle')
const transcript = ref('')
const errorMessage = ref('')
const draft = ref<{
  amount?: number
  category: ExpenseCategory
  note?: string
  payerMemberId?: string
}>()

// 一句话识别只适合几十秒内的短语音，60s 封顶，到时让录音组件自动停止
const MAX_DURATION_MS = 60000

const recorderManager = uni.getRecorderManager()

recorderManager.onStart(() => {
  status.value = 'recording'
})

recorderManager.onStop((res) => {
  processAudio(res.tempFilePath)
})

recorderManager.onError(() => {
  status.value = 'error'
  errorMessage.value = '录音失败，请检查麦克风权限后重试'
})

onLoad((query) => {
  tripId.value = (query as { tripId: string }).tripId
  workspace.load(tripId.value)
})

onUnload(() => {
  if (status.value === 'recording') recorderManager.stop()
})

function startRecording() {
  draft.value = undefined
  transcript.value = ''
  recorderManager.start({ format: 'mp3', duration: MAX_DURATION_MS })
}

function stopRecording() {
  recorderManager.stop()
}

async function processAudio(tempFilePath: string) {
  status.value = 'processing'
  try {
    const fileID = await uploadMediaFile(tempFilePath, 'mp3')
    const asrResult = await transcribeVoice(fileID)
    transcript.value = asrResult.text
    if (!asrResult.text.trim()) {
      throw new Error('没有识别到语音内容，请重新录制')
    }
    const parsed = await parseExpenseText(asrResult.text, workspace.members)
    draft.value = {
      amount: parsed.amount,
      category: parsed.category,
      note: parsed.note,
      payerMemberId: parsed.payerMemberId,
    }
    status.value = 'done'
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '识别失败，请重试'
    status.value = 'error'
  }
}

function discardDraft() {
  status.value = 'idle'
  draft.value = undefined
  transcript.value = ''
}
</script>

<template>
  <view class="page">
    <view v-if="status === 'idle' || status === 'recording'" class="record-area">
      <view
        class="record-btn"
        :class="{ recording: status === 'recording' }"
        @tap="status === 'recording' ? stopRecording() : startRecording()"
      >
        <text class="record-icon">{{ status === 'recording' ? '■' : '🎤' }}</text>
      </view>
      <text class="record-hint">{{ status === 'recording' ? '点击停止' : '点击开始说话' }}</text>
    </view>

    <view v-else-if="status === 'processing'" class="status-box">
      <text>识别中...</text>
    </view>

    <view v-else-if="status === 'error'" class="status-box error">
      <text>{{ errorMessage }}</text>
      <view class="retry-btn" @tap="discardDraft">
        <text>重新录制</text>
      </view>
    </view>

    <template v-else-if="status === 'done' && draft">
      <text v-if="transcript" class="raw-text">识别到的内容：{{ transcript }}</text>
      <ExpenseDraftCard :trip-id="tripId" source="voice" :draft="draft" @discard="discardDraft" />
    </template>
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx;
  padding-bottom: 80rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.record-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 160rpx;
  gap: 24rpx;
}

.record-btn {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.record-btn.recording {
  background: #e8543e;
}

.record-icon {
  font-size: 64rpx;
  color: #fff;
}

.record-hint {
  font-size: 26rpx;
  color: #999;
}

.status-box {
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx 24rpx;
  text-align: center;
  color: #999;
  font-size: 26rpx;
}

.status-box.error {
  color: #e8543e;
}

.retry-btn {
  margin-top: 20rpx;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 999rpx;
  background: #f5f6fa;
  font-size: 24rpx;
  color: #666;
}

.raw-text {
  font-size: 22rpx;
  color: #999;
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx 24rpx;
  display: block;
}
</style>

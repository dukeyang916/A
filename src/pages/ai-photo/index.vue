<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import ExpenseDraftCard from '@/components/ExpenseDraftCard.vue'
import { ocrReceipt, parseExpenseText, uploadMediaFile } from '@/services/cloud'
import { useTripWorkspaceStore } from '@/stores/tripWorkspace'
import type { ExpenseCategory } from '@/types/models'

const workspace = useTripWorkspaceStore()
const tripId = ref('')

type Status = 'idle' | 'processing' | 'done' | 'error'

const status = ref<Status>('idle')
const photoPath = ref('')
const rawText = ref('')
const errorMessage = ref('')
const draft = ref<{
  amount?: number
  category: ExpenseCategory
  note?: string
  payerMemberId?: string
}>()

onLoad((query) => {
  tripId.value = (query as { tripId: string }).tripId
  workspace.load(tripId.value)
  choosePhoto()
})

// 取消拍照/选图时直接退回行程详情：这个页面除了"等一张照片"没有别的内容可看，
// 留在空白页上不如退回去，跟大多数 App 取消图片选择器后的体验一致。
function choosePhoto() {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera', 'album'],
    success: (res) => {
      photoPath.value = res.tempFilePaths[0]
      processImage(photoPath.value)
    },
    fail: () => {
      uni.navigateBack()
    },
  })
}

async function processImage(tempFilePath: string) {
  status.value = 'processing'
  draft.value = undefined
  rawText.value = ''
  try {
    const fileID = await uploadMediaFile(tempFilePath, 'jpg')
    const ocrResult = await ocrReceipt(fileID)
    rawText.value = ocrResult.rawText
    if (!ocrResult.rawText.trim()) {
      throw new Error('没有识别到文字，请重新拍照')
    }
    const parsed = await parseExpenseText(ocrResult.rawText, workspace.members)
    draft.value = {
      amount: parsed.amount ?? ocrResult.amountGuess,
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
  choosePhoto()
}

function retry() {
  if (photoPath.value) processImage(photoPath.value)
}
</script>

<template>
  <view class="page">
    <view v-if="photoPath" class="photo-preview">
      <image :src="photoPath" mode="widthFix" class="photo" />
    </view>

    <view v-if="status === 'processing'" class="status-box">
      <text>识别中...</text>
    </view>

    <view v-else-if="status === 'error'" class="status-box error">
      <text>{{ errorMessage }}</text>
      <view class="retry-row">
        <view class="retry-btn" @tap="retry">
          <text>重试识别</text>
        </view>
        <view class="retry-btn" @tap="choosePhoto">
          <text>重新拍照</text>
        </view>
      </view>
    </view>

    <template v-else-if="status === 'done' && draft">
      <text v-if="rawText" class="raw-text">识别到的文字：{{ rawText }}</text>
      <ExpenseDraftCard :trip-id="tripId" source="photo" :draft="draft" @discard="discardDraft" />
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

.photo-preview {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.photo {
  width: 100%;
  display: block;
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

.retry-row {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.retry-btn {
  flex: 1;
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

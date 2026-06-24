<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { nextTick, ref } from 'vue'
import ExpenseDraftCard from '@/components/ExpenseDraftCard.vue'
import { parseExpenseText, type ExpenseParseResult } from '@/services/cloud'
import { useTripWorkspaceStore } from '@/stores/tripWorkspace'
import { createId } from '@/utils/id'

const workspace = useTripWorkspaceStore()
const tripId = ref('')

interface ChatTurn {
  id: string
  text: string
  status: 'pending' | 'done' | 'error'
  draft?: ExpenseParseResult
  errorMessage?: string
}

const turns = ref<ChatTurn[]>([])
const inputText = ref('')
const scrollIntoView = ref('')

onLoad((query) => {
  tripId.value = (query as { tripId: string }).tripId
  workspace.load(tripId.value)
})

function scrollToBottom() {
  nextTick(() => {
    const last = turns.value[turns.value.length - 1]
    if (last) scrollIntoView.value = `turn-${last.id}`
  })
}

async function send() {
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''

  const turn: ChatTurn = { id: createId('turn'), text, status: 'pending' }
  turns.value.push(turn)
  scrollToBottom()

  try {
    turn.draft = await parseExpenseText(text, workspace.members)
    turn.status = 'done'
  } catch (err) {
    turn.status = 'error'
    turn.errorMessage = err instanceof Error ? err.message : '识别失败，请重试'
  }
  scrollToBottom()
}

function discardTurn(id: string) {
  turns.value = turns.value.filter((t) => t.id !== id)
}
</script>

<template>
  <view class="page">
    <scroll-view scroll-y class="messages" :scroll-into-view="scrollIntoView" scroll-with-animation>
      <view v-if="turns.length === 0" class="empty">
        <text class="empty-text">说一句你的消费，比如"打车35块，我付的"</text>
      </view>
      <view v-for="turn in turns" :id="`turn-${turn.id}`" :key="turn.id" class="turn">
        <view class="bubble user">
          <text>{{ turn.text }}</text>
        </view>
        <view v-if="turn.status === 'pending'" class="bubble assistant">
          <text>识别中...</text>
        </view>
        <view v-else-if="turn.status === 'error'" class="bubble assistant error">
          <text>{{ turn.errorMessage }}</text>
        </view>
        <ExpenseDraftCard
          v-else-if="turn.draft"
          :trip-id="tripId"
          source="ai_chat"
          :draft="turn.draft"
          @discard="discardTurn(turn.id)"
        />
      </view>
    </scroll-view>

    <view class="input-bar">
      <input
        v-model="inputText"
        class="text-input"
        placeholder="说一句你的消费..."
        placeholder-class="placeholder"
        confirm-type="send"
        @confirm="send"
      />
      <view class="send-btn" @tap="send">
        <text>发送</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.messages {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}

.empty {
  margin-top: 120rpx;
  display: flex;
  justify-content: center;
}

.empty-text {
  color: #999;
  font-size: 26rpx;
}

.turn {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.bubble {
  max-width: 80%;
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
}

.bubble.user {
  align-self: flex-end;
  background: #1a1a1a;
  color: #fff;
}

.bubble.assistant {
  align-self: flex-start;
  background: #fff;
  color: #666;
}

.bubble.assistant.error {
  color: #e8543e;
}

.input-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
}

.text-input {
  flex: 1;
  background: #f5f6fa;
  border-radius: 999rpx;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
}

.placeholder {
  color: #bbb;
}

.send-btn {
  padding: 16rpx 32rpx;
  border-radius: 999rpx;
  background: #1a1a1a;
}

.send-btn text {
  color: #fff;
  font-size: 26rpx;
}
</style>

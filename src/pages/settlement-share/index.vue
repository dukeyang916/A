<script setup lang="ts">
import { onLoad, onReady } from '@dcloudio/uni-app'
import { nextTick, ref } from 'vue'
import { useTripWorkspaceStore } from '@/stores/tripWorkspace'

// v1.0 是本地存储、没有后端，不能用"转发小程序页面"分享给同行的人——
// 对方打开小程序时本地是空的，会看到一片空白。所以分享必须落地成
// 一张自包含的图片，存到相册后像发普通照片一样发到群里。
const workspace = useTripWorkspaceStore()
const tripId = ref('')
const tempImagePath = ref('')
const canvasWidth = 600
const canvasHeight = ref(500)

onLoad((query) => {
  tripId.value = (query as { tripId: string }).tripId
  workspace.load(tripId.value)
})

onReady(() => {
  drawCard()
})

function balanceText(net: number): string {
  if (Math.abs(net) < 0.01) return '已平'
  return net > 0 ? `该收 ¥${net.toFixed(2)}` : `该付 ¥${Math.abs(net).toFixed(2)}`
}

async function drawCard() {
  const trip = workspace.trip
  if (!trip) return

  const balances = workspace.settlement.balances.filter((b) => Math.abs(b.net) > 0.01)
  const transfers = workspace.settlement.transfers
  const padding = 40
  const lineHeight = 36

  const transferLines = Math.max(transfers.length, 1)
  const height = 245 + balances.length * lineHeight + 45 + 34 + transferLines * lineHeight + 70
  canvasHeight.value = height
  // 画布高度是按内容动态算的，先让 view 按新高度重排，再取 ctx 绘制，
  // 避免内容在旧高度下被裁掉
  await nextTick()

  const ctx = uni.createCanvasContext('shareCanvas')

  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, canvasWidth, height)

  ctx.setFillStyle('#1a1a1a')
  ctx.setFontSize(24)
  ctx.setTextAlign('left')
  ctx.fillText(trip.name, padding, 60)

  ctx.setFillStyle('#999999')
  ctx.setFontSize(14)
  ctx.fillText(`${trip.destination.name} · ${trip.startDate} ~ ${trip.endDate}`, padding, 90)

  drawDivider(ctx, padding, 115)

  ctx.setFillStyle('#999999')
  ctx.setFontSize(13)
  ctx.fillText('总花费', padding, 150)
  ctx.setFillStyle('#1a1a1a')
  ctx.setFontSize(28)
  ctx.fillText(`¥${workspace.totalAmount.toFixed(2)}`, padding, 185)

  drawDivider(ctx, padding, 210)

  let y = 245
  ctx.setFillStyle('#1a1a1a')
  ctx.setFontSize(15)
  ctx.setTextAlign('left')
  ctx.fillText('每人余额', padding, y)
  y += 34

  for (const b of balances) {
    ctx.setFillStyle('#333333')
    ctx.setFontSize(15)
    ctx.setTextAlign('left')
    ctx.fillText(workspace.memberName(b.memberId), padding, y)

    ctx.setFillStyle(b.net > 0 ? '#19a974' : '#e8543e')
    ctx.setTextAlign('right')
    ctx.fillText(balanceText(b.net), canvasWidth - padding, y)
    y += lineHeight
  }

  y += 10
  drawDivider(ctx, padding, y)
  y += 35

  ctx.setFillStyle('#1a1a1a')
  ctx.setFontSize(15)
  ctx.setTextAlign('left')
  ctx.fillText('转账方案', padding, y)
  y += 34

  if (transfers.length === 0) {
    ctx.setFillStyle('#999999')
    ctx.setFontSize(14)
    ctx.fillText('大家已经两清啦', padding, y)
  } else {
    for (const t of transfers) {
      ctx.setFillStyle('#333333')
      ctx.setFontSize(15)
      ctx.setTextAlign('left')
      ctx.fillText(
        `${workspace.memberName(t.fromMemberId)} 转给 ${workspace.memberName(t.toMemberId)}`,
        padding,
        y
      )
      ctx.setFillStyle('#1a1a1a')
      ctx.setTextAlign('right')
      ctx.fillText(`¥${t.amount.toFixed(2)}`, canvasWidth - padding, y)
      y += lineHeight
    }
  }

  ctx.setFillStyle('#bbbbbb')
  ctx.setFontSize(11)
  ctx.setTextAlign('center')
  ctx.fillText('由「旅程拼账」生成', canvasWidth / 2, height - 30)

  ctx.draw(false, () => {
    uni.canvasToTempFilePath({
      canvasId: 'shareCanvas',
      width: canvasWidth,
      height,
      success: (res) => {
        tempImagePath.value = res.tempFilePath
      },
      fail: () => {
        uni.showToast({ title: '生成图片失败', icon: 'none' })
      },
    })
  })
}

function drawDivider(ctx: UniApp.CanvasContext, x: number, y: number) {
  ctx.setStrokeStyle('#eeeeee')
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(canvasWidth - x, y)
  ctx.stroke()
}

function saveImage() {
  if (!tempImagePath.value) {
    uni.showToast({ title: '图片还在生成中', icon: 'none' })
    return
  }
  uni.saveImageToPhotosAlbum({
    filePath: tempImagePath.value,
    success: () => {
      uni.showToast({ title: '已保存到相册', icon: 'success' })
    },
    fail: () => {
      uni.showModal({
        title: '保存失败',
        content: '请在设置中允许「旅程拼账」访问你的相册',
        showCancel: false,
      })
    },
  })
}
</script>

<template>
  <view class="page">
    <canvas
      canvas-id="shareCanvas"
      id="shareCanvas"
      class="share-canvas"
      :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
    />
    <image v-if="tempImagePath" :src="tempImagePath" class="preview-image" mode="widthFix" />
    <button class="save-btn" @tap="saveImage">保存到相册</button>
    <text class="hint">保存后像发照片一样发到群里，对方不需要安装小程序就能看</text>
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.share-canvas {
  position: fixed;
  top: -9999px;
  left: -9999px;
}

.preview-image {
  width: 100%;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.save-btn {
  margin-top: 32rpx;
  width: 100%;
  background: #1a1a1a;
  color: #fff;
  border-radius: 999rpx;
}

.hint {
  margin-top: 16rpx;
  font-size: 22rpx;
  color: #999;
  text-align: center;
}
</style>

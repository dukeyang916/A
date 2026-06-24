<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { CLOUD_ENV_ID } from '@/constants/cloud'

onLaunch(() => {
  // #ifdef MP-WEIXIN
  if (CLOUD_ENV_ID) {
    wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: false })
  }
  // #endif
})
</script>

<style>
page {
  background-color: #f5f6fa;
  font-size: 28rpx;
  color: #1a1a1a;
}
</style>

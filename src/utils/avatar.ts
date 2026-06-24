const PALETTE = ['#FF6B6B', '#4D96FF', '#6BCB77', '#FFC75F', '#9D8DF1', '#FF9F45']

/** v1 不接微信好友头像，用随机色块 + 姓名首字代替，省掉头像授权/隐私问题 */
export function randomAvatarColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

export function avatarInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}

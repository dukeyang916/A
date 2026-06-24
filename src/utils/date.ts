/** 按本地时区格式化日期，不用 toISOString()——它转 UTC，在 UTC+8 凌晨时段会差一天 */
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

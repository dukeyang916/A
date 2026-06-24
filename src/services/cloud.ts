import { EXPENSE_CATEGORIES } from '@/constants/category'
import { CLOUD_ENV_ID } from '@/constants/cloud'
import type { ExpenseCategory, Member } from '@/types/models'

const NOT_SUPPORTED_ERROR = 'AI 录入功能仅支持微信小程序'

function isCloudReady(): boolean {
  return typeof wx !== 'undefined' && !!wx.cloud && !!CLOUD_ENV_ID
}

// 三个云函数失败时都返回 { error: string } 而不是抛异常，这里统一转成 throw，
// 调用方就能用普通的 try/catch，不用每次都检查返回值里有没有 error 字段。
function callFunction<T>(name: string, data: Record<string, unknown>): Promise<T> {
  if (!isCloudReady()) return Promise.reject(new Error(NOT_SUPPORTED_ERROR))
  return wx.cloud.callFunction({ name, data }).then((res) => {
    const result = res.result as T & { error?: string }
    if (result?.error) throw new Error(result.error)
    return result
  })
}

/** 把本地临时文件（录音/照片）上传到云存储，返回云函数能直接用的 fileID */
export function uploadMediaFile(filePath: string, ext: string): Promise<string> {
  if (!isCloudReady()) return Promise.reject(new Error(NOT_SUPPORTED_ERROR))
  const cloudPath = `expense-media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  return wx.cloud.uploadFile({ cloudPath, filePath }).then((res) => res.fileID)
}

export interface OcrReceiptResult {
  rawText: string
  amountGuess?: number
}

export function ocrReceipt(fileID: string): Promise<OcrReceiptResult> {
  return callFunction<OcrReceiptResult>('expenseOcr', { fileID })
}

export function transcribeVoice(fileID: string): Promise<{ text: string }> {
  return callFunction<{ text: string }>('expenseAsr', { fileID })
}

export interface ExpenseParseResult {
  amount?: number
  category: ExpenseCategory
  note?: string
  payerMemberId?: string
}

export function parseExpenseText(text: string, members: Member[]): Promise<ExpenseParseResult> {
  return callFunction<ExpenseParseResult>('expenseParse', {
    text,
    members: members.map((m) => ({ id: m._id, name: m.name, isMe: m.isMe })),
    categories: EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
  })
}

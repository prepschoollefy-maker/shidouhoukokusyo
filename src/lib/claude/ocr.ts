import { getClaudeClient } from './client'

interface OcrField {
  value: string
  confidence: 'high' | 'low'
}

export interface OcrResult {
  student_name: OcrField
  lesson_date: OcrField
  subject: OcrField
  textbooks: { textbook_name: OcrField; pages: OcrField }[]
  unit_covered: OcrField
  homework_check: OcrField
  positive_attitudes: OcrField
  negative_attitudes: OcrField
  free_comment: OcrField
  homework_assigned: OcrField
  next_lesson_plan: OcrField
  internal_notes: OcrField
}

export async function performOcr(imageBase64: string, mimeType: string): Promise<OcrResult> {
  const client = getClaudeClient()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `この画像は個別指導塾の授業レポート用紙です。手書きの内容を読み取り、以下のJSON形式で返してください。
各フィールドは { "value": "読み取った内容", "confidence": "high" または "low" } の形式です。
読み取りに自信がない箇所は confidence を "low" にしてください。
空欄の項目は value を空文字列にしてください。

{
  "student_name": { "value": "", "confidence": "high" },
  "lesson_date": { "value": "YYYY-MM-DD形式", "confidence": "high" },
  "subject": { "value": "科目名", "confidence": "high" },
  "textbooks": [
    { "textbook_name": { "value": "", "confidence": "high" }, "pages": { "value": "", "confidence": "high" } }
  ],
  "unit_covered": { "value": "", "confidence": "high" },
  "homework_check": { "value": "done/partial/not_done のいずれか", "confidence": "high" },
  "positive_attitudes": { "value": "カンマ区切りで列挙", "confidence": "high" },
  "negative_attitudes": { "value": "カンマ区切りで列挙", "confidence": "high" },
  "free_comment": { "value": "", "confidence": "high" },
  "homework_assigned": { "value": "", "confidence": "high" },
  "next_lesson_plan": { "value": "", "confidence": "high" },
  "internal_notes": { "value": "", "confidence": "high" }
}

JSONのみを返してください。説明文は不要です。`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('OCR結果のパースに失敗しました')
  }
  return JSON.parse(jsonMatch[0]) as OcrResult
}

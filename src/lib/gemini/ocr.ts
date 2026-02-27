import { getGeminiClient } from './client'

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
  strengths: OcrField
  weaknesses: OcrField
  free_comment: OcrField
  homework_assigned: OcrField
  next_lesson_plan: OcrField
  internal_notes: OcrField
}

const OCR_PROMPT = `あなたは個別指導塾「レフィー」の授業レポート用紙を読み取る専門家です。
この画像は講師が手書きで記入した授業レポートです。

## 用紙のレイアウト（上から順に）

1. **上部の行**: 「日付」「生徒名」「科目」が横一列に並んでいます（下線の上に手書き）
2. **使用テキスト**: テーブル形式で「テキスト名」と「ページ」の2列、2行あります
3. **扱った単元**: 自由記述欄
4. **前回の宿題チェック**: チェックボックス3つ（□やってきた　□一部やった　□やってきていない）。チェック（✓やレ）または○がついている項目が該当です
5. **生徒の様子**:
   - 左半分「ポジティブ」: 選択肢に○をつける形式（集中していた／積極的だった／理解が早かった／質問ができた／丁寧に取り組めた／前回より成長した／その他）
   - 右半分「ネガティブ」: 同様（集中が切れやすい／眠そう／理解が追いつかない／やる気が低い／ケアレスミスが多い／その他）
6. **理解できていたこと・得意なこと**: 自由記述欄
7. **理解不十分・苦手なこと**: 自由記述欄
8. **様子の自由コメント**: 自由記述欄
9. **宿題内容**: 自由記述欄
10. **次回やること**: 自由記述欄
11. **講師間申し送り（保護者には非公開）**: オレンジ色の点線枠、自由記述欄

## 読み取りの指示

手書きの日本語を丁寧に読み取ってください。
- 文字が崩れていても、文脈から推測して**自然な日本語の文章**にしてください
- 塾の授業レポートなので、教科・学習内容に関する用語が多いはずです
- 読めない文字は前後の文脈から推測してください。それでも不明な場合のみ confidence を "low" にしてください
- 空欄の項目は value を空文字列にしてください

まず、画像の手書き内容をじっくり観察し、各欄に何が書かれているか考えてください。
その後、以下のJSON形式で結果を出力してください。

\`\`\`json
{
  "student_name": { "value": "生徒のフルネーム", "confidence": "high" },
  "lesson_date": { "value": "YYYY-MM-DD", "confidence": "high" },
  "subject": { "value": "科目名（例: 数学、英語、国語）", "confidence": "high" },
  "textbooks": [
    { "textbook_name": { "value": "テキスト名", "confidence": "high" }, "pages": { "value": "ページ番号", "confidence": "high" } }
  ],
  "unit_covered": { "value": "扱った単元の内容", "confidence": "high" },
  "homework_check": { "value": "done または partial または not_done", "confidence": "high" },
  "positive_attitudes": { "value": "○がついた項目をカンマ区切り", "confidence": "high" },
  "negative_attitudes": { "value": "○がついた項目をカンマ区切り", "confidence": "high" },
  "strengths": { "value": "理解できていたこと", "confidence": "high" },
  "weaknesses": { "value": "理解不十分なこと", "confidence": "high" },
  "free_comment": { "value": "自由コメントの内容", "confidence": "high" },
  "homework_assigned": { "value": "宿題の内容", "confidence": "high" },
  "next_lesson_plan": { "value": "次回やること", "confidence": "high" },
  "internal_notes": { "value": "講師間申し送りの内容", "confidence": "high" }
}
\`\`\``

export async function performOcr(imageBase64: string, mimeType: string): Promise<OcrResult> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: { maxOutputTokens: 8192 },
  })

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
    { text: OCR_PROMPT },
  ])

  const text = result.response.text()
  // Extract JSON from response - it may be wrapped in ```json ... ``` or preceded by thinking text
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/)
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : text
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('OCR結果のパースに失敗しました')
  }
  return JSON.parse(jsonMatch[0]) as OcrResult
}

import { getClaudeClient } from './client'
import type { ReportWithDetails } from '@/types/report'

export async function generateSummary(
  reports: ReportWithDetails[],
  studentName: string,
  grade: string | null
): Promise<string> {
  const client = getClaudeClient()

  const reportTexts = reports.map((r, i) => {
    const textbooks = r.report_textbooks
      .map(t => `${t.textbook_name}${t.pages ? ` (${t.pages})` : ''}`)
      .join('、')
    const positiveAttitudes = r.report_attitudes
      .filter(a => a.attitude_option.category === 'positive')
      .map(a => a.attitude_option.label)
      .join('、')
    const negativeAttitudes = r.report_attitudes
      .filter(a => a.attitude_option.category === 'negative')
      .map(a => a.attitude_option.label)
      .join('、')
    const homeworkMap: Record<string, string> = {
      done: 'やってきた',
      partial: '一部やった',
      not_done: 'やってきていない',
    }

    return `--- 授業${i + 1} (${r.lesson_date}) ---
科目: ${r.subject.name}
使用テキスト: ${textbooks}
扱った単元: ${r.unit_covered}
前回宿題チェック: ${homeworkMap[r.homework_check]}
ポジティブな様子: ${positiveAttitudes || 'なし'}
ネガティブな様子: ${negativeAttitudes || 'なし'}
様子の自由コメント: ${r.free_comment || 'なし'}
宿題内容: ${r.homework_assigned}
次回やること: ${r.next_lesson_plan || '未定'}`
  }).join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    temperature: 0.3,
    messages: [
      {
        role: 'user',
        content: `あなたは個別指導塾の学習レポートをまとめるアシスタントです。
以下の授業レポートデータをもとに、保護者向けの学習まとめを作成してください。

生徒: ${studentName}${grade ? ` (${grade})` : ''}

${reportTexts}

以下の4セクション構成でまとめてください：

【学習進捗】
対象期間にどのテキストのどの範囲を扱い、どんな単元を学習したか。

【理解度・課題】
各単元の理解状況、つまずきポイント、前回からの変化。

【授業中の様子】
態度・姿勢面の特徴、ポジティブな変化、課題。

【今後の方針・ご家庭へのお願い】
次に取り組む内容、宿題の状況を踏まえた家庭への依頼。

文体ルール：
- シンプル・端的な敬語。冗長な表現を避ける
- 事実ベースで書く。根拠のない評価をしない
- ネガティブな内容は建設的に表現する（例：「できなかった」→「課題として残っています」）
- 保護者が読んで「ちゃんと見てもらっている」と感じる具体性を担保する
- 講師間申し送り（internal_notes）は含めない`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

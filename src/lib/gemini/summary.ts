import { getGeminiClient } from './client'
import type { ReportWithDetails } from '@/types/report'

function formatReportText(r: ReportWithDetails, index: number): string {
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

  // Type assertion for new fields that may not be in the type yet
  const report = r as ReportWithDetails & { strengths?: string | null; weaknesses?: string | null }

  return `--- 授業${index + 1} (${r.lesson_date}) ---
科目: ${r.subject.name}
使用テキスト: ${textbooks}
扱った単元: ${r.unit_covered}
前回宿題チェック: ${homeworkMap[r.homework_check]}
ポジティブな様子: ${positiveAttitudes || 'なし'}
ネガティブな様子: ${negativeAttitudes || 'なし'}
理解できていたこと・得意なこと: ${report.strengths || 'なし'}
理解不十分・苦手なこと: ${report.weaknesses || 'なし'}
様子の自由コメント: ${r.free_comment || 'なし'}
宿題内容: ${r.homework_assigned}
次回やること: ${r.next_lesson_plan || '未定'}`
}

/**
 * 毎授業レポート: 1件のレポートから保護者向けの授業報告を生成
 */
export async function generateLessonSummary(
  report: ReportWithDetails,
  studentName: string,
  grade: string | null
): Promise<string> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  })

  const reportText = formatReportText(report, 0)

  const result = await model.generateContent(`あなたは個別指導塾の授業レポートを保護者向けに要約するアシスタントです。
以下の1回の授業データをもとに、保護者向けの授業報告を作成してください。

生徒: ${studentName}${grade ? ` (${grade})` : ''}

${reportText}

以下の構成でまとめてください：

【本日の学習内容】
使用テキスト、扱った単元を簡潔に。

【理解度】
理解できていたこと、まだ課題が残っている点。

【授業中の様子】
態度・姿勢、集中度、気になった点。

【宿題・次回予定】
出した宿題と次回の予定。

文体ルール：
- シンプル・端的な敬語。冗長な表現を避ける
- 事実ベースで書く。根拠のない評価をしない
- ネガティブな内容は建設的に表現する
- 保護者が読んで「ちゃんと見てもらっている」と感じる具体性を担保する
- 講師間申し送り（internal_notes）は含めない
- 全体で300〜500字程度にまとめる`)

  return result.response.text()
}

/**
 * 月間レポート: 複数のレポートから保護者向けの月間まとめを生成
 */
export async function generateMonthlySummary(
  reports: ReportWithDetails[],
  studentName: string,
  grade: string | null,
  periodLabel: string
): Promise<string> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  })

  const reportTexts = reports.map((r, i) => formatReportText(r, i)).join('\n\n')

  const result = await model.generateContent(`あなたは個別指導塾の学習レポートをまとめるアシスタントです。
以下の${periodLabel}の授業レポートデータをもとに、保護者向けの学習まとめを作成してください。

生徒: ${studentName}${grade ? ` (${grade})` : ''}

${reportTexts}

以下の4セクション構成でまとめてください：

【${periodLabel}の学習進捗】
この期間にどのテキストのどの範囲を扱い、どんな単元を学習したか。

【理解度・課題】
各単元の理解状況、つまずきポイント、期間を通しての変化・成長。

【授業中の様子】
態度・姿勢面の特徴、ポジティブな変化、課題。

【今後の方針・ご家庭へのお願い】
今後取り組む内容、宿題の状況を踏まえた家庭への依頼。

文体ルール：
- シンプル・端的な敬語。冗長な表現を避ける
- 事実ベースで書く。根拠のない評価をしない
- ネガティブな内容は建設的に表現する（例：「できなかった」→「課題として残っています」）
- 保護者が読んで「ちゃんと見てもらっている」と感じる具体性を担保する
- 講師間申し送り（internal_notes）は含めない`)

  return result.response.text()
}

/**
 * 旧互換: generateSummary は generateMonthlySummary のラッパー
 */
export async function generateSummary(
  reports: ReportWithDetails[],
  studentName: string,
  grade: string | null
): Promise<string> {
  const now = new Date()
  const m = now.getMonth() + 1
  return generateMonthlySummary(reports, studentName, grade, `${m}月`)
}

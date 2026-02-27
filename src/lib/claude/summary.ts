import { getClaudeClient } from './client'
import { DEFAULT_LESSON_PROMPT, DEFAULT_MONTHLY_PROMPT, resolvePromptTemplate } from './prompts'
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
  grade: string | null,
  customPrompt?: string | null
): Promise<string> {
  const client = getClaudeClient()

  const reportText = formatReportText(report, 0)
  const template = customPrompt || DEFAULT_LESSON_PROMPT
  const prompt = resolvePromptTemplate(template, {
    student_name: studentName,
    grade,
    report_data: reportText,
  })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

/**
 * 月間レポート: 複数のレポートから保護者向けの月間まとめを生成
 */
export async function generateMonthlySummary(
  reports: ReportWithDetails[],
  studentName: string,
  grade: string | null,
  periodLabel: string,
  customPrompt?: string | null
): Promise<string> {
  const client = getClaudeClient()

  const reportTexts = reports.map((r, i) => formatReportText(r, i)).join('\n\n')
  const template = customPrompt || DEFAULT_MONTHLY_PROMPT
  const prompt = resolvePromptTemplate(template, {
    student_name: studentName,
    grade,
    report_data: reportTexts,
    period_label: periodLabel,
  })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
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
  return generateMonthlySummary(reports, studentName, grade, `${m}月`, undefined)
}

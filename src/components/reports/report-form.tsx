'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Student { id: string; name: string }
interface Subject { id: string; name: string }
interface AttitudeOption { id: string; label: string; category: string }
interface TextbookSuggestion { id: string; name: string }

interface FormData {
  student_id: string
  lesson_date: string
  subject_id: string
  textbooks: { textbook_name: string; pages: string }[]
  unit_covered: string
  homework_check: string
  positive_attitudes: string[]
  negative_attitudes: string[]
  strengths: string
  weaknesses: string
  free_comment: string
  homework_assigned: string
  next_lesson_plan: string
  internal_notes: string
}

interface OcrInitialData extends Partial<FormData> {
  _ocr_student_name?: string
  _ocr_subject_name?: string
  _ocr_positive_attitudes?: string
  _ocr_negative_attitudes?: string
}

interface ReportFormProps {
  initialData?: OcrInitialData
  reportId?: string
  ocrHighlights?: Record<string, boolean>
}

// Find best matching item by partial/fuzzy text match
function findBestMatch(ocrText: string, items: { id: string; name: string }[]): string | null {
  if (!ocrText) return null
  const normalized = ocrText.replace(/\s+/g, '').toLowerCase()
  // Exact match first
  const exact = items.find(i => i.name.replace(/\s+/g, '').toLowerCase() === normalized)
  if (exact) return exact.id
  // Contains match
  const contains = items.find(i => normalized.includes(i.name.replace(/\s+/g, '').toLowerCase()) || i.name.replace(/\s+/g, '').toLowerCase().includes(normalized))
  if (contains) return contains.id
  return null
}

const sectionThemes = {
  blue: { border: 'border-l-blue-500', bg: 'bg-blue-50/50', icon: 'text-blue-600', dot: 'bg-blue-500' },
  emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-50/50', icon: 'text-emerald-600', dot: 'bg-emerald-500' },
  amber: { border: 'border-l-amber-500', bg: 'bg-amber-50/50', icon: 'text-amber-600', dot: 'bg-amber-500' },
} as const

type ThemeKey = keyof typeof sectionThemes

function SectionCard({ title, children, defaultOpen = true, theme = 'blue' }: { title: string; children: React.ReactNode; defaultOpen?: boolean; theme?: ThemeKey }) {
  const [open, setOpen] = useState(defaultOpen)
  const t = sectionThemes[theme]
  return (
    <Card className={`border-l-4 ${t.border} overflow-hidden`}>
      <CardHeader className={`cursor-pointer select-none py-3 px-4 ${t.bg}`} onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${t.dot}`} />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {open ? <ChevronUp className={`h-4 w-4 ${t.icon}`} /> : <ChevronDown className={`h-4 w-4 ${t.icon}`} />}
        </div>
      </CardHeader>
      {open && <CardContent className="space-y-4 pt-4">{children}</CardContent>}
    </Card>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-red-600 mt-1">{message}</p>
}

export function ReportForm({ initialData, reportId, ocrHighlights }: ReportFormProps) {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [attitudes, setAttitudes] = useState<AttitudeOption[]>([])
  const [textbookSuggestions, setTextbookSuggestions] = useState<TextbookSuggestion[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      student_id: '',
      lesson_date: format(new Date(), 'yyyy-MM-dd'),
      subject_id: '',
      textbooks: [{ textbook_name: '', pages: '' }],
      unit_covered: '',
      homework_check: 'done',
      positive_attitudes: [],
      negative_attitudes: [],
      strengths: '',
      weaknesses: '',
      free_comment: '',
      homework_assigned: '',
      next_lesson_plan: '',
      internal_notes: '',
      ...initialData,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'textbooks' })
  const watchPositive = watch('positive_attitudes')
  const watchNegative = watch('negative_attitudes')

  useEffect(() => {
    const fetchData = async () => {
      const [studentsRes, subjectsRes, attitudesRes, textbooksRes] = await Promise.all([
        fetch('/api/students'),
        fetch('/api/master/subjects'),
        fetch('/api/master/attitudes'),
        fetch('/api/master/textbooks'),
      ])
      const [studentsJson, subjectsJson, attitudesJson, textbooksJson] = await Promise.all([
        studentsRes.json(), subjectsRes.json(), attitudesRes.json(), textbooksRes.json(),
      ])
      const studentsList: Student[] = studentsJson.data || []
      const subjectsList: Subject[] = subjectsJson.data || []
      const attitudesList: AttitudeOption[] = attitudesJson.data || []
      setStudents(studentsList)
      setSubjects(subjectsList)
      setAttitudes(attitudesList)
      setTextbookSuggestions(textbooksJson.data || [])

      // OCR fuzzy matching: auto-select student, subject, and attitudes
      if (initialData?._ocr_student_name) {
        const match = findBestMatch(initialData._ocr_student_name, studentsList)
        if (match) setValue('student_id', match)
      }
      if (initialData?._ocr_subject_name) {
        const match = findBestMatch(initialData._ocr_subject_name, subjectsList)
        if (match) setValue('subject_id', match)
      }
      if (initialData?._ocr_positive_attitudes) {
        const ocrLabels = initialData._ocr_positive_attitudes.split(/[,、，]/).map(s => s.trim()).filter(Boolean)
        const matched = attitudesList
          .filter(a => a.category === 'positive' && ocrLabels.some(label => a.label.includes(label) || label.includes(a.label)))
          .map(a => a.id)
        if (matched.length > 0) setValue('positive_attitudes', matched)
      }
      if (initialData?._ocr_negative_attitudes) {
        const ocrLabels = initialData._ocr_negative_attitudes.split(/[,、，]/).map(s => s.trim()).filter(Boolean)
        const matched = attitudesList
          .filter(a => a.category === 'negative' && ocrLabels.some(label => a.label.includes(label) || label.includes(a.label)))
          .map(a => a.id)
        if (matched.length > 0) setValue('negative_attitudes', matched)
      }
    }
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAttitude = (category: 'positive' | 'negative', id: string) => {
    const field = category === 'positive' ? 'positive_attitudes' : 'negative_attitudes'
    const current = category === 'positive' ? watchPositive : watchNegative
    if (current.includes(id)) {
      setValue(field, current.filter(a => a !== id))
    } else {
      setValue(field, [...current, id])
    }
    if (category === 'positive') {
      setValidationErrors(prev => { const n = { ...prev }; delete n.positive_attitudes; return n })
    }
  }

  const onSubmit = async (data: FormData) => {
    const errs: Record<string, string> = {}
    if (!data.student_id) errs.student_id = '生徒を選択してください'
    if (!data.subject_id) errs.subject_id = '科目を選択してください'
    if (data.textbooks.some(t => !t.textbook_name)) errs.textbooks = 'テキスト名を入力してください'
    if (data.positive_attitudes.length === 0) errs.positive_attitudes = 'ポジティブな様子を最低1つ選択してください'

    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs)
      return
    }
    setValidationErrors({})

    setSubmitting(true)
    try {
      const url = reportId ? `/api/reports/${reportId}` : '/api/reports'
      const method = reportId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '送信に失敗しました')
      }

      toast.success(reportId ? 'レポートを更新しました' : 'レポートを送信しました')
      router.back()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const positiveAttitudes = attitudes.filter(a => a.category === 'positive')
  const negativeAttitudes = attitudes.filter(a => a.category === 'negative')

  const highlightClass = (field: string) =>
    ocrHighlights?.[field] ? 'ring-2 ring-orange-400 bg-orange-50' : ''

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Section 1: 基本情報 */}
      <SectionCard title="基本情報" theme="blue">
        {/* Student */}
        <div className="space-y-2">
          <Label>生徒名 *</Label>
          <Select
            value={watch('student_id')}
            onValueChange={(v) => {
              setValue('student_id', v)
              setValidationErrors(prev => { const n = { ...prev }; delete n.student_id; return n })
            }}
          >
            <SelectTrigger className={`${highlightClass('student_name')} ${validationErrors.student_id ? 'border-red-500' : ''}`}>
              <SelectValue placeholder="生徒を選択" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={validationErrors.student_id} />
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label>日付 *</Label>
          <Input
            type="date"
            {...register('lesson_date', { required: true })}
            className={highlightClass('lesson_date')}
          />
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label>科目 *</Label>
          <Select
            value={watch('subject_id')}
            onValueChange={(v) => {
              setValue('subject_id', v)
              setValidationErrors(prev => { const n = { ...prev }; delete n.subject_id; return n })
            }}
          >
            <SelectTrigger className={`${highlightClass('subject')} ${validationErrors.subject_id ? 'border-red-500' : ''}`}>
              <SelectValue placeholder="科目を選択" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={validationErrors.subject_id} />
        </div>

        {/* Textbooks */}
        <div className="space-y-2">
          <Label>使用テキスト *</Label>
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <Input
                {...register(`textbooks.${index}.textbook_name`)}
                placeholder="テキスト名"
                className={`flex-1 ${highlightClass('textbooks')} ${validationErrors.textbooks ? 'border-red-500' : ''}`}
                list="textbook-suggestions"
              />
              <Input
                {...register(`textbooks.${index}.pages`)}
                placeholder="ページ"
                className="w-32"
              />
              {fields.length > 1 && (
                <Button type="button" variant="ghost" size="icon" aria-label="テキスト削除" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <FieldError message={validationErrors.textbooks} />
          <datalist id="textbook-suggestions">
            {textbookSuggestions.map(t => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ textbook_name: '', pages: '' })}>
            <Plus className="h-4 w-4 mr-1" /> 追加
          </Button>
        </div>

        {/* Unit */}
        <div className="space-y-2">
          <Label>扱った単元 *</Label>
          <Input
            {...register('unit_covered', { required: true })}
            placeholder="例：通分、異分母の足し算"
            className={highlightClass('unit_covered')}
          />
          {errors.unit_covered && <FieldError message="扱った単元を入力してください" />}
        </div>

        {/* Homework check */}
        <div className="space-y-2">
          <Label>前回宿題のチェック *</Label>
          <Select
            value={watch('homework_check')}
            onValueChange={(v) => setValue('homework_check', v)}
          >
            <SelectTrigger className={highlightClass('homework_check')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="done">やってきた</SelectItem>
              <SelectItem value="partial">一部やった</SelectItem>
              <SelectItem value="not_done">やってきていない</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {/* Section 2: 授業内容・生徒の様子 */}
      <SectionCard title="授業内容・生徒の様子" theme="emerald">
        {/* Positive attitudes */}
        <div className="space-y-2">
          <Label>生徒の様子（ポジティブ）* 最低1つ</Label>
          <div className="flex flex-wrap gap-2">
            {positiveAttitudes.map((a) => (
              <Badge
                key={a.id}
                variant={watchPositive.includes(a.id) ? 'default' : 'outline'}
                className={`cursor-pointer select-none ${
                  watchPositive.includes(a.id) ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50'
                }`}
                onClick={() => toggleAttitude('positive', a.id)}
              >
                {a.label}
              </Badge>
            ))}
          </div>
          <FieldError message={validationErrors.positive_attitudes} />
        </div>

        {/* Negative attitudes */}
        <div className="space-y-2">
          <Label>生徒の様子（ネガティブ）</Label>
          <div className="flex flex-wrap gap-2">
            {negativeAttitudes.map((a) => (
              <Badge
                key={a.id}
                variant={watchNegative.includes(a.id) ? 'default' : 'outline'}
                className={`cursor-pointer select-none ${
                  watchNegative.includes(a.id) ? 'bg-orange-600 hover:bg-orange-700' : 'hover:bg-orange-50'
                }`}
                onClick={() => toggleAttitude('negative', a.id)}
              >
                {a.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Strengths */}
        <div className="space-y-2">
          <Label>理解できていたこと・得意なこと</Label>
          <Textarea
            {...register('strengths')}
            rows={5}
            placeholder={"例：\n・分数の通分の手順を自分で説明できていた\n・計算ミスが前回より減り、途中式も丁寧に書けていた\n・応用問題にも自分から挑戦しようとしていた"}
            className={highlightClass('strengths')}
          />
        </div>

        {/* Weaknesses */}
        <div className="space-y-2">
          <Label>理解不十分・苦手なこと</Label>
          <Textarea
            {...register('weaknesses')}
            rows={5}
            placeholder={"例：\n・帯分数と仮分数の変換でまだ混乱する場面があった\n・文章題で何を求めるのか読み取れず手が止まっていた\n・かけ算の繰り上がりで計算ミスが出やすい"}
            className={highlightClass('weaknesses')}
          />
        </div>

        {/* Free comment */}
        <div className="space-y-2">
          <Label>様子の自由コメント</Label>
          <Textarea
            {...register('free_comment')}
            rows={5}
            placeholder={"例：\n・最初は眠そうだったが、後半の文章題で急にスイッチが入った\n・隣の生徒と話してしまう場面があったが、注意後は集中できた\n・前回苦手だった単元を復習したところ、自信がついた様子だった"}
            className={highlightClass('free_comment')}
          />
        </div>
      </SectionCard>

      {/* Section 3: 宿題・次回・申し送り */}
      <SectionCard title="宿題・次回・申し送り" theme="amber">
        {/* Homework assigned */}
        <div className="space-y-2">
          <Label>宿題内容 *</Label>
          <p className="text-xs text-muted-foreground">※ 宿題を出さない場合は「宿題なし」と入力してください</p>
          <Textarea
            {...register('homework_assigned', { required: true })}
            rows={4}
            placeholder={"例：\n・テキストP.52〜53 練習問題1〜5\n・漢字プリント1枚（20問）\n・英単語テスト範囲の暗記（Unit3）"}
            className={highlightClass('homework_assigned')}
          />
          {errors.homework_assigned && <FieldError message="宿題内容を入力してください" />}
        </div>

        {/* Next lesson plan */}
        <div className="space-y-2">
          <Label>次回やること</Label>
          <Textarea
            {...register('next_lesson_plan')}
            rows={4}
            placeholder={"例：\n・宿題の答え合わせと間違い直し\n・前回の続き（P.54〜）異分母の引き算\n・余裕があれば小テストで定着確認"}
            className={highlightClass('next_lesson_plan')}
          />
        </div>

        {/* Internal notes */}
        <div className="space-y-2">
          <Label>講師間申し送り（保護者には非公開）</Label>
          <Textarea
            {...register('internal_notes')}
            rows={4}
            placeholder={"例：\n・来週は定期テスト前なのでテスト範囲の復習を優先してください\n・計算の途中式を省略する癖があるので、書くよう声かけをお願いします"}
            className={`${highlightClass('internal_notes')} bg-yellow-50`}
          />
        </div>
      </SectionCard>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.back()}
        >
          キャンセル
        </Button>
        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={submitting}>
          {submitting ? '送信中...' : reportId ? '更新する' : '送信する'}
        </Button>
      </div>
    </form>
  )
}

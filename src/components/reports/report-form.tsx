'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
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
  free_comment: string
  homework_assigned: string
  next_lesson_plan: string
  internal_notes: string
}

interface ReportFormProps {
  initialData?: Partial<FormData>
  reportId?: string
  ocrHighlights?: Record<string, boolean>
}

export function ReportForm({ initialData, reportId, ocrHighlights }: ReportFormProps) {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [attitudes, setAttitudes] = useState<AttitudeOption[]>([])
  const [textbookSuggestions, setTextbookSuggestions] = useState<TextbookSuggestion[]>([])
  const [submitting, setSubmitting] = useState(false)

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
      setStudents(studentsJson.data || [])
      setSubjects(subjectsJson.data || [])
      setAttitudes(attitudesJson.data || [])
      setTextbookSuggestions(textbooksJson.data || [])
    }
    fetchData()
  }, [])

  const toggleAttitude = (category: 'positive' | 'negative', id: string) => {
    const field = category === 'positive' ? 'positive_attitudes' : 'negative_attitudes'
    const current = category === 'positive' ? watchPositive : watchNegative
    if (current.includes(id)) {
      setValue(field, current.filter(a => a !== id))
    } else {
      setValue(field, [...current, id])
    }
  }

  const onSubmit = async (data: FormData) => {
    if (data.positive_attitudes.length === 0) {
      toast.error('ポジティブな様子を最低1つ選択してください')
      return
    }
    if (data.textbooks.some(t => !t.textbook_name)) {
      toast.error('テキスト名を入力してください')
      return
    }

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
      router.push('/reports')
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
      <Card>
        <CardContent className="space-y-4 pt-4">
          {/* Student */}
          <div className="space-y-2">
            <Label>生徒名 *</Label>
            <Select
              value={watch('student_id')}
              onValueChange={(v) => setValue('student_id', v)}
            >
              <SelectTrigger className={highlightClass('student_name')}>
                <SelectValue placeholder="生徒を選択" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              onValueChange={(v) => setValue('subject_id', v)}
            >
              <SelectTrigger className={highlightClass('subject')}>
                <SelectValue placeholder="科目を選択" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Textbooks */}
          <div className="space-y-2">
            <Label>使用テキスト *</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <Input
                  {...register(`textbooks.${index}.textbook_name`)}
                  placeholder="テキスト名"
                  className={`flex-1 ${highlightClass('textbooks')}`}
                  list="textbook-suggestions"
                />
                <Input
                  {...register(`textbooks.${index}.pages`)}
                  placeholder="ページ"
                  className="w-32"
                />
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
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

          {/* Free comment */}
          <div className="space-y-2">
            <Label>様子の自由コメント</Label>
            <Textarea
              {...register('free_comment')}
              placeholder="例：最初はだるそうだったが、後半の文章題で急にスイッチ入った"
              className={highlightClass('free_comment')}
            />
          </div>

          {/* Homework assigned */}
          <div className="space-y-2">
            <Label>宿題内容 *</Label>
            <Textarea
              {...register('homework_assigned', { required: true })}
              placeholder="出した宿題の内容"
              className={highlightClass('homework_assigned')}
            />
          </div>

          {/* Next lesson plan */}
          <div className="space-y-2">
            <Label>次回やること</Label>
            <Textarea
              {...register('next_lesson_plan')}
              placeholder="次回授業の冒頭でやること"
              className={highlightClass('next_lesson_plan')}
            />
          </div>

          {/* Internal notes */}
          <div className="space-y-2">
            <Label>講師間申し送り（保護者には非公開）</Label>
            <Textarea
              {...register('internal_notes')}
              placeholder="担当変更時などの引き継ぎ用"
              className={`${highlightClass('internal_notes')} bg-yellow-50`}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? '送信中...' : reportId ? '更新する' : '送信する'}
      </Button>
    </form>
  )
}

'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, Upload, Loader2 } from 'lucide-react'
import { ReportForm } from '@/components/reports/report-form'
import { toast } from 'sonner'

export default function OcrPage() {
  const [loading, setLoading] = useState(false)
  const [ocrData, setOcrData] = useState<Record<string, unknown> | null>(null)
  const [highlights, setHighlights] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const processImage = async (file: File) => {
    setLoading(true)
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type }),
      })

      if (!res.ok) throw new Error('OCR処理に失敗しました')

      const { data } = await res.json()

      // Build form data and highlights from OCR result
      const formData: Record<string, unknown> = {}
      const newHighlights: Record<string, boolean> = {}

      if (data.lesson_date?.value) {
        formData.lesson_date = data.lesson_date.value
        if (data.lesson_date.confidence === 'low') newHighlights.lesson_date = true
      }
      if (data.unit_covered?.value) {
        formData.unit_covered = data.unit_covered.value
        if (data.unit_covered.confidence === 'low') newHighlights.unit_covered = true
      }
      if (data.homework_check?.value) {
        formData.homework_check = data.homework_check.value
        if (data.homework_check.confidence === 'low') newHighlights.homework_check = true
      }
      if (data.free_comment?.value) {
        formData.free_comment = data.free_comment.value
        if (data.free_comment.confidence === 'low') newHighlights.free_comment = true
      }
      if (data.homework_assigned?.value) {
        formData.homework_assigned = data.homework_assigned.value
        if (data.homework_assigned.confidence === 'low') newHighlights.homework_assigned = true
      }
      if (data.next_lesson_plan?.value) {
        formData.next_lesson_plan = data.next_lesson_plan.value
        if (data.next_lesson_plan.confidence === 'low') newHighlights.next_lesson_plan = true
      }
      if (data.internal_notes?.value) {
        formData.internal_notes = data.internal_notes.value
        if (data.internal_notes.confidence === 'low') newHighlights.internal_notes = true
      }
      if (data.textbooks?.length) {
        formData.textbooks = data.textbooks.map((t: { textbook_name: { value: string }; pages: { value: string } }) => ({
          textbook_name: t.textbook_name.value,
          pages: t.pages.value,
        }))
        if (data.textbooks.some((t: { textbook_name: { confidence: string } }) => t.textbook_name.confidence === 'low')) {
          newHighlights.textbooks = true
        }
      }

      setOcrData(formData)
      setHighlights(newHighlights)
      toast.success('読み取りが完了しました。内容を確認してください。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'OCR処理に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processImage(file)
  }

  if (ocrData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">写真から入力</h2>
          <Button variant="outline" onClick={() => setOcrData(null)}>やり直す</Button>
        </div>
        {Object.keys(highlights).length > 0 && (
          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="py-3 px-4 text-sm text-orange-800">
              オレンジ色のハイライトがある項目は読み取り精度が低い可能性があります。確認してください。
            </CardContent>
          </Card>
        )}
        <ReportForm initialData={ocrData as Record<string, string>} ocrHighlights={highlights} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">写真から入力</h2>

      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-muted-foreground">画像を解析中...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <Card className="cursor-pointer hover:bg-gray-50" onClick={() => cameraInputRef.current?.click()}>
            <CardContent className="flex flex-col items-center justify-center py-8 space-y-2">
              <Camera className="h-10 w-10 text-blue-600" />
              <p className="font-medium">カメラで撮影</p>
              <p className="text-sm text-muted-foreground">紙のレポートを撮影して読み取ります</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-gray-50" onClick={() => fileInputRef.current?.click()}>
            <CardContent className="flex flex-col items-center justify-center py-8 space-y-2">
              <Upload className="h-10 w-10 text-blue-600" />
              <p className="font-medium">画像を選択</p>
              <p className="text-sm text-muted-foreground">保存済みの画像から選択します</p>
            </CardContent>
          </Card>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

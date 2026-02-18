'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'

interface CsvImportDialogProps {
  title: string
  description: string
  sampleCsv: string
  apiEndpoint: string
  onSuccess: () => void
}

export function CsvImportDialog({ title, description, sampleCsv, apiEndpoint, onSuccess }: CsvImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[][]>([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      const rows = lines.map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
      setPreview(rows.slice(0, 6)) // header + 5 rows max
    }
    reader.readAsText(f, 'UTF-8')
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = values[i] || '' })
        return obj
      })

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'インポートに失敗しました')
      }

      const result = await res.json()
      toast.success(`${result.count}件をインポートしました`)
      setOpen(false)
      setFile(null)
      setPreview([])
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'インポートに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadSample = () => {
    const bom = '\uFEFF'
    const blob = new Blob([bom + sampleCsv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setFile(null); setPreview([]) } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="h-4 w-4 mr-1" />CSVインポート</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button variant="link" className="p-0 h-auto text-sm" onClick={handleDownloadSample}>
            サンプルCSVをダウンロード
          </Button>

          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50"
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <p className="text-sm">{file.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">クリックしてCSVファイルを選択</p>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

          {preview.length > 0 && (
            <div className="overflow-x-auto max-h-48">
              <table className="text-xs w-full">
                <thead>
                  <tr>
                    {preview[0].map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left bg-gray-100 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, i) => (
                    <tr key={i} className="border-t">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>キャンセル</Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? 'インポート中...' : 'インポート'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // テンプレートを生徒情報付きで取得
  const { data: templates, error: tplError } = await supabase
    .from('regular_lesson_templates')
    .select(`
      id, day_of_week, is_active,
      student:students ( id, name, student_number, grade ),
      teacher:profiles ( id, display_name ),
      subject:subjects ( id, name ),
      time_slot:time_slots ( id, label, start_time, end_time, sort_order )
    `)
    .order('day_of_week')

  if (tplError) {
    return NextResponse.json({ error: tplError.message }, { status: 500 })
  }

  // アクティブな通常コース契約を取得
  const { data: contracts, error: ctError } = await supabase
    .from('contracts')
    .select('id, student_id, start_date, end_date, courses, grade')
    .eq('type', 'initial')
    .order('start_date', { ascending: false })

  const { data: renewals } = await supabase
    .from('contracts')
    .select('id, student_id, start_date, end_date, courses, grade')
    .eq('type', 'renewal')
    .order('start_date', { ascending: false })

  const allContracts = [...(contracts || []), ...(renewals || [])]

  // 生徒IDでグループ化
  const studentMap = new Map<string, {
    student: { id: string; name: string; student_number: string | null; grade: string | null }
    contracts: typeof allContracts
    templates: typeof templates
  }>()

  for (const t of templates || []) {
    const s = t.student as unknown as { id: string; name: string; student_number: string | null; grade: string | null } | null
    if (!s) continue
    if (!studentMap.has(s.id)) {
      studentMap.set(s.id, {
        student: s,
        contracts: [],
        templates: [],
      })
    }
    studentMap.get(s.id)!.templates.push(t)
  }

  // 契約を生徒に紐付け
  for (const c of allContracts) {
    const entry = studentMap.get(c.student_id)
    if (entry) {
      entry.contracts.push(c)
    }
  }

  // 生徒名でソート
  const data = Array.from(studentMap.values())
    .sort((a, b) => a.student.name.localeCompare(b.student.name, 'ja'))

  if (ctError) {
    return NextResponse.json({ error: ctError.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

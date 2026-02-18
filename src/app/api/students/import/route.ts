import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows } = await request.json()
  if (!rows?.length) {
    return NextResponse.json({ error: 'データがありません' }, { status: 400 })
  }

  const admin = createAdminClient()
  let count = 0

  for (const row of rows) {
    const name = row['名前'] || row['name']
    if (!name) continue

    const grade = row['学年'] || row['grade'] || null
    const summaryFrequency = parseInt(row['まとめ頻度'] || row['summary_frequency'] || '4') || 4
    const sendMode = row['送信モード'] || row['send_mode'] || 'manual'
    const weeklyCount = parseInt(row['週コマ数'] || row['weekly_lesson_count'] || '0') || null

    const { data: student, error } = await admin
      .from('students')
      .insert({
        name,
        grade,
        summary_frequency: summaryFrequency,
        send_mode: sendMode === '自動' || sendMode === 'auto_send' ? 'auto_send' : 'manual',
        weekly_lesson_count: weeklyCount,
      })
      .select()
      .single()

    if (error || !student) continue

    // Handle parent emails (父メール, 母メール columns)
    const fatherEmail = (row['父メール'] || row['father_email'] || '').trim()
    const motherEmail = (row['母メール'] || row['mother_email'] || '').trim()
    const parentEmailRows = []
    if (fatherEmail) parentEmailRows.push({ student_id: student.id, email: fatherEmail, label: '父' })
    if (motherEmail) parentEmailRows.push({ student_id: student.id, email: motherEmail, label: '母' })
    if (parentEmailRows.length) {
      await admin.from('parent_emails').insert(parentEmailRows)
    }

    // Handle subjects (comma-separated)
    const subjectStr = row['科目'] || row['subjects'] || ''
    if (subjectStr) {
      const subjectNames = subjectStr.split(/[、,]/).map((s: string) => s.trim()).filter(Boolean)
      if (subjectNames.length) {
        const { data: subjects } = await admin
          .from('subjects')
          .select('id, name')
          .in('name', subjectNames)
        if (subjects?.length) {
          await admin.from('student_subjects').insert(
            subjects.map(s => ({ student_id: student.id, subject_id: s.id }))
          )
        }
      }
    }

    count++
  }

  return NextResponse.json({ count })
}

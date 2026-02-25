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
    const rawNumber = row['塾生番号'] || row['student_number'] || null
    const student_number = rawNumber ? String(rawNumber).replace(/\D/g, '').padStart(7, '0') : null

    const { data: student, error } = await admin
      .from('students')
      .insert({
        name,
        grade,
        student_number,
      })
      .select()
      .single()

    if (error || !student) continue

    // Handle parent emails (メール1, メール2 columns)
    const email1 = (row['メール1'] || row['email1'] || '').trim()
    const email2 = (row['メール2'] || row['email2'] || '').trim()
    const parentEmailRows = []
    if (email1) parentEmailRows.push({ student_id: student.id, email: email1, label: 'メール1' })
    if (email2) parentEmailRows.push({ student_id: student.id, email: email2, label: 'メール2' })
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

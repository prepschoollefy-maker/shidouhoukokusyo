import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcMonthlyAmount, getEnrollmentFeeForCampaign, calcCampaignDiscount } from '@/lib/contracts/pricing'
import { verifyContractPassword } from '@/lib/contracts/auth'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const { rows } = await request.json()
  if (!rows?.length) {
    return NextResponse.json({ error: 'データがありません' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 塾生番号 → student_id のマッピングを事前取得
  const { data: students } = await admin
    .from('students')
    .select('id, student_number, name, grade')

  const studentMap = new Map<string, { id: string; grade: string | null }>()
  for (const s of students || []) {
    if (s.student_number) {
      const key = String(s.student_number).replace(/\D/g, '').padStart(7, '0')
      studentMap.set(key, { id: s.id, grade: s.grade })
    }
  }

  let count = 0
  const errors: string[] = []

  for (const row of rows) {
    const studentNumber = row['塾生番号'] || row['student_number']
    if (!studentNumber) {
      errors.push('塾生番号が空の行をスキップしました')
      continue
    }

    const normalizedNumber = String(studentNumber).replace(/\D/g, '').padStart(7, '0')
    const studentInfo = studentMap.get(normalizedNumber)
    if (!studentInfo) {
      errors.push(`塾生番号 ${studentNumber} の生徒が見つかりません`)
      continue
    }

    const grade = row['学年'] || row['grade'] || studentInfo.grade
    const startDate = row['開始日'] || row['start_date']
    const endDate = row['終了日'] || row['end_date']
    if (!grade || !startDate || !endDate) {
      errors.push(`塾生番号 ${studentNumber}: 必須項目（開始日/終了日）が不足`)
      continue
    }

    // コース解析
    // 形式1: "コース1" 列 + "コマ数1" 列 + "コース2" 列 + "コマ数2" 列
    // 形式2: "コース" 列に "ハイ:2 / エク:1" のようにまとめて記載
    const courses: { course: string; lessons: number }[] = []

    const course1 = (row['コース1'] || '').trim()
    const lessons1 = parseInt(row['コマ数1']) || 0
    const course2 = (row['コース2'] || '').trim()
    const lessons2 = parseInt(row['コマ数2']) || 0
    const course3 = (row['コース3'] || '').trim()
    const lessons3 = parseInt(row['コマ数3']) || 0

    if (course1 && lessons1 > 0) {
      courses.push({ course: course1, lessons: lessons1 })
    }
    if (course2 && lessons2 > 0) {
      courses.push({ course: course2, lessons: lessons2 })
    }
    if (course3 && lessons3 > 0) {
      courses.push({ course: course3, lessons: lessons3 })
    }

    // フォールバック: "コース" 列に "ハイ:2 / エク:1" 形式
    if (courses.length === 0) {
      const coursesStr = row['コース'] || row['courses'] || ''
      if (coursesStr) {
        for (const part of coursesStr.split(/[;\/]/).map((s: string) => s.trim()).filter(Boolean)) {
          const match = part.match(/^(.+?)[:\s,]+(\d+)$/)
          if (match) {
            courses.push({ course: match[1].trim(), lessons: parseInt(match[2]) })
          }
        }
      }
    }

    if (courses.length === 0) {
      errors.push(`塾生番号 ${studentNumber}: コースが指定されていません`)
      continue
    }

    const monthlyAmount = calcMonthlyAmount(grade, courses)

    // キャンペーン
    const campaign = (row['キャンペーン'] || row['campaign'] || '').trim() || null
    const enrollmentFee = getEnrollmentFeeForCampaign(campaign || '')
    const campaignDiscount = campaign === '講習キャンペーン'
      ? calcCampaignDiscount(grade, courses)
      : 0

    const { error } = await admin
      .from('contracts')
      .insert({
        student_id: studentInfo.id,
        start_date: startDate,
        end_date: endDate,
        grade,
        courses,
        monthly_amount: monthlyAmount,
        enrollment_fee: enrollmentFee,
        campaign: campaign,
        campaign_discount: campaignDiscount,
        notes: row['備考'] || row['notes'] || '',
      })

    if (error) {
      errors.push(`塾生番号 ${studentNumber}: ${error.message}`)
      continue
    }
    count++
  }

  return NextResponse.json({ count, errors: errors.length ? errors : undefined })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcMonthlyAmount, calcCampaignDiscount, getEnrollmentFeeForCampaign, CourseEntry } from '@/lib/contracts/pricing'
import { verifyContractPassword } from '@/lib/contracts/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const { data, error } = await supabase
    .from('contracts')
    .select('*, student:students(id, name, student_number)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const body = await request.json()
  const { student_id, start_date, end_date, grade, courses, notes, campaign } = body

  const updateData: Record<string, unknown> = {}
  if (student_id !== undefined) updateData.student_id = student_id
  if (start_date !== undefined) updateData.start_date = start_date
  if (end_date !== undefined) updateData.end_date = end_date
  if (grade !== undefined) updateData.grade = grade
  if (courses !== undefined) updateData.courses = courses
  if (notes !== undefined) updateData.notes = notes
  if (campaign !== undefined) {
    updateData.campaign = campaign || null
    updateData.enrollment_fee = getEnrollmentFeeForCampaign(campaign || '')
  }

  if (grade && courses) {
    updateData.monthly_amount = calcMonthlyAmount(grade, courses as CourseEntry[])
    if (campaign === '講習キャンペーン') {
      updateData.campaign_discount = calcCampaignDiscount(grade, courses as CourseEntry[])
    } else if (campaign !== undefined) {
      updateData.campaign_discount = 0
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contracts')
    .update(updateData)
    .eq('id', id)
    .select('*, student:students(id, name, student_number)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pwError = verifyContractPassword(request)
  if (pwError) return pwError

  const admin = createAdminClient()
  const { error } = await admin.from('contracts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

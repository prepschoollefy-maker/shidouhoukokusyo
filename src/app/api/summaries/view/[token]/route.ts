import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: summary, error } = await admin
    .from('summaries')
    .select(`
      id, content, period_start, period_end, created_at,
      student:students!inner(name, grade)
    `)
    .eq('view_token', token)
    .single()

  if (error || !summary) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Get school name
  const { data: settings } = await admin
    .from('school_settings')
    .select('school_name')
    .limit(1)
    .single()

  return NextResponse.json({
    data: {
      ...summary,
      school_name: settings?.school_name || 'レフィー',
    },
  })
}

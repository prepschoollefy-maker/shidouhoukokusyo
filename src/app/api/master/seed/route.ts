import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  // 管理者チェック
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const results: string[] = []

  // 1. time_slots シード
  const { data: existingSlots } = await admin.from('time_slots').select('id').limit(1)
  if (!existingSlots || existingSlots.length === 0) {
    const { error } = await admin.from('time_slots').insert([
      { slot_number: 1, label: '1限', start_time: '12:30', end_time: '13:50', sort_order: 1 },
      { slot_number: 2, label: '2限', start_time: '14:00', end_time: '15:20', sort_order: 2 },
      { slot_number: 3, label: '3限', start_time: '15:30', end_time: '16:50', sort_order: 3 },
      { slot_number: 4, label: '4限', start_time: '17:00', end_time: '18:20', sort_order: 4 },
      { slot_number: 5, label: '5限', start_time: '18:30', end_time: '19:50', sort_order: 5 },
      { slot_number: 6, label: '6限', start_time: '20:00', end_time: '21:20', sort_order: 6 },
    ])
    if (error) return NextResponse.json({ error: `time_slots: ${error.message}` }, { status: 500 })
    results.push('時間枠 6コマを登録しました')
  } else {
    results.push('時間枠は既に存在します（スキップ）')
  }

  // 2. booths シード
  const { data: existingBooths } = await admin.from('booths').select('id').limit(1)
  if (!existingBooths || existingBooths.length === 0) {
    const boothData = Array.from({ length: 15 }, (_, i) => ({
      booth_number: i + 1,
      label: `ブース${i + 1}`,
      is_active: true,
      sort_order: i + 1,
    }))
    const { error } = await admin.from('booths').insert(boothData)
    if (error) return NextResponse.json({ error: `booths: ${error.message}` }, { status: 500 })
    results.push('ブース 15件を登録しました')
  } else {
    results.push('ブースは既に存在します（スキップ）')
  }

  // 3. slot_availability シード
  const { data: existingAvail } = await admin.from('slot_availability').select('id').limit(1)
  if (!existingAvail || existingAvail.length === 0) {
    // time_slots の id を取得
    const { data: slots } = await admin.from('time_slots').select('id, slot_number').order('slot_number')
    if (slots && slots.length > 0) {
      const slotMap: Record<number, string> = {}
      for (const s of slots) slotMap[s.slot_number] = s.id

      const availData = [
        { slot: 1, weekday: 'closed', saturday: 'closed', sunday: 'open', intensive: 'open' },
        { slot: 2, weekday: 'closed', saturday: 'open', sunday: 'open', intensive: 'open' },
        { slot: 3, weekday: 'closed', saturday: 'open', sunday: 'open', intensive: 'open' },
        { slot: 4, weekday: 'open', saturday: 'open', sunday: 'open', intensive: 'priority' },
        { slot: 5, weekday: 'open', saturday: 'open', sunday: 'open', intensive: 'priority' },
        { slot: 6, weekday: 'open', saturday: 'open', sunday: 'closed', intensive: 'priority' },
      ]

      const rows: { time_slot_id: string; day_type: string; availability: string }[] = []
      for (const a of availData) {
        const id = slotMap[a.slot]
        if (!id) continue
        rows.push({ time_slot_id: id, day_type: 'weekday', availability: a.weekday })
        rows.push({ time_slot_id: id, day_type: 'saturday', availability: a.saturday })
        rows.push({ time_slot_id: id, day_type: 'sunday', availability: a.sunday })
        rows.push({ time_slot_id: id, day_type: 'intensive', availability: a.intensive })
      }

      const { error } = await admin.from('slot_availability').insert(rows)
      if (error) return NextResponse.json({ error: `slot_availability: ${error.message}` }, { status: 500 })
      results.push('開講パターン 24件を登録しました')
    }
  } else {
    results.push('開講パターンは既に存在します（スキップ）')
  }

  return NextResponse.json({ message: results.join('、'), results })
}

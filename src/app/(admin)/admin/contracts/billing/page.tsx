'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, Loader2, ArrowRight, HelpCircle, Plus, Trash2, Undo2, Lock, Unlock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useContractAuth } from '../layout'
import { GRADES } from '@/lib/contracts/pricing'
import { StudentBillingView } from '@/components/billing/student-billing-view'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Payment {
  id: string
  billing_type: 'contract' | 'lecture' | 'material' | 'manual'
  contract_id: string | null
  lecture_id: string | null
  material_sale_id: string | null
  manual_billing_id: string | null
  year: number
  month: number
  billed_amount: number
  paid_amount: number
  difference: number
  status: '未入金' | '入金済み' | '過不足あり'
  payment_date: string | null
  payment_method: '振込' | '口座振替' | null
  followup_status: '' | '対応不要' | '振込依頼中' | '対応済み'
  notes: string
}

interface BillingItem {
  id: string
  student_id: string
  grade: string
  courses: { course: string; lessons: number }[]
  monthly_amount: number
  tuition: number
  enrollment_fee_amount: number
  facility_fee: number
  campaign_discount_amount: number
  total_amount: number
  start_date: string
  end_date: string
  student: { id: string; name: string; student_number: string | null; payment_method: string }
  effective_payment_method: '振込' | '口座振替'
  out_of_period?: boolean
  suspended?: boolean
  confirmed?: boolean
  confirmation_id?: string
  confirmed_at?: string
  amount_changed?: boolean
}

interface LectureBillingItem {
  id: string
  student: { id: string; name: string; student_number: string | null; payment_method: string }
  label: string
  grade: string
  courses: { course: string; unit_price: number; lessons: number; amount: number }[]
  total_amount: number
  effective_payment_method: '振込' | '口座振替'
  confirmed?: boolean
  confirmation_id?: string
  confirmed_at?: string
  amount_changed?: boolean
}

type StatusFilter = 'all' | '未入金' | '入金済み' | '過不足あり'
type PaymentMethodFilter = 'all' | '振込' | '口座振替'

interface MaterialBillingItem {
  id: string
  student: { id: string; name: string; student_number: string | null; payment_method: string }
  item_name: string
  unit_price: number
  quantity: number
  total_amount: number
  sale_date: string
  notes: string
  effective_payment_method: '振込' | '口座振替'
  confirmed?: boolean
  confirmation_id?: string
  confirmed_at?: string
  amount_changed?: boolean
}

interface AdjustmentItem {
  id: string
  student: { id: string; name: string; student_number: string | null }
  amount: number
  reason: string
  status: string
  completed_date: string | null
  notes: string
  created_at: string
  contract_id: string | null
  lecture_id: string | null
  material_sale_id: string | null
  linked_label: string | null
}

interface ManualBillingItem {
  id: string
  student: { id: string; name: string; student_number: string | null; payment_method: string }
  amount: number
  description: string
  notes: string
  created_at: string
  effective_payment_method: '振込' | '口座振替'
  confirmed?: boolean
  confirmation_id?: string
  confirmed_at?: string
  amount_changed?: boolean
}

type ItemKey = string
const contractKey = (id: string): ItemKey => `contract:${id}`
const lectureKey = (id: string): ItemKey => `lecture:${id}`
const materialKey = (id: string): ItemKey => `material:${id}`
const manualKey = (id: string): ItemKey => `manual:${id}`

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BillingPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BillingPageInner />
    </Suspense>
  )
}

function BillingPageInner() {
  const searchParams = useSearchParams()
  const now = new Date()
  const [year, setYear] = useState(() => {
    const p = searchParams.get('year')
    return p ? parseInt(p) : now.getFullYear()
  })
  const [month, setMonth] = useState(() => {
    const p = searchParams.get('month')
    return p ? parseInt(p) : now.getMonth() + 1
  })
  const [billing, setBilling] = useState<BillingItem[]>([])
  const [lectureBilling, setLectureBilling] = useState<LectureBillingItem[]>([])
  const [materialBilling, setMaterialBilling] = useState<MaterialBillingItem[]>([])
  const [manualBilling, setManualBilling] = useState<ManualBillingItem[]>([])
  const [adjustmentBilling, setAdjustmentBilling] = useState<AdjustmentItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [contractTotal, setContractTotal] = useState(0)
  const [lectureTotal, setLectureTotal] = useState(0)
  const [materialTotal, setMaterialTotal] = useState(0)
  const [manualTotal, setManualTotal] = useState(0)
  const [adjustmentTotal, setAdjustmentTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all')
  const [viewMode, setViewMode] = useState<'category' | 'student'>('category')

  const { storedPw } = useContractAuth()

  // 一括選択
  const [selected, setSelected] = useState<Set<ItemKey>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)

  // 個別確認中のキー（ローディング表示用）
  const [confirmingKeys, setConfirmingKeys] = useState<Set<ItemKey>>(new Set())

  // 支払方法オーバーライド中のキー
  const [overridingKeys, setOverridingKeys] = useState<Set<ItemKey>>(new Set())

  // 請求確定中のキー
  const [lockingKeys, setLockingKeys] = useState<Set<ItemKey>>(new Set())
  const [bulkLocking, setBulkLocking] = useState(false)

  // 調整ダイアログ
  const [adjDialogOpen, setAdjDialogOpen] = useState(false)
  const [adjEditing, setAdjEditing] = useState<AdjustmentItem | null>(null)
  const [adjForm, setAdjForm] = useState({ student_id: '', amount: '', reason: '', notes: '' })
  const [adjSaving, setAdjSaving] = useState(false)
  const [students, setStudents] = useState<{ id: string; name: string; student_number: string | null }[]>([])
  // 請求項目紐付き調整ダイアログ用
  const [adjLinkedTarget, setAdjLinkedTarget] = useState<{
    billingType: 'contract' | 'lecture' | 'material' | 'manual'
    refId: string
    studentName: string
    billingLabel: string
    billedAmount: number
    studentId: string
  } | null>(null)

  // 手動請求ダイアログ
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [manualEditing, setManualEditing] = useState<ManualBillingItem | null>(null)
  const [manualForm, setManualForm] = useState({ student_id: '', amount: '', description: '', notes: '' })
  const [manualSaving, setManualSaving] = useState(false)

  // 詳細ダイアログ
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTarget, setDialogTarget] = useState<{
    billingType: 'contract' | 'lecture' | 'material' | 'manual'
    refId: string
    studentName: string
    billedAmount: number
    defaultMethod: string
    existingPayment: Payment | null
  } | null>(null)
  const [payForm, setPayForm] = useState({
    paid_amount: '',
    payment_date: '',
    payment_method: '振込',
    followup_status: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  /* ---- data fetch (cache-bust で常に最新取得) ---- */

  const fetchData = useCallback(async (pw: string) => {
    const t = Date.now()
    const params = `year=${year}&month=${month}&pw=${encodeURIComponent(pw)}&_t=${t}`
    const [billingRes, paymentsRes] = await Promise.all([
      fetch(`/api/contracts/billing?${params}`),
      fetch(`/api/payments?${params}`),
    ])
    if (billingRes.ok) {
      const json = await billingRes.json()
      setBilling(json.data || [])
      setLectureBilling(json.lectureData || [])
      setMaterialBilling(json.materialData || [])
      setManualBilling(json.manualData || [])
      setAdjustmentBilling(json.adjustmentData || [])
      setTotal(json.total || 0)
      setContractTotal(json.contractTotal || 0)
      setLectureTotal(json.lectureTotal || 0)
      setMaterialTotal(json.materialTotal || 0)
      setManualTotal(json.manualTotal || 0)
      setAdjustmentTotal(json.adjustmentTotal || 0)
    }
    if (paymentsRes.ok) {
      const json = await paymentsRes.json()
      setPayments(json.data || [])
    }
    setSelected(new Set())
  }, [year, month])

  useEffect(() => {
    if (!storedPw) return
    setLoading(true)
    fetchData(storedPw).finally(() => setLoading(false))
    // 生徒リスト取得（調整追加ダイアログ用）
    fetch(`/api/students?_t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.data) setStudents(json.data) })
  }, [year, month, storedPw, fetchData])

  /* ---- payment lookup ---- */

  const getPayment = (type: 'contract' | 'lecture' | 'material' | 'manual', id: string): Payment | undefined =>
    payments.find(p =>
      type === 'contract' ? p.contract_id === id
        : type === 'lecture' ? p.lecture_id === id
        : type === 'material' ? p.material_sale_id === id
        : p.manual_billing_id === id
    )

  const getStatus = (payment: Payment | undefined): '未入金' | '入金済み' | '過不足あり' =>
    payment?.status as '未入金' | '入金済み' | '過不足あり' ?? '未入金'

  /** payment レコードに payment_method があればそちら優先（オーバーライド） */
  const getDisplayPaymentMethod = (payment: Payment | undefined, epm: '振込' | '口座振替'): '振込' | '口座振替' =>
    (payment?.payment_method as '振込' | '口座振替') || epm

  /** オーバーライド用レコード（paid_amount=0, status=未入金）も未入金扱い */
  const isUnpaidStatus = (payment: Payment | undefined): boolean =>
    !payment || payment.status === '未入金'

  /* ---- adjustment lookup for billing items ---- */

  const getAdjustmentsForItem = (type: 'contract' | 'lecture' | 'material', id: string): AdjustmentItem[] =>
    adjustmentBilling.filter(a =>
      type === 'contract' ? a.contract_id === id
        : type === 'lecture' ? a.lecture_id === id
        : a.material_sale_id === id
    )

  /** インライン表示されなかった全調整（紐付けなし ＋ 請求行が消えた孤立紐付き） */
  const inlineAdjustmentIds = new Set<string>()
  for (const b of billing) {
    getAdjustmentsForItem('contract', b.id).forEach(a => inlineAdjustmentIds.add(a.id))
  }
  for (const l of lectureBilling) {
    getAdjustmentsForItem('lecture', l.id).forEach(a => inlineAdjustmentIds.add(a.id))
  }
  for (const m of materialBilling) {
    getAdjustmentsForItem('material', m.id).forEach(a => inlineAdjustmentIds.add(a.id))
  }
  const otherAdjustments = adjustmentBilling.filter(a => !inlineAdjustmentIds.has(a.id))

  /* ---- filter ---- */

  const filterByStatus = <T,>(items: T[], getP: (item: T) => Payment | undefined, getEpm: (item: T) => string): T[] => {
    let result = items
    if (statusFilter !== 'all') {
      result = result.filter(item => getStatus(getP(item)) === statusFilter)
    }
    if (paymentMethodFilter !== 'all') {
      result = result.filter(item => getEpm(item) === paymentMethodFilter)
    }
    return result
  }
  const sortByStudentNumber = <T extends { student?: { student_number: string | null } | null }>(items: T[]): T[] =>
    [...items].sort((a, b) => {
      const aNum = a.student?.student_number || ''
      const bNum = b.student?.student_number || ''
      return aNum.localeCompare(bNum, 'ja', { numeric: true })
    })

  // 休塾中で請求額0円かつ未確定の行は非表示
  const visibleBilling = billing.filter(b => !(b.suspended && b.total_amount === 0 && !b.confirmed))
  const filteredBilling = sortByStudentNumber(filterByStatus(visibleBilling, b => getPayment('contract', b.id), b => getDisplayPaymentMethod(getPayment('contract', b.id), b.effective_payment_method)))
  const filteredLectures = sortByStudentNumber(filterByStatus(lectureBilling, l => getPayment('lecture', l.id), l => getDisplayPaymentMethod(getPayment('lecture', l.id), l.effective_payment_method)))
  const filteredMaterials = sortByStudentNumber(filterByStatus(materialBilling, m => getPayment('material', m.id), m => getDisplayPaymentMethod(getPayment('material', m.id), m.effective_payment_method)))
  const filteredManuals = sortByStudentNumber(filterByStatus(manualBilling, m => getPayment('manual', m.id), m => getDisplayPaymentMethod(getPayment('manual', m.id), m.effective_payment_method)))

  /* ---- stats ---- */

  const allItems = [
    ...billing.map(b => { const p = getPayment('contract', b.id); return { amount: b.total_amount, payment: p, epm: getDisplayPaymentMethod(p, b.effective_payment_method) } }),
    ...lectureBilling.map(l => { const p = getPayment('lecture', l.id); return { amount: l.total_amount, payment: p, epm: getDisplayPaymentMethod(p, l.effective_payment_method) } }),
    ...materialBilling.map(m => { const p = getPayment('material', m.id); return { amount: m.total_amount, payment: p, epm: getDisplayPaymentMethod(p, m.effective_payment_method) } }),
    ...manualBilling.map(m => { const p = getPayment('manual', m.id); return { amount: m.amount, payment: p, epm: getDisplayPaymentMethod(p, m.effective_payment_method) } }),
  ]
  const paidCount = allItems.filter(i => getStatus(i.payment) === '入金済み').length
  const paidAmount = allItems.filter(i => getStatus(i.payment) === '入金済み').reduce((s, i) => s + (i.payment?.paid_amount || 0), 0)
  const unpaidCount = allItems.filter(i => getStatus(i.payment) === '未入金').length
  const discrepancyCount = allItems.filter(i => getStatus(i.payment) === '過不足あり').length

  // 支払方法別の未入金内訳
  const unpaidByTransfer = allItems.filter(i => getStatus(i.payment) === '未入金' && i.epm === '振込').length
  const unpaidByDirectDebit = allItems.filter(i => getStatus(i.payment) === '未入金' && i.epm === '口座振替').length

  /* ---- selection helpers ---- */

  const toggle = (key: ItemKey) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const allUnpaidKeys: ItemKey[] = [
    ...filteredBilling.filter(b => isUnpaidStatus(getPayment('contract', b.id))).map(b => contractKey(b.id)),
    ...filteredLectures.filter(l => isUnpaidStatus(getPayment('lecture', l.id))).map(l => lectureKey(l.id)),
    ...filteredMaterials.filter(m => isUnpaidStatus(getPayment('material', m.id))).map(m => materialKey(m.id)),
    ...filteredManuals.filter(m => isUnpaidStatus(getPayment('manual', m.id))).map(m => manualKey(m.id)),
  ]
  const allUnpaidSelected = allUnpaidKeys.length > 0 && allUnpaidKeys.every(k => selected.has(k))

  const toggleAll = () => {
    setSelected(allUnpaidSelected ? new Set() : new Set(allUnpaidKeys))
  }

  /* ---- quick confirm (1-click) ---- */

  const quickConfirmApi = async (billingType: 'contract' | 'lecture' | 'material' | 'manual', refId: string, billedAmount: number, method: string) => {
    const params = `pw=${encodeURIComponent(storedPw)}`
    const res = await fetch(`/api/payments?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billing_type: billingType,
        contract_id: billingType === 'contract' ? refId : null,
        lecture_id: billingType === 'lecture' ? refId : null,
        material_sale_id: billingType === 'material' ? refId : null,
        manual_billing_id: billingType === 'manual' ? refId : null,
        year,
        month,
        billed_amount: billedAmount,
        paid_amount: billedAmount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: method || '振込',
        notes: '',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.error || '入金OKの処理に失敗しました')
    }
  }

  /* ---- payment method override (toggle) ---- */

  const handleTogglePaymentMethod = async (
    key: ItemKey,
    billingType: 'contract' | 'lecture' | 'material' | 'manual',
    refId: string,
    billedAmount: number,
    currentDisplayMethod: '振込' | '口座振替',
    existingPayment: Payment | undefined,
  ) => {
    const newMethod = currentDisplayMethod === '振込' ? '口座振替' : '振込'
    setOverridingKeys(prev => new Set(prev).add(key))
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      if (existingPayment) {
        // 既存レコードの payment_method を更新
        const res = await fetch(`/api/payments/${existingPayment.id}?${params}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paid_amount: existingPayment.paid_amount,
            billed_amount: billedAmount,
            payment_date: existingPayment.payment_date,
            payment_method: newMethod,
            followup_status: existingPayment.followup_status,
            notes: existingPayment.notes,
          }),
        })
        if (!res.ok) throw new Error('支払方法の変更に失敗しました')
      } else {
        // オーバーライド用レコードを新規作成（paid_amount=0 → status='未入金'）
        const res = await fetch(`/api/payments?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billing_type: billingType,
            contract_id: billingType === 'contract' ? refId : null,
            lecture_id: billingType === 'lecture' ? refId : null,
            material_sale_id: billingType === 'material' ? refId : null,
            manual_billing_id: billingType === 'manual' ? refId : null,
            year,
            month,
            billed_amount: billedAmount,
            paid_amount: 0,
            payment_date: null,
            payment_method: newMethod,
            notes: '',
          }),
        })
        if (!res.ok) throw new Error('支払方法の変更に失敗しました')
      }
      toast.success(`支払方法を「${newMethod}」に変更しました`)
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '支払方法の変更に失敗しました')
    } finally {
      setOverridingKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleQuickConfirm = async (key: ItemKey, billingType: 'contract' | 'lecture' | 'material' | 'manual', refId: string, billedAmount: number, method: string) => {
    setConfirmingKeys(prev => new Set(prev).add(key))
    try {
      await quickConfirmApi(billingType, refId, billedAmount, method)
      toast.success('入金OKにしました')
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '入金OKの処理に失敗しました')
    } finally {
      setConfirmingKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  /* ---- bulk confirm ---- */

  const handleBulkConfirm = async () => {
    if (selected.size === 0) return
    setBulkSaving(true)
    setConfirmingKeys(new Set(selected))
    try {
      const promises: Promise<void>[] = []
      for (const key of selected) {
        const [type, id] = key.split(':') as ['contract' | 'lecture' | 'material' | 'manual', string]
        if (type === 'contract') {
          const b = billing.find(x => x.id === id)
          const p = getPayment('contract', id)
          if (b && isUnpaidStatus(p)) {
            promises.push(quickConfirmApi('contract', id, b.total_amount, getDisplayPaymentMethod(p, b.effective_payment_method)))
          }
        } else if (type === 'lecture') {
          const l = lectureBilling.find(x => x.id === id)
          const p = getPayment('lecture', id)
          if (l && isUnpaidStatus(p)) {
            promises.push(quickConfirmApi('lecture', id, l.total_amount, getDisplayPaymentMethod(p, l.effective_payment_method)))
          }
        } else if (type === 'material') {
          const m = materialBilling.find(x => x.id === id)
          const p = getPayment('material', id)
          if (m && isUnpaidStatus(p)) {
            promises.push(quickConfirmApi('material', id, m.total_amount, getDisplayPaymentMethod(p, m.effective_payment_method)))
          }
        } else if (type === 'manual') {
          const m = manualBilling.find(x => x.id === id)
          const p = getPayment('manual', id)
          if (m && isUnpaidStatus(p)) {
            promises.push(quickConfirmApi('manual', id, m.amount, getDisplayPaymentMethod(p, m.effective_payment_method)))
          }
        }
      }
      // 5件ずつバッチ処理
      for (let i = 0; i < promises.length; i += 5) {
        await Promise.all(promises.slice(i, i + 5))
      }
      toast.success(`${promises.length}件を入金OKにしました`)
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '一括入金OKの処理に失敗しました')
    } finally {
      setBulkSaving(false)
      setConfirmingKeys(new Set())
    }
  }

  /* ---- bulk direct debit confirm ---- */

  const handleBulkDirectDebitConfirm = async () => {
    if (!confirm('口座振替の未入金をすべて入金OKにしますか？')) return
    setBulkSaving(true)
    try {
      const promises: Promise<void>[] = []
      // contracts — オーバーライドで振込に変更された行はスキップ
      for (const b of billing) {
        const p = getPayment('contract', b.id)
        if (getDisplayPaymentMethod(p, b.effective_payment_method) === '口座振替' && isUnpaidStatus(p)) {
          const key = contractKey(b.id)
          setConfirmingKeys(prev => new Set(prev).add(key))
          promises.push(quickConfirmApi('contract', b.id, b.total_amount, '口座振替'))
        }
      }
      // lectures
      for (const l of lectureBilling) {
        const p = getPayment('lecture', l.id)
        if (getDisplayPaymentMethod(p, l.effective_payment_method) === '口座振替' && isUnpaidStatus(p)) {
          const key = lectureKey(l.id)
          setConfirmingKeys(prev => new Set(prev).add(key))
          promises.push(quickConfirmApi('lecture', l.id, l.total_amount, '口座振替'))
        }
      }
      // materials
      for (const m of materialBilling) {
        const p = getPayment('material', m.id)
        if (getDisplayPaymentMethod(p, m.effective_payment_method) === '口座振替' && isUnpaidStatus(p)) {
          const key = materialKey(m.id)
          setConfirmingKeys(prev => new Set(prev).add(key))
          promises.push(quickConfirmApi('material', m.id, m.total_amount, '口座振替'))
        }
      }
      // manual billings
      for (const m of manualBilling) {
        const p = getPayment('manual', m.id)
        if (getDisplayPaymentMethod(p, m.effective_payment_method) === '口座振替' && isUnpaidStatus(p)) {
          const key = manualKey(m.id)
          setConfirmingKeys(prev => new Set(prev).add(key))
          promises.push(quickConfirmApi('manual', m.id, m.amount, '口座振替'))
        }
      }
      // 5件ずつバッチ処理
      for (let i = 0; i < promises.length; i += 5) {
        await Promise.all(promises.slice(i, i + 5))
      }
      toast.success(`口座振替 ${promises.length}件を入金OKにしました`)
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '一括入金OKの処理に失敗しました')
    } finally {
      setBulkSaving(false)
      setConfirmingKeys(new Set())
    }
  }

  /* ---- billing confirmation (lock) ---- */

  const buildSnapshot = (billingType: 'contract' | 'lecture' | 'material' | 'manual', refId: string) => {
    if (billingType === 'contract') {
      const b = billing.find(x => x.id === refId)
      if (!b) return null
      return {
        tuition: b.tuition,
        enrollment_fee: b.enrollment_fee_amount,
        facility_fee: b.facility_fee,
        campaign_discount: b.campaign_discount_amount,
        total_amount: b.total_amount,
        suspended: !!b.suspended,
      }
    } else if (billingType === 'lecture') {
      const l = lectureBilling.find(x => x.id === refId)
      if (!l) return null
      return { total_amount: l.total_amount, courses: l.courses }
    } else if (billingType === 'material') {
      const m = materialBilling.find(x => x.id === refId)
      if (!m) return null
      return { total_amount: m.total_amount, unit_price: m.unit_price, quantity: m.quantity }
    } else {
      const m = manualBilling.find(x => x.id === refId)
      if (!m) return null
      return { amount: m.amount, description: m.description }
    }
  }

  const handleLockItem = async (key: ItemKey, billingType: 'contract' | 'lecture' | 'material' | 'manual', refId: string) => {
    const snapshot = buildSnapshot(billingType, refId)
    if (!snapshot) return
    setLockingKeys(prev => new Set(prev).add(key))
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      const res = await fetch(`/api/billing-confirmations?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ billing_type: billingType, ref_id: refId, snapshot }], year, month }),
      })
      if (!res.ok) throw new Error('確定に失敗しました')
      toast.success('請求を確定しました')
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '確定に失敗しました')
    } finally {
      setLockingKeys(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }

  const handleUnlockItem = async (confirmationId: string) => {
    if (!confirm('確定を解除しますか？最新の計算値に戻ります。')) return
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      const res = await fetch(`/api/billing-confirmations/${confirmationId}?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('確定解除に失敗しました')
      toast.success('確定を解除しました')
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '確定解除に失敗しました')
    }
  }

  const handleBulkLock = async () => {
    if (!confirm('未確定の全項目を一括確定しますか？確定後は金額が固定されます。')) return
    // 未確定の全項目を確定
    const items: { billing_type: string; ref_id: string; snapshot: Record<string, unknown> }[] = []
    for (const b of billing) {
      if (!b.confirmed && !b.out_of_period) {
        const snap = buildSnapshot('contract', b.id)
        if (snap) items.push({ billing_type: 'contract', ref_id: b.id, snapshot: snap })
      }
    }
    for (const l of lectureBilling) {
      if (!l.confirmed) {
        const snap = buildSnapshot('lecture', l.id)
        if (snap) items.push({ billing_type: 'lecture', ref_id: l.id, snapshot: snap })
      }
    }
    for (const m of materialBilling) {
      if (!m.confirmed) {
        const snap = buildSnapshot('material', m.id)
        if (snap) items.push({ billing_type: 'material', ref_id: m.id, snapshot: snap })
      }
    }
    for (const m of manualBilling) {
      if (!m.confirmed) {
        const snap = buildSnapshot('manual', m.id)
        if (snap) items.push({ billing_type: 'manual', ref_id: m.id, snapshot: snap })
      }
    }
    if (items.length === 0) {
      toast.info('すべて確定済みです')
      return
    }
    setBulkLocking(true)
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      const res = await fetch(`/api/billing-confirmations?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, year, month }),
      })
      if (!res.ok) throw new Error('一括確定に失敗しました')
      toast.success(`${items.length}件を確定しました`)
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '一括確定に失敗しました')
    } finally {
      setBulkLocking(false)
    }
  }

  /* ---- grade change ---- */

  const [changingGradeId, setChangingGradeId] = useState<string | null>(null)

  const handleGradeChange = async (contractId: string, newGrade: string, currentCourses: { course: string; lessons: number }[]) => {
    setChangingGradeId(contractId)
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      const res = await fetch(`/api/contracts/${contractId}?${params}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: newGrade, courses: currentCourses }),
      })
      if (!res.ok) throw new Error('学年変更に失敗しました')
      toast.success(`学年を${newGrade}に変更しました`)
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '学年変更に失敗しました')
    } finally {
      setChangingGradeId(null)
    }
  }

  // 未確定件数
  const unconfirmedCount =
    billing.filter(b => !b.confirmed && !b.out_of_period).length +
    lectureBilling.filter(l => !l.confirmed).length +
    materialBilling.filter(m => !m.confirmed).length +
    manualBilling.filter(m => !m.confirmed).length

  /* ---- detail dialog ---- */

  const openDetailDialog = (
    billingType: 'contract' | 'lecture' | 'material' | 'manual',
    refId: string,
    studentName: string,
    billedAmount: number,
    defaultMethod: string,
    existingPayment: Payment | null,
  ) => {
    setDialogTarget({ billingType, refId, studentName, billedAmount, defaultMethod, existingPayment })
    setPayForm({
      paid_amount: existingPayment ? String(existingPayment.paid_amount) : String(billedAmount),
      payment_date: existingPayment?.payment_date || new Date().toISOString().split('T')[0],
      payment_method: existingPayment?.payment_method || defaultMethod || '振込',
      followup_status: existingPayment?.followup_status || '',
      notes: existingPayment?.notes || '',
    })
    setDialogOpen(true)
  }

  const handleSavePayment = async () => {
    if (!dialogTarget) return
    setSaving(true)
    try {
      const paidAmount = parseInt(payForm.paid_amount) || 0
      const params = `pw=${encodeURIComponent(storedPw)}`

      if (dialogTarget.existingPayment) {
        const res = await fetch(`/api/payments/${dialogTarget.existingPayment.id}?${params}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paid_amount: paidAmount,
            billed_amount: dialogTarget.billedAmount,
            payment_date: payForm.payment_date || null,
            payment_method: payForm.payment_method || null,
            followup_status: payForm.followup_status,
            notes: payForm.notes,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.error || '更新に失敗しました')
        }
      } else {
        const res = await fetch(`/api/payments?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billing_type: dialogTarget.billingType,
            contract_id: dialogTarget.billingType === 'contract' ? dialogTarget.refId : null,
            lecture_id: dialogTarget.billingType === 'lecture' ? dialogTarget.refId : null,
            material_sale_id: dialogTarget.billingType === 'material' ? dialogTarget.refId : null,
            manual_billing_id: dialogTarget.billingType === 'manual' ? dialogTarget.refId : null,
            year,
            month,
            billed_amount: dialogTarget.billedAmount,
            paid_amount: paidAmount,
            payment_date: payForm.payment_date || null,
            payment_method: payForm.payment_method || null,
            notes: payForm.notes,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.error || '登録に失敗しました')
        }
      }

      toast.success('入金情報を保存しました')
      setDialogOpen(false)
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePayment = async () => {
    if (!dialogTarget?.existingPayment) return
    if (!confirm('この入金記録を削除して未入金に戻しますか？')) return
    setSaving(true)
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      const res = await fetch(`/api/payments/${dialogTarget.existingPayment.id}?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('入金記録を削除しました（未入金に戻りました）')
      setDialogOpen(false)
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '削除に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  /* ---- adjustment handlers ---- */

  const openAdjDialog = (item?: AdjustmentItem) => {
    setAdjLinkedTarget(null)
    if (item) {
      setAdjEditing(item)
      setAdjForm({
        student_id: item.student?.id || '',
        amount: String(item.amount),
        reason: item.reason,
        notes: item.notes,
      })
    } else {
      setAdjEditing(null)
      setAdjForm({ student_id: '', amount: '', reason: '', notes: '' })
    }
    setAdjDialogOpen(true)
  }

  /** 請求行から返金ダイアログを開く */
  const openLinkedAdjDialog = (
    billingType: 'contract' | 'lecture' | 'material' | 'manual',
    refId: string,
    studentId: string,
    studentName: string,
    billingLabel: string,
    billedAmount: number,
  ) => {
    setAdjEditing(null)
    setAdjLinkedTarget({ billingType, refId, studentName, billingLabel, billedAmount, studentId })
    setAdjForm({
      student_id: studentId,
      amount: String(-billedAmount),
      reason: '',
      notes: '',
    })
    setAdjDialogOpen(true)
  }

  const handleSaveAdjustment = async () => {
    if (!adjForm.student_id || !adjForm.amount) {
      toast.error('生徒と金額は必須です')
      return
    }
    setAdjSaving(true)
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      if (adjEditing) {
        const res = await fetch(`/api/adjustments/${adjEditing.id}?${params}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseInt(adjForm.amount),
            reason: adjForm.reason,
            notes: adjForm.notes,
          }),
        })
        if (!res.ok) throw new Error('更新に失敗しました')
        toast.success('調整を更新しました')
      } else {
        const postBody: Record<string, unknown> = {
          student_id: adjForm.student_id,
          year,
          month,
          amount: parseInt(adjForm.amount),
          reason: adjForm.reason,
          notes: adjForm.notes,
        }
        // 請求項目紐付けがある場合
        if (adjLinkedTarget) {
          if (adjLinkedTarget.billingType === 'contract') postBody.contract_id = adjLinkedTarget.refId
          if (adjLinkedTarget.billingType === 'lecture') postBody.lecture_id = adjLinkedTarget.refId
          if (adjLinkedTarget.billingType === 'material') postBody.material_sale_id = adjLinkedTarget.refId
        }
        const res = await fetch(`/api/adjustments?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postBody),
        })
        if (!res.ok) throw new Error('登録に失敗しました')
        toast.success('調整を追加しました')
      }
      setAdjDialogOpen(false)
      setAdjLinkedTarget(null)
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setAdjSaving(false)
    }
  }

  const handleMarkCompleted = async (item: AdjustmentItem) => {
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      const res = await fetch(`/api/adjustments/${item.id}?${params}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '対応済み' }),
      })
      if (!res.ok) throw new Error('更新に失敗しました')
      toast.success('対応済みにしました')
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新に失敗しました')
    }
  }

  const handleDeleteAdjustment = async (item: AdjustmentItem) => {
    if (!confirm('この調整データを削除しますか？')) return
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      const res = await fetch(`/api/adjustments/${item.id}?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('調整を削除しました')
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '削除に失敗しました')
    }
  }

  /* ---- manual billing handlers ---- */

  const openManualDialog = (item?: ManualBillingItem) => {
    if (item) {
      setManualEditing(item)
      setManualForm({
        student_id: item.student?.id || '',
        amount: String(item.amount),
        description: item.description,
        notes: item.notes,
      })
    } else {
      setManualEditing(null)
      setManualForm({ student_id: '', amount: '', description: '', notes: '' })
    }
    setManualDialogOpen(true)
  }

  const handleSaveManualBilling = async () => {
    if (!manualForm.student_id || !manualForm.amount || !manualForm.description) {
      toast.error('生徒・金額・説明は必須です')
      return
    }
    setManualSaving(true)
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      if (manualEditing) {
        const res = await fetch(`/api/manual-billings/${manualEditing.id}?${params}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseInt(manualForm.amount),
            description: manualForm.description,
            notes: manualForm.notes,
          }),
        })
        if (!res.ok) throw new Error('更新に失敗しました')
        toast.success('手動請求を更新しました')
      } else {
        const res = await fetch(`/api/manual-billings?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: manualForm.student_id,
            year,
            month,
            amount: parseInt(manualForm.amount),
            description: manualForm.description,
            notes: manualForm.notes,
          }),
        })
        if (!res.ok) throw new Error('登録に失敗しました')
        toast.success('手動請求を追加しました')
      }
      setManualDialogOpen(false)
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setManualSaving(false)
    }
  }

  const handleDeleteManualBilling = async (item: ManualBillingItem) => {
    if (!confirm('この手動請求を削除しますか？')) return
    try {
      const params = `pw=${encodeURIComponent(storedPw)}`
      const res = await fetch(`/api/manual-billings/${item.id}?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('手動請求を削除しました')
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '削除に失敗しました')
    }
  }

  /* ---- render helpers ---- */

  const formatYen = (n: number) => `¥${n.toLocaleString()}`
  const formatCourses = (courses: { course: string; lessons: number }[]) =>
    courses.map(c => `${c.course}(週${c.lessons})`).join(', ')
  const formatLectureCourses = (courses: { course: string; lessons: number }[]) =>
    courses.map(c => `${c.course}(${c.lessons}コマ)`).join(' + ')
  const formatDate = (d: string | null) => {
    if (!d) return ''
    const [, m, day] = d.split('-')
    return `${parseInt(m)}/${parseInt(day)}`
  }

  const paymentMethodBadge = (method: '振込' | '口座振替', options?: {
    onClick?: () => void
    isOverriding?: boolean
    isOverridden?: boolean
  }) => {
    const clickable = !!options?.onClick
    const overridden = options?.isOverridden
    if (method === '口座振替') {
      return (
        <Badge
          variant="outline"
          className={`text-xs border-blue-300 text-blue-700 bg-blue-50 ${clickable ? 'cursor-pointer hover:bg-blue-100 select-none' : ''} ${overridden ? 'ring-2 ring-blue-400' : ''}`}
          onClick={options?.onClick}
          title={clickable ? 'クリックで振込に切替' : undefined}
        >
          {options?.isOverriding ? <Loader2 className="h-3 w-3 animate-spin" /> : '口座振替'}
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className={`text-xs border-orange-300 text-orange-700 bg-orange-50 ${clickable ? 'cursor-pointer hover:bg-orange-100 select-none' : ''} ${overridden ? 'ring-2 ring-orange-400' : ''}`}
        onClick={options?.onClick}
        title={clickable ? 'クリックで口座振替に切替' : undefined}
      >
        {options?.isOverriding ? <Loader2 className="h-3 w-3 animate-spin" /> : '振込'}
      </Badge>
    )
  }

  const statusBadge = (status: '未入金' | '入金済み' | '過不足あり') => {
    switch (status) {
      case '入金済み':
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">入金済み</Badge>
      case '過不足あり':
        return <Badge variant="default" className="bg-yellow-600 hover:bg-yellow-700">過不足あり</Badge>
      default:
        return <Badge variant="secondary">未入金</Badge>
    }
  }

  const followupBadge = (s: string) => {
    if (!s) return null
    const color = s === '対応済み' ? 'bg-green-100 text-green-800' : s === '振込依頼中' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
    return <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>{s}</span>
  }

  const confirmationBadge = (item: { confirmed?: boolean; amount_changed?: boolean }) => {
    if (!item.confirmed) return null
    return (
      <div className="flex gap-1 items-center">
        <Badge variant="outline" className="text-xs border-green-400 text-green-700 bg-green-50">
          <Lock className="h-3 w-3 mr-0.5" />確定済
        </Badge>
        {item.amount_changed && (
          <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 bg-yellow-50">
            <AlertTriangle className="h-3 w-3 mr-0.5" />金額変動あり
          </Badge>
        )}
      </div>
    )
  }

  const lockActionCell = (
    key: ItemKey,
    billingType: 'contract' | 'lecture' | 'material' | 'manual',
    refId: string,
    item: { confirmed?: boolean; confirmation_id?: string },
  ) => {
    const isLocking = lockingKeys.has(key)
    if (item.confirmed && item.confirmation_id) {
      return (
        <Button
          size="sm"
          variant="ghost"
          className="text-orange-600 hover:text-orange-800"
          onClick={() => handleUnlockItem(item.confirmation_id!)}
        >
          <Unlock className="h-3.5 w-3.5 mr-1" />確定解除
        </Button>
      )
    }
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-green-700 border-green-300 hover:bg-green-50"
        disabled={isLocking}
        onClick={() => handleLockItem(key, billingType, refId)}
      >
        {isLocking
          ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />確定中</>
          : <><Lock className="h-3.5 w-3.5 mr-1" />確定</>
        }
      </Button>
    )
  }

  const paymentStatusCell = (payment: Payment | undefined) => {
    const status = getStatus(payment)
    if (!payment) return <>{statusBadge(status)}</>
    // オーバーライド専用レコード（入金額0・未入金）は通常の未入金と同じ表示
    if (payment.paid_amount === 0 && payment.status === '未入金') return <>{statusBadge(status)}</>
    return (
      <div className="flex flex-col items-center gap-0.5">
        {statusBadge(status)}
        <span className="text-xs text-muted-foreground">
          {formatDate(payment.payment_date)} {payment.payment_method}
        </span>
        {payment.difference !== 0 && (
          <span className={`text-xs font-medium ${payment.difference > 0 ? 'text-blue-600' : 'text-red-600'}`}>
            差額{formatYen(payment.difference)}
          </span>
        )}
        {followupBadge(payment.followup_status)}
      </div>
    )
  }

  const actionCell = (
    key: ItemKey,
    billingType: 'contract' | 'lecture' | 'material' | 'manual',
    refId: string,
    studentId: string,
    studentName: string,
    billedAmount: number,
    billingLabel: string,
    defaultMethod: string,
    payment: Payment | undefined,
  ) => {
    const isConfirming = confirmingKeys.has(key)
    const displayMethod = getDisplayPaymentMethod(payment, defaultMethod as '振込' | '口座振替')
    const isUnpaid = isUnpaidStatus(payment)
    if (isUnpaid) {
      return (
        <div className="flex gap-1 justify-center flex-wrap">
          <Button
            size="sm"
            disabled={isConfirming}
            onClick={() => handleQuickConfirm(key, billingType, refId, billedAmount, displayMethod)}
          >
            {isConfirming
              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />処理中</>
              : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />入金OK</>
            }
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={isConfirming}
            onClick={() => openDetailDialog(billingType, refId, studentName, billedAmount, displayMethod, payment ?? null)}
          >
            詳細
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-700"
            onClick={() => openLinkedAdjDialog(billingType, refId, studentId, studentName, billingLabel, billedAmount)}
          >
            <Undo2 className="h-3.5 w-3.5 mr-1" />返金
          </Button>
        </div>
      )
    }
    return (
      <div className="flex gap-1 justify-center flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={() => openDetailDialog(billingType, refId, studentName, billedAmount, displayMethod, payment!)}
        >
          編集
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-500 hover:text-red-700"
          onClick={() => openLinkedAdjDialog(billingType, refId, studentId, studentName, billingLabel, billedAmount)}
        >
          <Undo2 className="h-3.5 w-3.5 mr-1" />返金
        </Button>
      </div>
    )
  }

  /** 請求額セル: 調整がある場合はインライン表示 */
  const billedAmountCell = (amount: number, adjustments: AdjustmentItem[]) => {
    if (adjustments.length === 0) {
      return <span className="font-mono font-bold">{formatYen(amount)}</span>
    }
    const adjTotal = adjustments.reduce((s, a) => s + a.amount, 0)
    const netAmount = amount + adjTotal
    return (
      <div className="space-y-0.5">
        <div className="font-mono font-bold">{formatYen(amount)}</div>
        {adjustments.map(a => (
          <div key={a.id} className="text-xs text-red-600">
            返金 {formatYen(a.amount)}{a.reason ? `（${a.reason}）` : ''}
          </div>
        ))}
        <div className="border-t border-gray-300 pt-0.5 text-xs font-bold text-gray-700">
          実質 {formatYen(netAmount)}
        </div>
      </div>
    )
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
  const payDifference = parseInt(payForm.paid_amount || '0') - (dialogTarget?.billedAmount || 0)

  /* ---- main ---- */

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">請求・入金</h2>
          <Link
            href="/admin/contracts/billing/history"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            履歴を見る <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/admin/contracts/help"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <HelpCircle className="h-3.5 w-3.5" /> マニュアル
          </Link>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => <SelectItem key={m} value={String(m)}>{m}月</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex rounded-lg border overflow-hidden ml-4">
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === 'category' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              onClick={() => setViewMode('category')}
            >
              カテゴリ別
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === 'student' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              onClick={() => setViewMode('student')}
            >
              生徒別
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">当月合計請求額</div>
          <div className="text-3xl font-bold">{formatYen(total)}</div>
          <div className="flex gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
            <span>通常コース: {formatYen(contractTotal)}（{billing.length}件）</span>
            {lectureTotal > 0 && <span>講習: {formatYen(lectureTotal)}（{lectureBilling.length}件）</span>}
            {materialTotal > 0 && <span>教材販売: {formatYen(materialTotal)}（{materialBilling.length}件）</span>}
            {manualTotal > 0 && <span>個別請求: {formatYen(manualTotal)}（{manualBilling.length}件）</span>}
            {adjustmentTotal !== 0 && <span className={adjustmentTotal < 0 ? 'text-red-600' : ''}>返金・調整: {formatYen(adjustmentTotal)}（{adjustmentBilling.length}件）</span>}
          </div>
          <div className="flex gap-4 text-sm mt-2">
            <span className="text-green-600">入金済: {paidCount}件 {formatYen(paidAmount)}</span>
            <span className="text-gray-500">未入金: {unpaidCount}件</span>
            {discrepancyCount > 0 && <span className="text-yellow-600">過不足: {discrepancyCount}件</span>}
          </div>
          {unpaidCount > 0 && (
            <div className="flex gap-4 text-sm mt-1 text-muted-foreground">
              {unpaidByTransfer > 0 && <span className="text-orange-600">振込: {unpaidByTransfer}件 未入金</span>}
              {unpaidByDirectDebit > 0 && <span className="text-blue-600">口座振替: {unpaidByDirectDebit}件 未入金</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter + bulk action */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-2">
            {(['all', '未入金', '入金済み', '過不足あり'] as const).map(s => (
              <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
                {s === 'all' ? 'すべて' : s}
              </Button>
            ))}
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-muted-foreground mr-1">支払方法:</span>
            {(['all', '振込', '口座振替'] as const).map(m => (
              <Button key={m} variant={paymentMethodFilter === m ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethodFilter(m)}>
                {m === 'all' ? '全件' : m}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {unconfirmedCount > 0 && (
            <Button
              variant="outline"
              className="text-green-700 border-green-300 hover:bg-green-50"
              onClick={handleBulkLock}
              disabled={bulkLocking}
            >
              {bulkLocking
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />確定中...</>
                : <><Lock className="h-4 w-4 mr-1" />未確定をすべて確定 ({unconfirmedCount}件)</>
              }
            </Button>
          )}
          {unpaidByDirectDebit > 0 && (
            <Button
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={handleBulkDirectDebitConfirm}
              disabled={bulkSaving}
            >
              {bulkSaving
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />処理中...</>
                : <><CheckCircle2 className="h-4 w-4 mr-1" />口座振替 一括入金OK ({unpaidByDirectDebit}件)</>
              }
            </Button>
          )}
          {selected.size > 0 && (
            <Button onClick={handleBulkConfirm} disabled={bulkSaving}>
              {bulkSaving
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />処理中...</>
                : <><CheckCircle2 className="h-4 w-4 mr-1" />{selected.size}件を一括入金OK</>
              }
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : viewMode === 'student' ? (
        <StudentBillingView
          students={students}
          formatYen={formatYen}
        />
      ) : (
        <>
          {/* 通常コース */}
          <h3 className="text-lg font-semibold">通常コース</h3>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[60vh]"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center sticky-col bg-muted" style={{left:0, minWidth:40}}>
                      {allUnpaidKeys.length > 0 && (
                        <Checkbox checked={allUnpaidSelected} onCheckedChange={toggleAll} aria-label="未入金を全選択" />
                      )}
                    </TableHead>
                    <TableHead className="sticky-col bg-muted" style={{left:40, minWidth:72}}>塾生番号</TableHead>
                    <TableHead className="sticky-col sticky-col-last bg-muted" style={{left:112, minWidth:80}}>生徒名</TableHead>
                    <TableHead className="text-center">支払方法</TableHead>
                    <TableHead>学年</TableHead>
                    <TableHead>コース</TableHead>
                    <TableHead className="text-right">授業料</TableHead>
                    <TableHead className="text-right">入塾金</TableHead>
                    <TableHead className="text-right">設備利用料</TableHead>
                    <TableHead className="text-right">割引</TableHead>
                    <TableHead className="text-right">請求額</TableHead>
                    <TableHead className="text-center">確定</TableHead>
                    <TableHead className="text-center">入金状況</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBilling.map(b => {
                    const payment = getPayment('contract', b.id)
                    const isUnpaid = isUnpaidStatus(payment)
                    const key = contractKey(b.id)
                    const displayMethod = getDisplayPaymentMethod(payment, b.effective_payment_method)
                    const isOverridden = payment?.payment_method != null && payment.payment_method !== b.effective_payment_method
                    return (
                      <TableRow key={b.id} className={`${confirmingKeys.has(key) ? 'opacity-60' : ''} ${b.confirmed ? 'bg-red-100' : ''} ${b.out_of_period ? 'bg-gray-50' : ''}`}>
                        <TableCell className="text-center sticky-col bg-white" style={{left:0, minWidth:40}}>
                          {isUnpaid && !b.out_of_period && <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm sticky-col bg-white" style={{left:40, minWidth:72}}>{b.student?.student_number || '-'}</TableCell>
                        <TableCell className="font-medium sticky-col sticky-col-last bg-white" style={{left:112, minWidth:80}}>
                          {b.student?.name}
                          {b.out_of_period && <Badge variant="outline" className="ml-1 text-xs border-gray-400 text-gray-500">契約期間外</Badge>}
                          {b.suspended && <Badge variant="outline" className="ml-1 text-xs border-blue-400 text-blue-600">休塾中</Badge>}
                        </TableCell>
                        <TableCell className="text-center">{paymentMethodBadge(displayMethod, {
                          onClick: () => handleTogglePaymentMethod(key, 'contract', b.id, b.total_amount, displayMethod, payment),
                          isOverriding: overridingKeys.has(key),
                          isOverridden,
                        })}</TableCell>
                        <TableCell>
                          {changingGradeId === b.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Select
                              value={b.grade}
                              onValueChange={(v) => handleGradeChange(b.id, v, b.courses)}
                            >
                              <SelectTrigger className="h-7 w-20 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {GRADES.map(g => (
                                  <SelectItem key={g} value={g}>{g}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatCourses(b.courses)}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(b.tuition)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {b.enrollment_fee_amount > 0 ? formatYen(b.enrollment_fee_amount) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatYen(b.facility_fee)}
                          {b.facility_fee !== 3300 && <span className="text-xs text-muted-foreground ml-1">(半月)</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-500">
                          {b.campaign_discount_amount > 0 ? `-${formatYen(b.campaign_discount_amount)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">{billedAmountCell(b.total_amount, getAdjustmentsForItem('contract', b.id))}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {confirmationBadge(b)}
                            {lockActionCell(key, 'contract', b.id, b)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{paymentStatusCell(payment)}</TableCell>
                        <TableCell className="text-center">
                          {actionCell(key, 'contract', b.id, b.student?.id || '', b.student?.name || '', b.total_amount, formatCourses(b.courses), b.effective_payment_method, payment)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredBilling.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                        {statusFilter !== 'all' || paymentMethodFilter !== 'all' ? '該当するデータがありません' : '該当月の通常コース請求データがありません'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>

          {/* 講習 */}
          <h3 className="text-lg font-semibold">講習</h3>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[60vh]"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sticky-col bg-muted" style={{left:0, minWidth:40}} />
                    <TableHead className="sticky-col bg-muted" style={{left:40, minWidth:72}}>塾生番号</TableHead>
                    <TableHead className="sticky-col sticky-col-last bg-muted" style={{left:112, minWidth:80}}>生徒名</TableHead>
                    <TableHead className="text-center">支払方法</TableHead>
                    <TableHead>ラベル</TableHead>
                    <TableHead>コース</TableHead>
                    <TableHead className="text-right">当月請求額</TableHead>
                    <TableHead className="text-center">確定</TableHead>
                    <TableHead className="text-center">入金状況</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLectures.map(l => {
                    const payment = getPayment('lecture', l.id)
                    const isUnpaid = isUnpaidStatus(payment)
                    const key = lectureKey(l.id)
                    const displayMethod = getDisplayPaymentMethod(payment, l.effective_payment_method)
                    const isOverridden = payment?.payment_method != null && payment.payment_method !== l.effective_payment_method
                    return (
                      <TableRow key={l.id} className={`${confirmingKeys.has(key) ? 'opacity-60' : ''} ${l.confirmed ? 'bg-red-100' : ''}`}>
                        <TableCell className="text-center sticky-col bg-white" style={{left:0, minWidth:40}}>
                          {isUnpaid && <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm sticky-col bg-white" style={{left:40, minWidth:72}}>{l.student?.student_number || '-'}</TableCell>
                        <TableCell className="font-medium sticky-col sticky-col-last bg-white" style={{left:112, minWidth:80}}>{l.student?.name}</TableCell>
                        <TableCell className="text-center">{paymentMethodBadge(displayMethod, {
                          onClick: () => handleTogglePaymentMethod(key, 'lecture', l.id, l.total_amount, displayMethod, payment),
                          isOverriding: overridingKeys.has(key),
                          isOverridden,
                        })}</TableCell>
                        <TableCell className="text-sm">{l.label}</TableCell>
                        <TableCell className="text-sm">{formatLectureCourses(l.courses)}</TableCell>
                        <TableCell className="text-right">{billedAmountCell(l.total_amount, getAdjustmentsForItem('lecture', l.id))}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {confirmationBadge(l)}
                            {lockActionCell(key, 'lecture', l.id, l)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{paymentStatusCell(payment)}</TableCell>
                        <TableCell className="text-center">
                          {actionCell(key, 'lecture', l.id, l.student?.id || '', l.student?.name || '', l.total_amount, l.label, l.effective_payment_method, payment)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredLectures.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {statusFilter !== 'all' || paymentMethodFilter !== 'all' ? '該当するデータがありません' : '該当月の講習請求データがありません'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>

          {/* 教材販売 */}
          <h3 className="text-lg font-semibold">教材販売</h3>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[60vh]"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sticky-col bg-muted" style={{left:0, minWidth:40}} />
                    <TableHead className="sticky-col bg-muted" style={{left:40, minWidth:72}}>塾生番号</TableHead>
                    <TableHead className="sticky-col sticky-col-last bg-muted" style={{left:112, minWidth:80}}>生徒名</TableHead>
                    <TableHead className="text-center">支払方法</TableHead>
                    <TableHead>品名</TableHead>
                    <TableHead className="text-center">数量</TableHead>
                    <TableHead className="text-right">単価</TableHead>
                    <TableHead className="text-right">請求額</TableHead>
                    <TableHead className="text-center">確定</TableHead>
                    <TableHead className="text-center">入金状況</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map(m => {
                    const payment = getPayment('material', m.id)
                    const isUnpaid = isUnpaidStatus(payment)
                    const key = materialKey(m.id)
                    const displayMethod = getDisplayPaymentMethod(payment, m.effective_payment_method)
                    const isOverridden = payment?.payment_method != null && payment.payment_method !== m.effective_payment_method
                    return (
                      <TableRow key={m.id} className={`${confirmingKeys.has(key) ? 'opacity-60' : ''} ${m.confirmed ? 'bg-red-100' : ''}`}>
                        <TableCell className="text-center sticky-col bg-white" style={{left:0, minWidth:40}}>
                          {isUnpaid && <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm sticky-col bg-white" style={{left:40, minWidth:72}}>{m.student?.student_number || '-'}</TableCell>
                        <TableCell className="font-medium sticky-col sticky-col-last bg-white" style={{left:112, minWidth:80}}>{m.student?.name}</TableCell>
                        <TableCell className="text-center">{paymentMethodBadge(displayMethod, {
                          onClick: () => handleTogglePaymentMethod(key, 'material', m.id, m.total_amount, displayMethod, payment),
                          isOverriding: overridingKeys.has(key),
                          isOverridden,
                        })}</TableCell>
                        <TableCell className="text-sm">{m.item_name}</TableCell>
                        <TableCell className="text-center">{m.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(m.unit_price)}</TableCell>
                        <TableCell className="text-right">{billedAmountCell(m.total_amount, getAdjustmentsForItem('material', m.id))}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {confirmationBadge(m)}
                            {lockActionCell(key, 'material', m.id, m)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{paymentStatusCell(payment)}</TableCell>
                        <TableCell className="text-center">
                          {actionCell(key, 'material', m.id, m.student?.id || '', m.student?.name || '', m.total_amount, m.item_name, m.effective_payment_method, payment)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredMaterials.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        {statusFilter !== 'all' || paymentMethodFilter !== 'all' ? '該当するデータがありません' : '該当月の教材販売データがありません'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>

          {/* 個別請求（手動追加） */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">個別請求（手動追加）</h3>
              <p className="text-xs text-muted-foreground">コース・講習・教材に該当しない請求を手動で追加できます</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => openManualDialog()}>
              <Plus className="h-4 w-4 mr-1" />個別請求を追加
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[60vh]"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sticky-col bg-muted" style={{left:0, minWidth:40}} />
                    <TableHead className="sticky-col bg-muted" style={{left:40, minWidth:72}}>塾生番号</TableHead>
                    <TableHead className="sticky-col sticky-col-last bg-muted" style={{left:112, minWidth:80}}>生徒名</TableHead>
                    <TableHead className="text-center">支払方法</TableHead>
                    <TableHead>説明</TableHead>
                    <TableHead className="text-right">請求額</TableHead>
                    <TableHead className="text-center">確定</TableHead>
                    <TableHead className="text-center">入金状況</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredManuals.map(m => {
                    const payment = getPayment('manual', m.id)
                    const isUnpaid = isUnpaidStatus(payment)
                    const key = manualKey(m.id)
                    const displayMethod = getDisplayPaymentMethod(payment, m.effective_payment_method)
                    const isOverridden = payment?.payment_method != null && payment.payment_method !== m.effective_payment_method
                    return (
                      <TableRow key={m.id} className={`${confirmingKeys.has(key) ? 'opacity-60' : ''} ${m.confirmed ? 'bg-red-100' : ''}`}>
                        <TableCell className="text-center sticky-col bg-white" style={{left:0, minWidth:40}}>
                          {isUnpaid && <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm sticky-col bg-white" style={{left:40, minWidth:72}}>{m.student?.student_number || '-'}</TableCell>
                        <TableCell className="font-medium sticky-col sticky-col-last bg-white" style={{left:112, minWidth:80}}>{m.student?.name}</TableCell>
                        <TableCell className="text-center">{paymentMethodBadge(displayMethod, {
                          onClick: () => handleTogglePaymentMethod(key, 'manual', m.id, m.amount, displayMethod, payment),
                          isOverriding: overridingKeys.has(key),
                          isOverridden,
                        })}</TableCell>
                        <TableCell className="text-sm">{m.description}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatYen(m.amount)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {confirmationBadge(m)}
                            {lockActionCell(key, 'manual', m.id, m)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{paymentStatusCell(payment)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center flex-wrap">
                            {isUnpaid ? (
                              <>
                                <Button
                                  size="sm"
                                  disabled={confirmingKeys.has(key)}
                                  onClick={() => handleQuickConfirm(key, 'manual', m.id, m.amount, displayMethod)}
                                >
                                  {confirmingKeys.has(key)
                                    ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />処理中</>
                                    : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />入金OK</>
                                  }
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground"
                                  disabled={confirmingKeys.has(key)}
                                  onClick={() => openDetailDialog('manual', m.id, m.student?.name || '', m.amount, displayMethod, payment ?? null)}
                                >
                                  入金詳細
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDetailDialog('manual', m.id, m.student?.name || '', m.amount, displayMethod, payment!)}
                              >
                                入金編集
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openManualDialog(m)}>
                              請求編集
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteManualBilling(m)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredManuals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        {statusFilter !== 'all' || paymentMethodFilter !== 'all' ? '該当するデータがありません' : '該当月の個別請求データはありません'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>

          {/* 返金・値引き調整 */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">返金・値引き調整</h3>
              <p className="text-xs text-muted-foreground">返金や値引きなど、請求額の増減を記録します</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => openAdjDialog()}>
              <Plus className="h-4 w-4 mr-1" />返金・調整を追加
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[60vh]"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky-col bg-muted" style={{left:0, minWidth:72}}>塾生番号</TableHead>
                    <TableHead className="sticky-col sticky-col-last bg-muted" style={{left:72, minWidth:80}}>生徒名</TableHead>
                    <TableHead>紐付き先</TableHead>
                    <TableHead>理由</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead className="text-center">対応状況</TableHead>
                    <TableHead>備考</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherAdjustments.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="text-muted-foreground text-sm sticky-col bg-white" style={{left:0, minWidth:72}}>{a.student?.student_number || '-'}</TableCell>
                      <TableCell className="font-medium sticky-col sticky-col-last bg-white" style={{left:72, minWidth:80}}>{a.student?.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.linked_label || '-'}
                      </TableCell>
                      <TableCell className="text-sm">{a.reason}</TableCell>
                      <TableCell className={`text-right font-mono font-bold ${a.amount < 0 ? 'text-red-600' : ''}`}>
                        {formatYen(a.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {a.status === '対応済み'
                          ? <Badge variant="default" className="bg-green-600 hover:bg-green-700">対応済み</Badge>
                          : <Badge variant="secondary">未対応</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.notes}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          {a.status !== '対応済み' && (
                            <Button size="sm" variant="outline" onClick={() => handleMarkCompleted(a)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />対応済み
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openAdjDialog(a)}>
                            編集
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteAdjustment(a)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {otherAdjustments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        該当月の返金・値引き調整データはありません
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table></div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTarget?.existingPayment ? '入金情報の編集' : '入金を記録（金額指定）'}</DialogTitle>
          </DialogHeader>
          {dialogTarget && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="text-sm"><span className="text-muted-foreground">生徒:</span> {dialogTarget.studentName}</div>
                <div className="text-sm"><span className="text-muted-foreground">請求額:</span> <span className="font-bold">{formatYen(dialogTarget.billedAmount)}</span></div>
              </div>
              <div className="space-y-2">
                <Label>入金額</Label>
                <Input type="number" value={payForm.paid_amount} onChange={e => setPayForm({ ...payForm, paid_amount: e.target.value })} />
                {payForm.paid_amount && payDifference !== 0 && (
                  <p className={`text-sm font-medium ${payDifference > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    差額: {formatYen(payDifference)}（{payDifference > 0 ? '過入金' : '不足'}）
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>入金日</Label>
                <Input type="date" value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>支払方法</Label>
                <Select value={payForm.payment_method} onValueChange={v => setPayForm({ ...payForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="振込">振込</SelectItem>
                    <SelectItem value="口座振替">口座振替</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(payDifference !== 0 || dialogTarget.existingPayment?.followup_status) && (
                <div className="space-y-2">
                  <Label>フォローアップ</Label>
                  <Select
                    value={payForm.followup_status || '__none__'}
                    onValueChange={v => setPayForm({ ...payForm, followup_status: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">未設定</SelectItem>
                      <SelectItem value="振込依頼中">振込依頼中</SelectItem>
                      <SelectItem value="対応済み">対応済み</SelectItem>
                      <SelectItem value="対応不要">対応不要</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>備考</Label>
                <Input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} placeholder="任意" />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <div>
              {dialogTarget?.existingPayment && (() => {
                const isOverrideOnly = dialogTarget.existingPayment!.status === '未入金' && dialogTarget.existingPayment!.paid_amount === 0
                return (
                  <Button variant="destructive" size="sm" onClick={handleDeletePayment} disabled={saving}>
                    {isOverrideOnly ? 'オーバーライドを解除' : '未入金に戻す'}
                  </Button>
                )
              })()}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
              <Button onClick={handleSavePayment} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />保存中</> : '保存'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment dialog */}
      <Dialog open={adjDialogOpen} onOpenChange={(open) => { setAdjDialogOpen(open); if (!open) setAdjLinkedTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{adjEditing ? '調整を編集' : adjLinkedTarget ? '返金・調整を追加' : '調整を追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 紐付きモード: 請求情報を表示 */}
            {adjLinkedTarget && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="text-sm"><span className="text-muted-foreground">生徒:</span> {adjLinkedTarget.studentName}</div>
                <div className="text-sm"><span className="text-muted-foreground">請求内容:</span> {adjLinkedTarget.billingLabel}</div>
                <div className="text-sm"><span className="text-muted-foreground">請求額:</span> <span className="font-bold">{formatYen(adjLinkedTarget.billedAmount)}</span></div>
              </div>
            )}
            {/* 編集モード: 生徒名を表示 */}
            {adjEditing && (
              <div className="bg-muted/50 rounded-lg p-3">
                <span className="text-sm text-muted-foreground">生徒:</span> {adjEditing.student?.name}
              </div>
            )}
            {/* 紐付けなし新規: 生徒選択 */}
            {!adjEditing && !adjLinkedTarget && (
              <div className="space-y-2">
                <Label>生徒</Label>
                <Select value={adjForm.student_id} onValueChange={v => setAdjForm({ ...adjForm, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="生徒を選択" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.student_number ? `${s.student_number} ` : ''}{s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>金額（マイナス=返金、プラス=追加請求）</Label>
              <Input
                type="number"
                value={adjForm.amount}
                onChange={e => setAdjForm({ ...adjForm, amount: e.target.value })}
                placeholder="-100000"
              />
            </div>
            <div className="space-y-2">
              <Label>理由</Label>
              <Input
                value={adjForm.reason}
                onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })}
                placeholder="例: コマ数減による返金"
              />
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Input
                value={adjForm.notes}
                onChange={e => setAdjForm({ ...adjForm, notes: e.target.value })}
                placeholder="任意"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAdjDialogOpen(false); setAdjLinkedTarget(null) }}>キャンセル</Button>
            <Button onClick={handleSaveAdjustment} disabled={adjSaving}>
              {adjSaving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />保存中</> : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual billing dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{manualEditing ? '個別請求を編集' : '個別請求を追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {manualEditing ? (
              <div className="bg-muted/50 rounded-lg p-3">
                <span className="text-sm text-muted-foreground">生徒:</span> {manualEditing.student?.name}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>生徒</Label>
                <Select value={manualForm.student_id} onValueChange={v => setManualForm({ ...manualForm, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="生徒を選択" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.student_number ? `${s.student_number} ` : ''}{s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>金額</Label>
              <Input
                type="number"
                value={manualForm.amount}
                onChange={e => setManualForm({ ...manualForm, amount: e.target.value })}
                placeholder="1000"
              />
            </div>
            <div className="space-y-2">
              <Label>説明</Label>
              <Input
                value={manualForm.description}
                onChange={e => setManualForm({ ...manualForm, description: e.target.value })}
                placeholder="例: 差額請求（3月分不足分）"
              />
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Input
                value={manualForm.notes}
                onChange={e => setManualForm({ ...manualForm, notes: e.target.value })}
                placeholder="任意"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSaveManualBilling} disabled={manualSaving}>
              {manualSaving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />保存中</> : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

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
import { Lock, CheckCircle2, Loader2, ArrowRight, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useDashboardAuth } from '@/hooks/use-dashboard-auth'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Payment {
  id: string
  billing_type: 'contract' | 'lecture' | 'material'
  contract_id: string | null
  lecture_id: string | null
  material_sale_id: string | null
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
}

interface LectureBillingItem {
  id: string
  student: { id: string; name: string; student_number: string | null; payment_method: string }
  label: string
  grade: string
  courses: { course: string; unit_price: number; lessons: number; amount: number }[]
  total_amount: number
  effective_payment_method: '振込' | '口座振替'
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
}

type ItemKey = string
const contractKey = (id: string): ItemKey => `contract:${id}`
const lectureKey = (id: string): ItemKey => `lecture:${id}`
const materialKey = (id: string): ItemKey => `material:${id}`

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
  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [contractTotal, setContractTotal] = useState(0)
  const [lectureTotal, setLectureTotal] = useState(0)
  const [materialTotal, setMaterialTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all')

  // パスワード認証
  const { authenticated, password, setPassword, storedPw, verifying, initializing, handleAuth: authHandler } = useDashboardAuth()

  // 一括選択
  const [selected, setSelected] = useState<Set<ItemKey>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)

  // 個別確認中のキー（ローディング表示用）
  const [confirmingKeys, setConfirmingKeys] = useState<Set<ItemKey>>(new Set())

  // 支払方法オーバーライド中のキー
  const [overridingKeys, setOverridingKeys] = useState<Set<ItemKey>>(new Set())

  // 詳細ダイアログ
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTarget, setDialogTarget] = useState<{
    billingType: 'contract' | 'lecture' | 'material'
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
      setTotal(json.total || 0)
      setContractTotal(json.contractTotal || 0)
      setLectureTotal(json.lectureTotal || 0)
      setMaterialTotal(json.materialTotal || 0)
    }
    if (paymentsRes.ok) {
      const json = await paymentsRes.json()
      setPayments(json.data || [])
    }
    setSelected(new Set())
  }, [year, month])

  const handleAuth = () => authHandler(`/api/contracts/billing?year=${year}&month=${month}`)

  useEffect(() => {
    if (!authenticated || initializing) return
    setLoading(true)
    fetchData(storedPw).finally(() => setLoading(false))
  }, [year, month, authenticated, initializing, storedPw, fetchData])

  /* ---- payment lookup ---- */

  const getPayment = (type: 'contract' | 'lecture' | 'material', id: string): Payment | undefined =>
    payments.find(p =>
      type === 'contract' ? p.contract_id === id
        : type === 'lecture' ? p.lecture_id === id
        : p.material_sale_id === id
    )

  const getStatus = (payment: Payment | undefined): '未入金' | '入金済み' | '過不足あり' =>
    payment?.status as '未入金' | '入金済み' | '過不足あり' ?? '未入金'

  /** payment レコードに payment_method があればそちら優先（オーバーライド） */
  const getDisplayPaymentMethod = (payment: Payment | undefined, epm: '振込' | '口座振替'): '振込' | '口座振替' =>
    (payment?.payment_method as '振込' | '口座振替') || epm

  /** オーバーライド用レコード（paid_amount=0, status=未入金）も未入金扱い */
  const isUnpaidStatus = (payment: Payment | undefined): boolean =>
    !payment || payment.status === '未入金'

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

  const filteredBilling = sortByStudentNumber(filterByStatus(billing, b => getPayment('contract', b.id), b => getDisplayPaymentMethod(getPayment('contract', b.id), b.effective_payment_method)))
  const filteredLectures = sortByStudentNumber(filterByStatus(lectureBilling, l => getPayment('lecture', l.id), l => getDisplayPaymentMethod(getPayment('lecture', l.id), l.effective_payment_method)))
  const filteredMaterials = sortByStudentNumber(filterByStatus(materialBilling, m => getPayment('material', m.id), m => getDisplayPaymentMethod(getPayment('material', m.id), m.effective_payment_method)))

  /* ---- stats ---- */

  const allItems = [
    ...billing.map(b => { const p = getPayment('contract', b.id); return { amount: b.total_amount, payment: p, epm: getDisplayPaymentMethod(p, b.effective_payment_method) } }),
    ...lectureBilling.map(l => { const p = getPayment('lecture', l.id); return { amount: l.total_amount, payment: p, epm: getDisplayPaymentMethod(p, l.effective_payment_method) } }),
    ...materialBilling.map(m => { const p = getPayment('material', m.id); return { amount: m.total_amount, payment: p, epm: getDisplayPaymentMethod(p, m.effective_payment_method) } }),
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
  ]
  const allUnpaidSelected = allUnpaidKeys.length > 0 && allUnpaidKeys.every(k => selected.has(k))

  const toggleAll = () => {
    setSelected(allUnpaidSelected ? new Set() : new Set(allUnpaidKeys))
  }

  /* ---- quick confirm (1-click) ---- */

  const quickConfirmApi = async (billingType: 'contract' | 'lecture' | 'material', refId: string, billedAmount: number, method: string) => {
    const params = `pw=${encodeURIComponent(storedPw)}`
    const res = await fetch(`/api/payments?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billing_type: billingType,
        contract_id: billingType === 'contract' ? refId : null,
        lecture_id: billingType === 'lecture' ? refId : null,
        material_sale_id: billingType === 'material' ? refId : null,
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
    billingType: 'contract' | 'lecture' | 'material',
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

  const handleQuickConfirm = async (key: ItemKey, billingType: 'contract' | 'lecture' | 'material', refId: string, billedAmount: number, method: string) => {
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
        const [type, id] = key.split(':') as ['contract' | 'lecture' | 'material', string]
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
        }
      }
      await Promise.all(promises)
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
      await Promise.all(promises)
      toast.success(`口座振替 ${promises.length}件を入金OKにしました`)
      await fetchData(storedPw)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '一括入金OKの処理に失敗しました')
    } finally {
      setBulkSaving(false)
      setConfirmingKeys(new Set())
    }
  }

  /* ---- detail dialog ---- */

  const openDetailDialog = (
    billingType: 'contract' | 'lecture' | 'material',
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

  const paymentStatusCell = (payment: Payment | undefined) => {
    const status = getStatus(payment)
    if (!payment) return <>{statusBadge(status)}</>
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
    billingType: 'contract' | 'lecture' | 'material',
    refId: string,
    studentName: string,
    billedAmount: number,
    defaultMethod: string,
    payment: Payment | undefined,
  ) => {
    const isConfirming = confirmingKeys.has(key)
    const displayMethod = getDisplayPaymentMethod(payment, defaultMethod as '振込' | '口座振替')
    const isUnpaid = isUnpaidStatus(payment)
    if (isUnpaid) {
      return (
        <div className="flex gap-1 justify-center">
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
        </div>
      )
    }
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => openDetailDialog(billingType, refId, studentName, billedAmount, displayMethod, payment!)}
      >
        編集
      </Button>
    )
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
  const payDifference = parseInt(payForm.paid_amount || '0') - (dialogTarget?.billedAmount || 0)

  /* ---- auth screen ---- */

  if (initializing) return <LoadingSpinner />
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">請求・入金</h2>
              <p className="text-sm text-muted-foreground text-center">閲覧にはパスワードが必要です</p>
            </div>
            <div className="space-y-2">
              <Label>パスワード</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAuth() }}
                autoFocus
              />
            </div>
            <Button className="w-full" onClick={handleAuth} disabled={verifying}>
              {verifying ? '確認中...' : 'ログイン'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

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
      ) : (
        <>
          {/* 通常コース */}
          <h3 className="text-lg font-semibold">通常コース</h3>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      {allUnpaidKeys.length > 0 && (
                        <Checkbox checked={allUnpaidSelected} onCheckedChange={toggleAll} aria-label="未入金を全選択" />
                      )}
                    </TableHead>
                    <TableHead>塾生番号</TableHead>
                    <TableHead>生徒名</TableHead>
                    <TableHead className="text-center">支払方法</TableHead>
                    <TableHead>コース</TableHead>
                    <TableHead className="text-right">月謝</TableHead>
                    <TableHead className="text-right">入塾金</TableHead>
                    <TableHead className="text-right">設備利用料</TableHead>
                    <TableHead className="text-right">割引</TableHead>
                    <TableHead className="text-right">請求額</TableHead>
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
                      <TableRow key={b.id} className={confirmingKeys.has(key) ? 'opacity-60' : ''}>
                        <TableCell className="text-center">
                          {isUnpaid && <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{b.student?.student_number || '-'}</TableCell>
                        <TableCell className="font-medium">{b.student?.name}</TableCell>
                        <TableCell className="text-center">{paymentMethodBadge(displayMethod, {
                          onClick: () => handleTogglePaymentMethod(key, 'contract', b.id, b.total_amount, displayMethod, payment),
                          isOverriding: overridingKeys.has(key),
                          isOverridden,
                        })}</TableCell>
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
                        <TableCell className="text-right font-mono font-bold">{formatYen(b.total_amount)}</TableCell>
                        <TableCell className="text-center">{paymentStatusCell(payment)}</TableCell>
                        <TableCell className="text-center">
                          {actionCell(key, 'contract', b.id, b.student?.name || '', b.total_amount, b.effective_payment_method, payment)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredBilling.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                        {statusFilter !== 'all' || paymentMethodFilter !== 'all' ? '該当するデータがありません' : '該当月の通常コース請求データがありません'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 講習 */}
          <h3 className="text-lg font-semibold">講習</h3>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>塾生番号</TableHead>
                    <TableHead>生徒名</TableHead>
                    <TableHead className="text-center">支払方法</TableHead>
                    <TableHead>ラベル</TableHead>
                    <TableHead>コース</TableHead>
                    <TableHead className="text-right">当月請求額</TableHead>
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
                      <TableRow key={l.id} className={confirmingKeys.has(key) ? 'opacity-60' : ''}>
                        <TableCell className="text-center">
                          {isUnpaid && <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{l.student?.student_number || '-'}</TableCell>
                        <TableCell className="font-medium">{l.student?.name}</TableCell>
                        <TableCell className="text-center">{paymentMethodBadge(displayMethod, {
                          onClick: () => handleTogglePaymentMethod(key, 'lecture', l.id, l.total_amount, displayMethod, payment),
                          isOverriding: overridingKeys.has(key),
                          isOverridden,
                        })}</TableCell>
                        <TableCell className="text-sm">{l.label}</TableCell>
                        <TableCell className="text-sm">{formatLectureCourses(l.courses)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatYen(l.total_amount)}</TableCell>
                        <TableCell className="text-center">{paymentStatusCell(payment)}</TableCell>
                        <TableCell className="text-center">
                          {actionCell(key, 'lecture', l.id, l.student?.name || '', l.total_amount, l.effective_payment_method, payment)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredLectures.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        {statusFilter !== 'all' || paymentMethodFilter !== 'all' ? '該当するデータがありません' : '該当月の講習請求データがありません'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 教材販売 */}
          <h3 className="text-lg font-semibold">教材販売</h3>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>塾生番号</TableHead>
                    <TableHead>生徒名</TableHead>
                    <TableHead className="text-center">支払方法</TableHead>
                    <TableHead>品名</TableHead>
                    <TableHead className="text-center">数量</TableHead>
                    <TableHead className="text-right">単価</TableHead>
                    <TableHead className="text-right">請求額</TableHead>
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
                      <TableRow key={m.id} className={confirmingKeys.has(key) ? 'opacity-60' : ''}>
                        <TableCell className="text-center">
                          {isUnpaid && <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{m.student?.student_number || '-'}</TableCell>
                        <TableCell className="font-medium">{m.student?.name}</TableCell>
                        <TableCell className="text-center">{paymentMethodBadge(displayMethod, {
                          onClick: () => handleTogglePaymentMethod(key, 'material', m.id, m.total_amount, displayMethod, payment),
                          isOverriding: overridingKeys.has(key),
                          isOverridden,
                        })}</TableCell>
                        <TableCell className="text-sm">{m.item_name}</TableCell>
                        <TableCell className="text-center">{m.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(m.unit_price)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatYen(m.total_amount)}</TableCell>
                        <TableCell className="text-center">{paymentStatusCell(payment)}</TableCell>
                        <TableCell className="text-center">
                          {actionCell(key, 'material', m.id, m.student?.name || '', m.total_amount, m.effective_payment_method, payment)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredMaterials.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {statusFilter !== 'all' || paymentMethodFilter !== 'all' ? '該当するデータがありません' : '該当月の教材販売データがありません'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight } from 'lucide-react'

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
}

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

interface StudentBillingViewProps {
  billing: BillingItem[]
  lectureBilling: LectureBillingItem[]
  materialBilling: MaterialBillingItem[]
  manualBilling: ManualBillingItem[]
  adjustmentBilling: AdjustmentItem[]
  payments: Payment[]
  formatYen: (n: number) => string
  onPaymentClick: (billingType: 'contract' | 'lecture' | 'material' | 'manual', refId: string, studentName: string, billedAmount: number, defaultMethod: string, existingPayment: Payment | null) => void
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getPayment(payments: Payment[], type: 'contract' | 'lecture' | 'material' | 'manual', refId: string): Payment | null {
  switch (type) {
    case 'contract': return payments.find(p => p.contract_id === refId) ?? null
    case 'lecture': return payments.find(p => p.lecture_id === refId) ?? null
    case 'material': return payments.find(p => p.material_sale_id === refId) ?? null
    case 'manual': return payments.find(p => p.manual_billing_id === refId) ?? null
  }
}

interface StudentGroup {
  studentId: string
  studentName: string
  studentNumber: string | null
  contracts: BillingItem[]
  lectures: LectureBillingItem[]
  materials: MaterialBillingItem[]
  manuals: ManualBillingItem[]
  adjustments: AdjustmentItem[]
  contractTotal: number
  lectureTotal: number
  materialTotal: number
  manualTotal: number
  adjustmentTotal: number
  grandTotal: number
  paymentStatus: '入金済み' | '未入金あり' | '過不足あり'
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StudentBillingView({
  billing,
  lectureBilling,
  materialBilling,
  manualBilling,
  adjustmentBilling,
  payments,
  formatYen,
  onPaymentClick,
}: StudentBillingViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const studentGroups = useMemo(() => {
    const map = new Map<string, StudentGroup>()

    const ensure = (studentId: string, name: string, studentNumber: string | null): StudentGroup => {
      if (!map.has(studentId)) {
        map.set(studentId, {
          studentId,
          studentName: name,
          studentNumber,
          contracts: [],
          lectures: [],
          materials: [],
          manuals: [],
          adjustments: [],
          contractTotal: 0,
          lectureTotal: 0,
          materialTotal: 0,
          manualTotal: 0,
          adjustmentTotal: 0,
          grandTotal: 0,
          paymentStatus: '入金済み',
        })
      }
      return map.get(studentId)!
    }

    for (const b of billing) {
      const g = ensure(b.student.id, b.student.name, b.student.student_number)
      g.contracts.push(b)
      g.contractTotal += b.total_amount
    }
    for (const l of lectureBilling) {
      const g = ensure(l.student.id, l.student.name, l.student.student_number)
      g.lectures.push(l)
      g.lectureTotal += l.total_amount
    }
    for (const m of materialBilling) {
      const g = ensure(m.student.id, m.student.name, m.student.student_number)
      g.materials.push(m)
      g.materialTotal += m.total_amount
    }
    for (const mb of manualBilling) {
      const g = ensure(mb.student.id, mb.student.name, mb.student.student_number)
      g.manuals.push(mb)
      g.manualTotal += mb.amount
    }
    for (const a of adjustmentBilling) {
      const g = ensure(a.student.id, a.student.name, a.student.student_number)
      g.adjustments.push(a)
      g.adjustmentTotal += a.amount
    }

    // Compute grand total and payment status
    for (const g of map.values()) {
      g.grandTotal = g.contractTotal + g.lectureTotal + g.materialTotal + g.manualTotal + g.adjustmentTotal

      // Determine payment status from all billable items
      let hasDiscrepancy = false
      let hasUnpaid = false
      let hasBillableItems = false

      const checkPayment = (type: 'contract' | 'lecture' | 'material' | 'manual', refId: string) => {
        hasBillableItems = true
        const pmt = getPayment(payments, type, refId)
        if (!pmt || pmt.status === '未入金') hasUnpaid = true
        else if (pmt.status === '過不足あり') hasDiscrepancy = true
      }

      g.contracts.forEach(c => checkPayment('contract', c.id))
      g.lectures.forEach(l => checkPayment('lecture', l.id))
      g.materials.forEach(m => checkPayment('material', m.id))
      g.manuals.forEach(m => checkPayment('manual', m.id))

      if (!hasBillableItems) g.paymentStatus = '入金済み'
      else if (hasDiscrepancy) g.paymentStatus = '過不足あり'
      else if (hasUnpaid) g.paymentStatus = '未入金あり'
      else g.paymentStatus = '入金済み'
    }

    // Sort by student_number (numeric)
    return Array.from(map.values()).sort((a, b) => {
      const na = a.studentNumber ? parseInt(a.studentNumber, 10) : Infinity
      const nb = b.studentNumber ? parseInt(b.studentNumber, 10) : Infinity
      return na - nb
    })
  }, [billing, lectureBilling, materialBilling, manualBilling, adjustmentBilling, payments])

  const statusBadge = (status: string) => {
    switch (status) {
      case '入金済み':
        return <Badge className="bg-green-100 text-green-800 border-green-200">入金済み</Badge>
      case '未入金あり':
        return <Badge className="bg-red-100 text-red-800 border-red-200">未入金あり</Badge>
      case '過不足あり':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">過不足あり</Badge>
      default:
        return null
    }
  }

  const amountOrDash = (n: number) => (n === 0 ? '-' : formatYen(n))

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className="w-20">塾生番号</TableHead>
            <TableHead>生徒名</TableHead>
            <TableHead className="text-right">通常コース</TableHead>
            <TableHead className="text-right">講習</TableHead>
            <TableHead className="text-right">教材</TableHead>
            <TableHead className="text-right">個別請求</TableHead>
            <TableHead className="text-right">調整</TableHead>
            <TableHead className="text-right">合計請求額</TableHead>
            <TableHead className="text-center">入金状況</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {studentGroups.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                請求データがありません
              </TableCell>
            </TableRow>
          )}
          {studentGroups.map(g => {
            const isExpanded = expandedIds.has(g.studentId)
            return (
              <StudentRow
                key={g.studentId}
                group={g}
                isExpanded={isExpanded}
                onToggle={() => toggle(g.studentId)}
                statusBadge={statusBadge}
                amountOrDash={amountOrDash}
                formatYen={formatYen}
                payments={payments}
                onPaymentClick={onPaymentClick}
              />
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Student Row                                                        */
/* ------------------------------------------------------------------ */

function StudentRow({
  group: g,
  isExpanded,
  onToggle,
  statusBadge,
  amountOrDash,
  formatYen,
  payments,
  onPaymentClick,
}: {
  group: StudentGroup
  isExpanded: boolean
  onToggle: () => void
  statusBadge: (s: string) => React.ReactNode
  amountOrDash: (n: number) => string
  formatYen: (n: number) => string
  payments: Payment[]
  onPaymentClick: StudentBillingViewProps['onPaymentClick']
}) {
  return (
    <>
      {/* Summary row */}
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell className="px-2">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-mono text-sm">{g.studentNumber ?? '-'}</TableCell>
        <TableCell className="font-medium">{g.studentName}</TableCell>
        <TableCell className="text-right">{amountOrDash(g.contractTotal)}</TableCell>
        <TableCell className="text-right">{amountOrDash(g.lectureTotal)}</TableCell>
        <TableCell className="text-right">{amountOrDash(g.materialTotal)}</TableCell>
        <TableCell className="text-right">{amountOrDash(g.manualTotal)}</TableCell>
        <TableCell className="text-right">{amountOrDash(g.adjustmentTotal)}</TableCell>
        <TableCell className="text-right font-bold">{formatYen(g.grandTotal)}</TableCell>
        <TableCell className="text-center">{statusBadge(g.paymentStatus)}</TableCell>
      </TableRow>

      {/* Detail rows */}
      {isExpanded && (
        <>
          {g.contracts.map(c => {
            const pmt = getPayment(payments, 'contract', c.id)
            return (
              <TableRow
                key={`c-${c.id}`}
                className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                onClick={() => onPaymentClick('contract', c.id, g.studentName, c.total_amount, c.effective_payment_method, pmt)}
              >
                <TableCell />
                <TableCell />
                <TableCell className="pl-8 text-sm text-muted-foreground">
                  通常コース ({c.courses.map(co => co.course).join(', ')})
                </TableCell>
                <TableCell className="text-right text-sm">{formatYen(c.total_amount)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-center">{paymentStatusBadge(pmt)}</TableCell>
              </TableRow>
            )
          })}
          {g.lectures.map(l => {
            const pmt = getPayment(payments, 'lecture', l.id)
            return (
              <TableRow
                key={`l-${l.id}`}
                className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                onClick={() => onPaymentClick('lecture', l.id, g.studentName, l.total_amount, l.effective_payment_method, pmt)}
              >
                <TableCell />
                <TableCell />
                <TableCell className="pl-8 text-sm text-muted-foreground">
                  {l.label}
                </TableCell>
                <TableCell />
                <TableCell className="text-right text-sm">{formatYen(l.total_amount)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-center">{paymentStatusBadge(pmt)}</TableCell>
              </TableRow>
            )
          })}
          {g.materials.map(m => {
            const pmt = getPayment(payments, 'material', m.id)
            return (
              <TableRow
                key={`m-${m.id}`}
                className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                onClick={() => onPaymentClick('material', m.id, g.studentName, m.total_amount, m.effective_payment_method, pmt)}
              >
                <TableCell />
                <TableCell />
                <TableCell className="pl-8 text-sm text-muted-foreground">
                  教材: {m.item_name} x{m.quantity}
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right text-sm">{formatYen(m.total_amount)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-center">{paymentStatusBadge(pmt)}</TableCell>
              </TableRow>
            )
          })}
          {g.manuals.map(mb => {
            const pmt = getPayment(payments, 'manual', mb.id)
            return (
              <TableRow
                key={`mb-${mb.id}`}
                className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                onClick={() => onPaymentClick('manual', mb.id, g.studentName, mb.amount, mb.effective_payment_method, pmt)}
              >
                <TableCell />
                <TableCell />
                <TableCell className="pl-8 text-sm text-muted-foreground">
                  {mb.description}
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-right text-sm">{formatYen(mb.amount)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-center">{paymentStatusBadge(pmt)}</TableCell>
              </TableRow>
            )
          })}
          {g.adjustments.map(a => (
            <TableRow key={`a-${a.id}`} className="bg-muted/30">
              <TableCell />
              <TableCell />
              <TableCell className="pl-8 text-sm text-muted-foreground">
                調整: {a.reason}{a.linked_label ? ` (${a.linked_label})` : ''}
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell className="text-right text-sm">{a.amount >= 0 ? '+' : ''}{formatYen(a.amount)}</TableCell>
              <TableCell />
              <TableCell className="text-center text-xs text-muted-foreground">{a.status}</TableCell>
            </TableRow>
          ))}
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Small badge for individual payment status                          */
/* ------------------------------------------------------------------ */

function paymentStatusBadge(pmt: Payment | null) {
  if (!pmt || pmt.status === '未入金') {
    return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">未入金</Badge>
  }
  if (pmt.status === '過不足あり') {
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">過不足あり</Badge>
  }
  return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">入金済み</Badge>
}

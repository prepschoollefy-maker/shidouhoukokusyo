'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { calculateAll, calculateKeizoku, type ContractCalcResult, type KeizokuCalcResult } from '@/lib/contracts/contract-calc'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useDashboardAuth } from '@/hooks/use-dashboard-auth'
import { Lock } from 'lucide-react'

interface Contract {
  id: string
  contract_no: string
  type: 'initial' | 'renewal'
  start_date: string
  end_date: string
  grade: string
  courses: { course: string; lessons: number }[]
  monthly_amount: number
  enrollment_fee: number
  campaign_discount: number
  campaign: string
  staff_name: string
  notes: string
  prev_contract_id: string | null
  student: { id: string; name: string; student_number: string | null }
}

const fmt = (n: number) => Math.floor(n).toLocaleString()

export default function ContractPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [contract, setContract] = useState<Contract | null>(null)
  const [prevContract, setPrevContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const sheetsRef = useRef<HTMLDivElement>(null)

  const { authenticated, password, setPassword, storedPw, verifying, initializing, handleAuth: authHandler } = useDashboardAuth()
  const handleAuth = () => authHandler(`/api/contracts/${id}`)

  const fetchContract = useCallback(async () => {
    const res = await fetch(`/api/contracts/${id}?pw=${encodeURIComponent(storedPw)}`)
    if (!res.ok) { setError('契約データの取得に失敗しました'); setLoading(false); return }
    const json = await res.json()
    const c = json.data as Contract
    setContract(c)
    if (c.prev_contract_id) {
      const prevRes = await fetch(`/api/contracts/${c.prev_contract_id}?pw=${encodeURIComponent(storedPw)}`)
      if (prevRes.ok) {
        const prevJson = await prevRes.json()
        setPrevContract(prevJson.data as Contract)
      }
    }
    setLoading(false)
  }, [id, storedPw])

  useEffect(() => {
    if (!authenticated || initializing) return
    fetchContract()
  }, [authenticated, initializing, fetchContract])

  // A3自動縮小
  useEffect(() => {
    if (!contract) return
    const fitPages = () => {
      const MAX_H = 394 * 3.7795
      document.querySelectorAll<HTMLElement>('.sheet-inner').forEach(inner => {
        inner.style.transform = ''
        inner.style.width = ''
        const h = inner.scrollHeight
        if (h > MAX_H) {
          const s = MAX_H / h
          inner.style.transform = `scale(${s.toFixed(4)})`
          inner.style.transformOrigin = 'top left'
          inner.style.width = `${(100 / s).toFixed(2)}%`
        }
      })
    }
    const t = setTimeout(fitPages, 100)
    window.addEventListener('beforeprint', fitPages)
    return () => { clearTimeout(t); window.removeEventListener('beforeprint', fitPages) }
  }, [contract])

  if (initializing) return <LoadingSpinner />
  if (!authenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ background: '#fff', padding: '2rem', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <Lock style={{ width: 32, height: 32, color: '#999', margin: '0 auto 8px' }} />
          <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>契約書印刷</h2>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAuth() }}
            placeholder="パスワード" autoFocus style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: '1rem', marginBottom: 12 }} />
          <button onClick={handleAuth} disabled={verifying} style={{ width: '100%', padding: '10px', background: '#2980b9', color: '#fff', border: 'none', borderRadius: 6, fontSize: '1rem', cursor: 'pointer' }}>
            {verifying ? '確認中...' : 'ログイン'}
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <LoadingSpinner />
  if (error || !contract) return <div style={{ padding: 40, textAlign: 'center', color: '#c00' }}>{error || 'データが見つかりません'}</div>

  const isRenewal = contract.type === 'renewal'

  if (isRenewal && prevContract) {
    return <RenewalPrint contract={contract} prevContract={prevContract} />
  }
  return <InitialPrint contract={contract} />
}

/* ================================================================== */
/*  新規入塾契約書                                                      */
/* ================================================================== */
function InitialPrint({ contract }: { contract: Contract }) {
  const calc = calculateAll(contract.grade, contract.start_date, contract.end_date, contract.courses, contract.campaign || '')

  return (
    <>
      <PrintStyles />
      <div className="contract-page">
        <ActionBar />
        <FrontPage contract={contract} calc={calc} />
        <BackPage title="入塾契約書　約款" />
      </div>
    </>
  )
}

/* ================================================================== */
/*  継続契約書                                                          */
/* ================================================================== */
function RenewalPrint({ contract, prevContract }: { contract: Contract; prevContract: Contract }) {
  const calc = calculateKeizoku(
    prevContract.grade, contract.grade,
    prevContract.start_date, contract.start_date, contract.end_date,
    prevContract.courses, contract.courses,
  )

  return (
    <>
      <PrintStyles />
      <div className="contract-page">
        <ActionBar />
        <RenewalFrontPage contract={contract} prevContract={prevContract} calc={calc} />
        <BackPage title="継続契約書　約款" />
      </div>
    </>
  )
}

/* ================================================================== */
/*  表面（新規）                                                        */
/* ================================================================== */
function FrontPage({ contract, calc }: { contract: Contract; calc: ContractCalcResult }) {
  const emptyInitialRows = Math.max(0, 4 - calc.initial_rows.length)
  const emptyRegularRows = Math.max(0, 2 - calc.regular_rows.length)

  return (
    <div className="contract-sheet page-front">
      <div className="sheet-inner">
        <div className="contract-header">
          <div><span className="header-notice red-box">表面及び裏面の内容を十分にお読みください。</span></div>
          <div>
            <table className="header-info"><tbody><tr><th>契約書No.</th><td>{contract.contract_no}</td></tr></tbody></table>
          </div>
        </div>
        <div className="header-row2">
          <span>塾生No.　{contract.student?.student_number}　　生徒名　{contract.student?.name}</span>
          <span>作成日　{calc.入塾日.slice(0, 5)}年　　　月　　　日</span>
        </div>

        <h1 className="contract-title">入塾契約書</h1>

        <p className="preamble">
          私（下欄に記載の「契約者」）は、本契約書の表面及び裏面の契約内容を了承のうえ、本日、株式会社レフィー（以下「レフィー」）に対して表記塾生の受講の申込みを行い、レフィーはこれを承諾しました。<br />
          また、契約者は、本日、本契約書の控えを受領いたしました。
        </p>

        <div className="contract-period">
          <strong>契約期間</strong>　　{calc.入塾日}　～　{calc.退塾日}
        </div>

        <StudentInfoSection />

        <h2 className="section-title">&#9632; コース・月謝</h2>
        <p className="note-small">
          ※各コース名称は右記のとおり略称で表記します。【ハイ⇒ハイスタンダード、ハイP⇒ハイスタンダードPLUS、エク⇒エクセレンス、エグ⇒エグゼクティブ】<br />
          ※以下に記載の税込み価格は、すべて消費税10％で計算しています。
        </p>

        <div className="tuition-columns">
          <div className="tuition-col">
            <table className="tuition-table">
              <thead>
                <tr><th colSpan={5} className="tuition-header">{calc.初回月謝ラベル}</th></tr>
                <tr className="tuition-period"><td colSpan={5}>{calc.入塾日} ～ {calc.翌月末}</td></tr>
                <tr><th>コース・講座名</th><th>学年</th><th>授業時間</th><th>授業数</th><th>授業料</th></tr>
              </thead>
              <tbody>
                {calc.initial_rows.map((r, i) => (
                  <tr key={i}><td>{r.label}</td><td>{r.grade}</td><td>{r.duration}</td><td>{r.frequency}</td><td className="num">{fmt(r.amount)}</td></tr>
                ))}
                {Array.from({ length: emptyInitialRows }).map((_, i) => (
                  <tr key={`e${i}`}><td></td><td></td><td></td><td></td><td></td></tr>
                ))}
                <tr className="subtotal-row"><td colSpan={4}>授業料合計</td><td className="num">{fmt(calc.g26)}</td></tr>
                <tr><td colSpan={3}>設備利用料</td><td className="note-in-cell">{calc.equip_desc}</td><td className="num">{fmt(calc.g27)}</td></tr>
                <tr className="discount-row"><td colSpan={4}>複数コマ受講割引</td><td className="num">{calc.g28 > 0 ? `-${fmt(calc.g28)}` : '0'}</td></tr>
                <tr className="subtotal-row"><td colSpan={4}>合計（税抜）</td><td className="num">{fmt(calc.g29)}</td></tr>
                <tr className="total-row"><td colSpan={4}>合計（税込）</td><td className="num"><strong>{fmt(calc.g30)}</strong></td></tr>
              </tbody>
            </table>
          </div>
          <div className="tuition-col">
            <table className="tuition-table">
              <thead>
                <tr><th colSpan={5} className="tuition-header">定額月謝</th></tr>
                <tr className="tuition-period"><td colSpan={5}>{calc.翌月初} ～ {calc.退塾日}</td></tr>
                <tr><th>コース・講座名</th><th>学年</th><th>授業時間</th><th>授業数</th><th>授業料</th></tr>
              </thead>
              <tbody>
                {calc.regular_rows.map((r, i) => (
                  <tr key={i}><td>{r.label}</td><td>{r.grade}</td><td>{r.duration}</td><td>{r.frequency}</td><td className="num">{fmt(r.amount)}</td></tr>
                ))}
                {Array.from({ length: emptyRegularRows }).map((_, i) => (
                  <tr key={`e${i}`}><td></td><td></td><td></td><td></td><td></td></tr>
                ))}
                <tr className="subtotal-row"><td colSpan={4}>授業料合計</td><td className="num">{fmt(calc.m26)}</td></tr>
                <tr><td colSpan={4}>設備利用料</td><td className="num">{fmt(calc.m27)}</td></tr>
                <tr className="discount-row"><td colSpan={4}>複数コマ受講割引</td><td className="num">{calc.m28 > 0 ? `-${fmt(calc.m28)}` : '0'}</td></tr>
                <tr className="subtotal-row"><td colSpan={4}>合計（税抜）</td><td className="num">{fmt(calc.m29)}</td></tr>
                <tr className="total-row"><td colSpan={4}>合計（税込）</td><td className="num"><strong>{fmt(calc.m30)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <PaymentSection calc={calc} />
        <BankSection />

        <h2 className="section-title">&#9632; 特記事項</h2>
        <div className="notes-box">{contract.notes || ''}</div>

        <ConfirmSection />
        <SignatureSection staffName={contract.staff_name} />
        <LegalSections />
      </div>
    </div>
  )
}

/* ================================================================== */
/*  表面（継続）                                                        */
/* ================================================================== */
function RenewalFrontPage({ contract, prevContract, calc }: { contract: Contract; prevContract: Contract; calc: KeizokuCalcResult }) {
  const emptyBeforeRows = Math.max(0, 3 - calc.before.rows.length)
  const emptyAfterRows = Math.max(0, 3 - calc.after.rows.length)

  return (
    <div className="contract-sheet page-front">
      <div className="sheet-inner">
        <div className="contract-header">
          <div><span className="header-notice red-box">表面及び裏面の内容を十分にお読みください。</span></div>
          <div>
            <table className="header-info"><tbody>
              <tr><th>前契約書No.</th><td>{prevContract.contract_no}</td></tr>
              <tr><th>契約書No.</th><td>{contract.contract_no}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div className="header-row2">
          <span>塾生No.　{contract.student?.student_number}　　生徒名　{contract.student?.name}</span>
          <span>作成日　{calc.継続日.slice(0, 5)}年　　　月　　　日</span>
        </div>

        <h1 className="contract-title">継続契約書</h1>

        <p className="preamble">
          私（下欄に記載の「契約者」）は、本契約書の表面及び裏面の契約内容を了承のうえ、本日、株式会社レフィー（以下「レフィー」）に対して表記塾生の受講契約の継続を申し込み、レフィーはこれを承諾しました。<br />
          また、契約者は、本日、本契約書の控えを受領いたしました。
        </p>

        <div className="contract-period">
          <strong>契約期間</strong>　　{calc.前契約開始日}　～　{calc.退塾日}
          <span style={{ marginLeft: 16, fontSize: '9pt' }}>継続日：{calc.継続日}</span>
          <span style={{ marginLeft: 16, fontSize: '9pt', color: '#555' }}>（前契約終了日：{calc.前契約終了日}）</span>
        </div>

        <StudentInfoSection isRenewal />

        <h2 className="section-title">&#9632; コース・月謝</h2>
        <p className="note-small">
          ※各コース名称は右記のとおり略称で表記します。【ハイ⇒ハイスタンダード、ハイP⇒ハイスタンダードPLUS、エク⇒エクセレンス、エグ⇒エグゼクティブ】<br />
          ※以下に記載の税込み価格は、すべて消費税10％で計算しています。
        </p>

        <div className="tuition-columns">
          <div className="tuition-col">
            <table className="tuition-table">
              <thead>
                <tr><th colSpan={5} className="tuition-header tuition-header-before">【継続前】定額月謝</th></tr>
                <tr className="tuition-period"><td colSpan={5}>{calc.before_period}</td></tr>
                <tr><th>コース・講座名</th><th>学年</th><th>授業時間</th><th>授業数</th><th>授業料</th></tr>
              </thead>
              <tbody>
                {calc.before.rows.map((r, i) => (
                  <tr key={i}><td>{r.label}</td><td>{r.grade}</td><td>{r.duration}</td><td>{r.frequency}</td><td className="num">{fmt(r.amount)}</td></tr>
                ))}
                {Array.from({ length: emptyBeforeRows }).map((_, i) => (
                  <tr key={`e${i}`}><td></td><td></td><td></td><td></td><td></td></tr>
                ))}
                <tr className="subtotal-row"><td colSpan={4}>授業料合計</td><td className="num">{fmt(calc.before.tuition_total)}</td></tr>
                <tr><td colSpan={4}>設備利用料</td><td className="num">{fmt(calc.before.facility)}</td></tr>
                <tr className="discount-row"><td colSpan={4}>複数コマ受講割引</td><td className="num">{calc.before.discount > 0 ? `-${fmt(calc.before.discount)}` : '0'}</td></tr>
                <tr className="subtotal-row"><td colSpan={4}>合計（税抜）</td><td className="num">{fmt(calc.before.total_ex_tax)}</td></tr>
                <tr className="total-row"><td colSpan={4}>合計（税込）</td><td className="num"><strong>{fmt(calc.before.total_inc_tax)}</strong></td></tr>
              </tbody>
            </table>
          </div>
          <div className="tuition-col">
            <table className="tuition-table">
              <thead>
                <tr><th colSpan={5} className="tuition-header tuition-header-after">【継続後】定額月謝</th></tr>
                <tr className="tuition-period"><td colSpan={5}>{calc.after_period}</td></tr>
                <tr><th>コース・講座名</th><th>学年</th><th>授業時間</th><th>授業数</th><th>授業料</th></tr>
              </thead>
              <tbody>
                {calc.after.rows.map((r, i) => (
                  <tr key={i}><td>{r.label}</td><td>{r.grade}</td><td>{r.duration}</td><td>{r.frequency}</td><td className="num">{fmt(r.amount)}</td></tr>
                ))}
                {Array.from({ length: emptyAfterRows }).map((_, i) => (
                  <tr key={`e${i}`}><td></td><td></td><td></td><td></td><td></td></tr>
                ))}
                <tr className="subtotal-row"><td colSpan={4}>授業料合計</td><td className="num">{fmt(calc.after.tuition_total)}</td></tr>
                <tr><td colSpan={4}>設備利用料</td><td className="num">{fmt(calc.after.facility)}</td></tr>
                <tr className="discount-row"><td colSpan={4}>複数コマ受講割引</td><td className="num">{calc.after.discount > 0 ? `-${fmt(calc.after.discount)}` : '0'}</td></tr>
                <tr className="subtotal-row"><td colSpan={4}>合計（税抜）</td><td className="num">{fmt(calc.after.total_ex_tax)}</td></tr>
                <tr className="total-row"><td colSpan={4}>合計（税込）</td><td className="num"><strong>{fmt(calc.after.total_inc_tax)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="section-title">&#9632; 口座振替（自動引き落とし）の月謝</h2>
        <table className="payment-table">
          <tbody>
            <tr>
              <th>定額月謝</th>
              <td className="num"><strong>{fmt(calc.regular_monthly)}</strong></td>
              <td className="handwrite-deadline">初回引き落とし日：{calc.transfer_date}（予定）</td>
            </tr>
          </tbody>
        </table>

        <BankSection />

        <h2 className="section-title">&#9632; 特記事項</h2>
        <div className="notes-box">{contract.notes || ''}</div>

        <ConfirmSection />
        <SignatureSection staffName={contract.staff_name} />
        <LegalSections />
      </div>
    </div>
  )
}

/* ================================================================== */
/*  共通セクション                                                      */
/* ================================================================== */

function ActionBar() {
  return (
    <div className="no-print action-bar">
      <button onClick={() => window.print()} className="btn-primary">印刷 / PDF保存</button>
      <button onClick={() => window.history.back()} className="btn-secondary">戻る</button>
    </div>
  )
}

function StudentInfoSection({ isRenewal }: { isRenewal?: boolean }) {
  return (
    <>
      <h2 className="section-title">&#9632; 塾生/契約者情報</h2>
      <table className="info-table">
        <tbody>
          <tr><th>フリガナ</th><td className="handwrite"></td><th>フリガナ</th><td className="handwrite"></td></tr>
          <tr><th>塾生（生徒）氏名</th><td className="handwrite"></td><th>契約者（保護者）氏名</th><td className="handwrite"></td></tr>
          <tr><th>在籍学校名</th><td className="handwrite"></td><th>学年</th><td className="handwrite">　　小　・　中　・　高　　　　　　年</td></tr>
          <tr>
            <th>住所</th>
            <td colSpan={3} className="handwrite">
              {isRenewal && <span className="nochange-check">□ 変更なし</span>}
              〒　　　　　　　-<br /><br />
            </td>
          </tr>
          <tr>
            <th>緊急連絡先<br /><span className="th-sub">（保護者様）</span></th>
            <td className="handwrite">
              {isRenewal && <span className="nochange-check">□ 変更なし</span>}<br />
              ご関係（　　　　　　　）<br />電話番号：<br />メール：
            </td>
            <th>塾生連絡先</th>
            <td className="handwrite">
              {isRenewal && <span className="nochange-check">□ 変更なし</span>}<br />
              電話番号：<br />メール：
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function PaymentSection({ calc }: { calc: ContractCalcResult }) {
  return (
    <div className="payment-columns">
      <div className="payment-col">
        <h2 className="section-title">&#9632; 初回お振り込み金額</h2>
        <table className="payment-table">
          <tbody>
            <tr>
              <th>入塾金</th>
              <td className="num">{fmt(calc.enrollment_fee)}</td>
              <td rowSpan={3} className="handwrite-deadline">お振込締切日<br /><br />　　　　年　　月　　日</td>
            </tr>
            <tr><th>初回月謝</th><td className="num">{fmt(calc.first_tuition)}</td></tr>
            <tr className="total-row"><th>合計</th><td className="num"><strong>{fmt(calc.first_total)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div className="payment-col">
        <h2 className="section-title">&#9632; ２回目お振り込み金額</h2>
        <table className="payment-table">
          <tbody>
            <tr>
              <th>定額月謝<br /><span className="th-sub">（　　月分）</span></th>
              <td className="num"><strong>{fmt(calc.regular_monthly)}</strong></td>
              <td className="handwrite-deadline">お振込締切日<br /><br />　　　　年　　月　　日</td>
            </tr>
          </tbody>
        </table>
        <h2 className="section-title">&#9632; 口座振替（自動引き落とし）の月謝</h2>
        <table className="payment-table">
          <tbody>
            <tr>
              <th>定額月謝</th>
              <td className="num"><strong>{fmt(calc.regular_monthly)}</strong></td>
              <td className="handwrite-deadline">　　　年　　月分以降の月謝（予定）</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BankSection() {
  return (
    <>
      <h2 className="section-title">&#9632; お振り込み先口座</h2>
      <table className="bank-table">
        <tbody>
          <tr>
            <th>金融機関・支店名</th><td>横浜信用金庫　横浜西口支店（金融機関コード：1280、支店コード: 023）</td>
            <th>口座番号</th><td>(普)0601013</td>
            <th>口座名義</th><td>株式会社レフィー</td>
          </tr>
        </tbody>
      </table>
      <p className="note-small">※振込人名義は、必ず生徒No.とご契約者（保護者）様氏名をご入力ください。　例：1234567ｺﾍﾞﾂﾀﾛｳ</p>
    </>
  )
}

function ConfirmSection() {
  return (
    <>
      <h2 className="section-title">&#9632; 契約者（保護者）様ご記入欄</h2>
      <table className="confirm-table">
        <tbody>
          <tr>
            <th rowSpan={2}>ご確認<br />事項</th>
            <td>&#9312; 裏面約款はご確認いただけましたか<br /><span className="checkbox-line">&#9633; はい</span></td>
            <td>&#9313; 納入金および納入スケジュールはご確認いただけましたか<br /><span className="checkbox-line">&#9633; はい</span></td>
          </tr>
          <tr>
            <td>&#9314; 別紙記載の「個人情報の取り扱いについて」に記載されている内容について<br /><span className="checkbox-line">&#9633; 同意する</span></td>
            <td>&#9315; 受講のご案内をご確認いただけましたか<br /><span className="checkbox-line">&#9633; はい</span></td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function SignatureSection({ staffName }: { staffName: string }) {
  return (
    <>
      <div className="signature-section">
        <p><strong>ご署名欄</strong>　本契約を締結し、本契約書（表面及び裏面）の控えを確かに受け取りました。</p>
        <table className="signature-table">
          <tbody>
            <tr>
              <th>ご署名日</th><td className="handwrite">　　　　年　　　月　　　日</td>
              <th>契約者（保護者）氏名</th><td className="handwrite"></td><td className="seal">印</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="company-section">
        <div className="company-info">
          <p><strong>株式会社 レフィー</strong></p>
          <p>代表取締役：山本博之</p>
          <p>神奈川県横浜市神奈川区鶴屋町三丁目33-7 横浜OSビル 201　電話番号：045-620-9150</p>
        </div>
        <div className="staff-info">
          <table className="signature-table">
            <tbody>
              <tr><th>契約担当者</th><td className="handwrite">{staffName}</td><td className="seal">印</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function LegalSections() {
  return (
    <>
      <div className="legal-section">
        <p><strong>【直接交渉の禁止】</strong></p>
        <p className="small-text">レフィーの塾生及びその保護者は、契約期間中や契約期間終了後であっても、レフィーが派遣または雇用している講師及びその紹介により知り得た講師から、レフィーの承諾なしに指導を受けること、指導の契約をすることはできないものとします。（直接交渉の損害賠償金） レフィーの塾生及びその保護者が、レフィーの承諾なく前項に違反または違反しようとした場合、損失相当分をお支払いいただく場合がございます。</p>
      </div>
      <div className="cooling-off-section">
        <p className="cooling-off-title">【クーリング・オフに関しまして】</p>
        <div className="cooling-off-body">
          <p>契約書面を受領した日から起算して8日を経過するまでは、書面または電磁的記録により無条件に契約の解除ができます。既にお支払いいただいている費用、授業料は、以下に記す期日に塾生および契約者が指定した銀行口座へ銀行振込にて返金いたします。１：［1~15日に受付］受付した月の月末に返金いたします。２：［16~末日に受付］受付した月の翌月の15日に返金いたします。（＊15日、末日が銀行休業日の場合は、翌銀行営業日に返金いたします。）</p>
          <p>1.クーリング・オフの効カはクーリング・オフを通知する書面または電磁的記録を弊社に発した時から生じます。<br />
          2.クーリング・オフ受付後は、損害賠償または違約金を支払う必要はありません。<br />
          3.クーリング・オフとなった場合、既に指導が開始されていたとしても授業料やその他の支払いをする必要はありません。<br />
          4.弊社がクーリング・オフ、解約に関する事項につき不実のことを告げ、誤認や威圧したことにより困感したことで、クーリング・オフを行わなかった場合には、当該契約の申込撤回又は解除を行うことができる旨を記載して交付した書面を受領した日から起算して8日を経過するまでは、書面または電磁的記録により当該契約のクーリング・オフをすることができます。<br />
          5.クーリング・オフとなった場合、関連商品についても契約の解除ができます。<br />
          6.効力は、クーリング・オフを弊社に通知する書面または電磁的記録を発した時より生じ、クーリング・オフにより、損害賠償または違約金を支払う必要はありません。<br />
          7.また、関連商品の引き取りに要する費用は弊社が負担いたします。<br />
          尚、既に金銭の受領があった場合は、適やかに全額を返金いたします。</p>
        </div>
      </div>
    </>
  )
}

/* ================================================================== */
/*  裏面（約款）                                                        */
/* ================================================================== */
function BackPage({ title }: { title: string }) {
  return (
    <div className="contract-sheet page-back">
      <div className="sheet-inner">
        <h1 className="contract-title">{title}</h1>
        <div className="terms-columns">
          <div className="terms-col">
            <TermArticle n={1} title="指導の目的" paragraphs={['本契約は、レフィーが定める各コースの条件を満たした講師による塾生への学習指導及びそれに付随する以下のサービスの提供を目的とします。塾生への役務は、学習指導及びそれに付随するサービスに限ります。','レフィーは塾生の成績向上のため努力しますが、直ちに成績向上等をお約束するものではありません。また、学習以外の事項、授業を受講する教室までの行き来に起きた事故に関して、一切の責任を負いかねます。']} />
            <TermArticle n={2} title="入塾金（入塾時にお支払いいただく費用）" paragraphs={['入塾手続きは、契約者が契約締結日から3日以内に入塾金を支払うことにより完了するものとします。振込手数料はご契約者様にご負担いただきます。なお、入塾金は今後授業を行う上で必要な資料作成・データの入力などのための費用です。']} />
            <TermArticle n={3} title="月謝" paragraphs={['月謝は表面記載のとおりとします。契約期間中であっても、レフィーは法令の改廃、経済情勢の変動、租税公課の増減により、授業料等を改定することができます。','<strong>a.初回月謝（ご入塾月とその翌月の2ヶ月間の月謝）</strong><br/>初回月謝は、契約締結日から3日以内に、弊社指定の銀行口座にご入金いただきます。振込手数料はご契約者様にご負担いただきます。','<strong>b.定額月謝</strong><br/>ご入塾月から起算して3カ月目の定額月謝は、表面記載のとおり、20日から27日（金融機関休業日の場合は翌営業日）に、翌月分の定額月謝を弊社指定の銀行口座にご入金いただきます。振込手数料はご契約者様にご負担いただきます。','ご入塾月から起算して4カ月目以降の定額月謝は、毎月27日（金融機関休業日の場合は翌営業日）に、翌月分の定額月謝を預金口座振替依頼書にご記入いただいた口座より引き落としさせていただきます。口座振替ができるのは、「口座振替のご案内」記載の金融機関のみとします。','授業終了時点で既にお支払いいただいている月謝が、実際の授業回数に基づき計算された月謝に満たない場合、その不足額を追加請求させていだきます。また、通常授業の契約期間満了時点における未実施分の月謝は、返金いたしかねます。']} />
            <TermArticle n={4} title="振替授業" paragraphs={['振替授業を希望する場合、授業予定日の１営業日前の18時までにお申し出ください。前日の18時を過ぎた場合は、予定どおり授業を実施することとし、振替はできかねます。ただし、振替授業は、契約期間内において翌々月まで繰越しすることができます。尚、ブースの空き状況や講師のスケジュールによって振替希望が充たされない場合があります。','災害等緊急事象を理由とした休講の場合、振替はできません。']} />
            <TermArticle n={5} title="契約期間" paragraphs={['契約期間は、表面記載のとおりとします。']} />
            <TermArticle n={6} title="一部契約変更、休止" paragraphs={['塾生および契約者が本契約の内容（コース、授業時間、科目）を一部変更、または休止する場合は、変更、休止を希望する月の1ヶ月以上前に申し出るものとします。契約期間中、2ヶ月を超えて授業を休止する場合は、入院等特別な事由がない限り、解約の手続きを行うものとします。この場合、休止開始から3ヶ月目時点で中途解約を受け付けたものとみなし、塾生規約「7.中途解約(授業開始後)を適用させていただきます。']} />
            <TermArticle n={7} title="中途解約" paragraphs={['塾生および契約者はクーリング・オフ期間経過後も、下記の（授業開始前）、（授業開始後）の区分に従い、いつでも契約を解除することができます。','<strong>（授業開始前）</strong>塾生登録、計画立案、講師決定の対価として、以下のとおり、お支払いいただきます。（１）学習塾の（当塾で授業を受ける）場合、1万1千円をお支払いいただきます。','<strong>（授業開始後）</strong>下記a及びbの合計額をお支払いいただきます。a. 中途解約時点で既にお支払いいただいている授業料が実際の授業回数に基づき計算された授業料に満たない場合、その不足額　b. 中途解約時点の定額月謝か以下のうち、いずれか低い額（違約金）（１）学習塾の（当塾で授業を受ける）場合、2万円をお支払いいただきます。','尚、上記a及びbの合計額をお支払いの上、うちbの金額を中途解約受付月の翌月の月謝に充当し、翌月末日まで授業を受けていただくことができます。尚、違約金を月謝に充当して授業が行われなかった場合においてもご返金いたしかねます。授業開始後は、お支払いいただいた入塾金、及び実施分の授業料については返金いたしかねます。中途解約時点における未実施分の授業については、塾生および契約者にご確認の上、振替授業またはご返金いたします。']} />
            <TermArticle n={8} title="月謝未納に対する措置" paragraphs={['塾生および契約者が本来の支払期日である27日を超えて、翌月の5日までに定額月謝が未納の場合、レフィーは一旦授業を中断し、入金確認後、授業を再開することができるものとします。']} />
            <TermArticle n={9} title="講師の決定および交代について" paragraphs={['<strong>［講師の決定］</strong>レフィーは塾生の要望に基づき、講師を決定するものとします。','<strong>［講師の交代］</strong>塾生は、担当講師の交代を要求し、契約期間中に最大３回まで、講師を変更できるものとします。なお、講師の交代に際して別途の費用などは生じません。','<strong>［レフィーからの交代依頼］</strong>講師の事情でやむを得ない場合、塾生に対して、講師の交代、もしくは、一時的に別講師の授業を受講いただくことなどを相談することがあります。']} />
          </div>
          <div className="terms-col">
            <TermArticle n={10} title="損害賠償" paragraphs={['当塾の施設内で発生した事故について法律上の損害賠償責任を負うべき場合は相応の賠償を行います。ただし当塾の管理下にない間に発生した事故、当塾内において発生した盗難及び紛失については一切損害賠償の責任は負いません。']} />
            <TermArticle n={11} title="契約の解除" paragraphs={['レフィーは、塾生について次の各号のいずれかに該当する事由が生じたときは、何らの催告を要せず、直ちに、本契約の全部又は一部を解除することができます。','（１）塾生の素行に著しく問題がある場合。（２）欠席が多く、塾生の学習意欲が低い場合。（３）他の塾生の学習を阻害する言動を注意しても、改めない場合。（４）教室の業務を著しく妨げるような言動を塾生が繰り返した場合。（５）法律に違反する行為が塾生にあった場合。']} />
            <TermArticle n={12} title="レフィーへの報告のお願い" paragraphs={['塾生は、授業の成果の確認、今後の指導方法の改善、学習計画の立案のため、必要に応じて学校の通知表やテストの結果および模試の結果をレフィーヘ報告するものとします。','塾生は、講師の勤務態度及び指導内容に疑義があるときは直ちにレフィーへ報告するものとします。']} />
            <TermArticle n={13} title="レフィーへの通知" paragraphs={['保護者または塾生の住所又は電話番号又はメールアドレスに変更等が生じたときは直ちにレフィーヘ通知するものとします。']} />
            <TermArticle n={14} title="緊急時対応" paragraphs={['<strong>臨時休校措置について</strong>自然災害、感染症の流行、凶悪犯罪の発生、その他の災害等緊急事象の発生またはその恐れにより、特別警報、警報、避難指示・勧告や緊急事態宣言等による要請・指示等がなされた地域・地区においては、塾生の身体生命等の安全確保のために休講を決定することがあります。ただし、このように災害等緊急事象を理由とした休講の場合、原則として振替授業は行いません。','<strong>塾生が教室にいるときに災害が発生した場合</strong>避難が必要とされる場合、指定避難所に塾生を引率のうえ、避難致します。災害等緊急事象発生時には、弊社公式ホームページにご連絡方法を掲載いたします。また、個別にメール・お電話にてご連絡いたします。','<strong>塾生が教室にいるときに急病・けがをされた場合</strong>保護者様ご指定の緊急連絡先にご連絡のうえ、お迎えをお願いしたり、状況に応じて最寄りの医療機関を受診いただいたりする場合があります。教室職員判断による医療行為（投薬など）はいたしかねますのでご了承ください。']} />
            <TermArticle n={15} title="補足" paragraphs={['レフィーでは、「抗弁権の接続」の対象となるローン提携販売、信用販売購入は行っておりません。また、前受金については、保全措置を行っておりません。']} />
            <TermArticle n={16} title="反社会的勢力の排除" paragraphs={['(1)契約者および塾生は、暴力団等反社会的勢力に属さず、関与していないこと、また、将来にわたり属さず、関与しないことを確約するものとします。(2)レフィーは、契約者および塾生が暴力団等反社会的勢力に属したり、関与したりしていると判明した場合、催告することなく、将来に向かって本契約を解除できるものとします。(3)前項の契約解除があった場合、レフィーはこれによる契約者および塾生の損害を賠償する責を負いません。']} />
            <TermArticle n={17} title="規約の変更等" paragraphs={['本規約の内容は予告なく変更、改定または廃止をする場合があります。']} />
            <TermArticle n={18} title="協議事項" paragraphs={['本塾生規約に定めのない事項及び本規約の条項のうち疑義が生じた場合については、契約者とレフィーが協議して取り決めるものとします。']} />
            <TermArticle n={19} title="その他" paragraphs={['本契約に関する紛争は、東京地方裁判所を専属的合意管轄裁判所とします。']} />
          </div>
        </div>
      </div>
    </div>
  )
}

function TermArticle({ n, title, paragraphs }: { n: number; title: string; paragraphs: string[] }) {
  return (
    <div className="term-article">
      <h3>{n}. {title}</h3>
      {paragraphs.map((p, i) => (
        <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
      ))}
    </div>
  )
}

/* ================================================================== */
/*  CSS                                                                */
/* ================================================================== */
function PrintStyles() {
  return (
    <style>{`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: "Yu Gothic","YuGothic","Hiragino Sans","Meiryo",sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
      .contract-page { background: #e0e0e0; }
      .action-bar { position: fixed; top: 0; left: 0; right: 0; background: #2c3e50; padding: 0.75rem 2rem; z-index: 100; text-align: center; }
      .btn-primary { background: linear-gradient(135deg,#2980b9,#1a5276); color: #fff; border: none; padding: 0.75rem 2rem; font-size: 1rem; border-radius: 4px; cursor: pointer; font-weight: bold; }
      .btn-secondary { display: inline-block; background: #95a5a6; color: #fff; border: none; padding: 0.75rem 2rem; font-size: 1rem; border-radius: 4px; cursor: pointer; text-decoration: none; margin-left: 1rem; }
      .contract-sheet { width: 297mm; height: 420mm; margin: 60px auto 20px; padding: 10mm 14mm; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 10.5pt; overflow: hidden; position: relative; }
      .sheet-inner { width: 100%; height: 100%; transform-origin: top left; }
      .contract-sheet + .contract-sheet { margin-top: 20px; }
      .contract-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1mm; }
      .header-notice { font-size: 9pt; }
      .red-box { color: #cc0000; border: 2px solid #cc0000; padding: 0.1rem 0.3rem; font-weight: bold; display: inline-block; }
      .header-info { border-collapse: collapse; font-size: 10pt; }
      .header-info th { text-align: left; padding: 0.1rem 0.3rem; font-weight: normal; white-space: nowrap; }
      .header-info td { padding: 0.1rem 0.3rem; border-bottom: 1px solid #999; min-width: 60px; }
      .header-row2 { display: flex; justify-content: space-between; font-size: 10pt; margin-bottom: 1mm; }
      .contract-title { text-align: center; font-size: 16pt; margin: 1mm 0; letter-spacing: 0.3em; }
      .preamble { font-size: 9pt; margin-bottom: 1mm; line-height: 1.4; }
      .contract-period { margin-bottom: 1mm; font-size: 10pt; }
      .section-title { font-size: 10pt; margin: 1.5mm 0 1mm; }
      .info-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 1.5mm; }
      .info-table th, .info-table td { border: 1px solid #333; padding: 1mm 1.5mm; vertical-align: top; }
      .info-table th { background: #f0f0f0; font-weight: bold; white-space: nowrap; width: 11%; font-size: 8.5pt; }
      .info-table .handwrite { min-height: 5mm; background: #fff; }
      .th-sub { font-weight: normal; font-size: 7.5pt; }
      .note-small { font-size: 7.5pt; color: #555; margin-bottom: 1mm; }
      .tuition-columns { display: flex; gap: 3mm; margin-bottom: 1.5mm; }
      .tuition-col { flex: 1; }
      .tuition-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
      .tuition-table th, .tuition-table td { border: 1px solid #333; padding: 0.5mm 1mm; }
      .tuition-table thead th { background: #f0f0f0; font-weight: bold; text-align: center; font-size: 8pt; }
      .tuition-header { background: #e0e0e0 !important; font-size: 9.5pt !important; text-align: center; }
      .tuition-header-before { background: #d5d8dc !important; color: #2c3e50 !important; }
      .tuition-header-after { background: #e67e22 !important; color: #fff !important; }
      .tuition-period td { text-align: center; font-size: 8pt; background: #fafafa; }
      .tuition-table .num { text-align: right; white-space: nowrap; }
      .tuition-table .note-in-cell { font-size: 7pt; white-space: nowrap; }
      .tuition-table .discount-row td { color: #cc0000; }
      .tuition-table .subtotal-row td { background: #fafafa; font-weight: bold; }
      .tuition-table .total-row td { background: #e8e8e8; }
      .payment-columns { display: flex; gap: 3mm; margin-bottom: 1.5mm; }
      .payment-col { flex: 1; }
      .payment-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 1mm; }
      .payment-table th, .payment-table td { border: 1px solid #333; padding: 0.5mm 1.5mm; }
      .payment-table th { background: #f0f0f0; font-weight: bold; text-align: left; white-space: nowrap; }
      .payment-table .num { text-align: right; white-space: nowrap; }
      .payment-table .total-row th, .payment-table .total-row td { background: #e8e8e8; }
      .payment-table .handwrite-deadline { font-size: 8.5pt; text-align: center; vertical-align: middle; min-width: 110px; background: #fff; }
      .bank-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 0.5mm; }
      .bank-table th, .bank-table td { border: 1px solid #333; padding: 0.5mm 1mm; }
      .bank-table th { background: #f0f0f0; font-weight: bold; white-space: nowrap; }
      .notes-box { border: 1px solid #333; padding: 1mm 2mm; min-height: 5mm; max-height: 15mm; font-size: 9pt; margin-bottom: 1.5mm; white-space: pre-wrap; overflow: hidden; }
      .confirm-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 1.5mm; }
      .confirm-table th, .confirm-table td { border: 1px solid #333; padding: 0.5mm 1.5mm; vertical-align: top; }
      .confirm-table th { background: #f0f0f0; font-weight: bold; width: 8%; text-align: center; }
      .checkbox-line { display: inline-block; margin-top: 0.5mm; }
      .signature-section { margin: 1.5mm 0; font-size: 9pt; }
      .signature-section > p { margin-bottom: 1mm; }
      .signature-table { border-collapse: collapse; font-size: 9pt; }
      .signature-table th, .signature-table td { border: 1px solid #333; padding: 0.5mm 1.5mm; }
      .signature-table th { background: #f0f0f0; font-weight: bold; white-space: nowrap; }
      .signature-table .handwrite { min-width: 180px; }
      .seal { width: 2.2em; height: 2.2em; text-align: center; vertical-align: middle; font-size: 8.5pt; border: 1px solid #333; }
      .company-section { display: flex; justify-content: space-between; align-items: flex-end; margin: 1.5mm 0; font-size: 9pt; }
      .company-info p { margin-bottom: 0; }
      .staff-info { display: flex; align-items: center; }
      .legal-section { margin: 1.5mm 0; }
      .legal-section > p:first-child { font-size: 9pt; margin-bottom: 0.5mm; }
      .small-text { font-size: 7.5pt; line-height: 1.3; }
      .cooling-off-section { margin: 1.5mm 0; border: 2px solid #cc0000; padding: 1.5mm 2mm; color: #cc0000; }
      .cooling-off-title { font-size: 9.5pt; font-weight: bold; margin-bottom: 0.5mm; color: #cc0000; }
      .cooling-off-body { font-size: 8pt; line-height: 1.3; color: #cc0000; }
      .cooling-off-body p { margin-bottom: 0.5mm; }
      .page-back .contract-title { margin-bottom: 2mm; }
      .terms-columns { display: flex; gap: 5mm; }
      .terms-col { flex: 1; }
      .term-article { margin-bottom: 1.2mm; }
      .term-article h3 { font-size: 8.5pt; font-weight: bold; margin-bottom: 0.3mm; }
      .term-article p { font-size: 7.5pt; line-height: 1.3; margin-bottom: 0.5mm; }
      .nochange-check { display: inline-block; font-size: 8.5pt; font-weight: bold; border: 1px solid #999; padding: 0 3mm; background: #fafafa; }
      @media print {
        body { background: #fff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .no-print { display: none !important; }
        .contract-sheet { width: 100%; height: auto; max-height: 410mm; margin: 0; padding: 8mm 12mm; box-shadow: none; page-break-after: always; overflow: hidden; }
        .contract-sheet:last-child { page-break-after: auto; }
        @page { size: A3 portrait; margin: 5mm; }
      }
    `}</style>
  )
}

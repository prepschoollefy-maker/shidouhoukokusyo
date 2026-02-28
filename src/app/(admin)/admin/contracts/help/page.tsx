'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ContractsHelpPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <Link
          href="/admin/contracts/billing"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          請求・入金に戻る
        </Link>
        <h2 className="text-2xl font-bold">請求・入金マニュアル</h2>
        <p className="text-sm text-muted-foreground mt-1">契約管理・請求・入金に関する操作ガイド</p>
      </div>

      {/* 支払方法の仕組み */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">支払方法の仕組み</h3>
          <p className="text-sm leading-relaxed">
            各生徒の支払方法（振込 / 口座振替）は<strong>口座振替開始年月</strong>によって自動で決まります。
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <p><strong>口座振替開始年月が未設定</strong> → すべての請求が「振込」</p>
            <p><strong>口座振替開始年月が設定済み</strong> → その月以降の請求は「口座振替」、それより前は「振込」</p>
          </div>
          <div className="text-sm space-y-1">
            <p className="font-medium">設定場所:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong>生徒契約詳細ページ</strong>（通常コース管理 → 生徒名をクリック → 支払方法セクション）</li>
              <li>生徒管理ページの編集ダイアログ内でも設定可能</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 請求行ごとの支払方法オーバーライド */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">請求行ごとの支払方法変更（オーバーライド）</h3>
          <p className="text-sm leading-relaxed">
            特定の請求だけ支払方法を変えたい場合（例: 口座振替の生徒の教材を今回だけ振込にしたい）、
            請求・入金ページで個別に変更できます。
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <p><strong>操作:</strong> 請求・入金ページの「支払方法」バッジ（振込 / 口座振替）をクリック</p>
            <p><strong>効果:</strong> クリックするたびに 振込 ↔ 口座振替 が切り替わります</p>
            <p><strong>見分け方:</strong> オーバーライドされたバッジにはリング（枠線）が付きます</p>
          </div>
          <div className="text-sm space-y-1">
            <p className="font-medium">注意事項:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>オーバーライドはその請求行のみに適用されます（他の月や他の請求には影響しません）</li>
              <li>入金OKを押すとオーバーライドされた支払方法で記録されます</li>
              <li>元に戻すには：入金詳細ダイアログの「オーバーライドを解除」ボタンを使います</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 入金の記録方法 */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">入金の記録方法</h3>

          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium mb-1">1. 入金OK（1クリック）</p>
              <p className="text-muted-foreground ml-4">
                請求額＝入金額として即座に「入金済み」にします。最もよく使う操作です。
              </p>
            </div>

            <div>
              <p className="font-medium mb-1">2. 詳細ボタン（金額指定）</p>
              <p className="text-muted-foreground ml-4">
                入金額・入金日・支払方法・備考を個別に指定できます。過不足がある場合に使います。
              </p>
            </div>

            <div>
              <p className="font-medium mb-1">3. 一括入金OK（チェックボックス選択）</p>
              <p className="text-muted-foreground ml-4">
                左端のチェックボックスで複数の未入金行を選択し、まとめて入金OKにします。
              </p>
            </div>

            <div>
              <p className="font-medium mb-1">4. 口座振替 一括入金OK</p>
              <p className="text-muted-foreground ml-4">
                口座振替の未入金をまとめて入金OKにします。振込にオーバーライドされた行は自動でスキップされます。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 入金状況のステータス */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">入金ステータス</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">未入金</span>
              <span className="text-muted-foreground">まだ入金が確認されていない状態</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">入金済み</span>
              <span className="text-muted-foreground">請求額と同額の入金が確認された状態</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-600 text-white">過不足あり</span>
              <span className="text-muted-foreground">入金額が請求額と異なる状態（差額が表示されます）</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* フィルタ機能 */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">フィルタ機能</h3>
          <div className="space-y-2 text-sm">
            <p><strong>入金ステータスフィルタ:</strong> すべて / 未入金 / 入金済み / 過不足あり</p>
            <p><strong>支払方法フィルタ:</strong> 全件 / 振込 / 口座振替</p>
            <p className="text-muted-foreground">
              フィルタは組み合わせて使えます。例:「未入金」+「振込」で、振込依頼が必要な生徒だけ表示できます。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ページ構成 */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">ページ構成</h3>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <Link href="/admin/contracts" className="font-medium text-primary hover:underline">通常コース管理</Link>
              <span className="text-muted-foreground">通常コースの契約を登録・編集</span>

              <Link href="/admin/contracts/lectures" className="font-medium text-primary hover:underline">講習管理</Link>
              <span className="text-muted-foreground">講習の登録・コマ数配分</span>

              <Link href="/admin/contracts/materials" className="font-medium text-primary hover:underline">教材販売</Link>
              <span className="text-muted-foreground">教材の販売記録</span>

              <Link href="/admin/contracts/billing" className="font-medium text-primary hover:underline">請求・入金</Link>
              <span className="text-muted-foreground">月ごとの請求一覧と入金管理</span>

              <Link href="/admin/contracts/billing/history" className="font-medium text-primary hover:underline">入金履歴</Link>
              <span className="text-muted-foreground">過去の入金記録の閲覧</span>

              <Link href="/admin/contracts/dashboard" className="font-medium text-primary hover:underline">経営ダッシュボード</Link>
              <span className="text-muted-foreground">売上・生徒数の推移</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function ContractsHelpPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">契約マニュアル</h2>
        <p className="text-sm text-muted-foreground mt-1">契約セクションの全機能に関する操作ガイド</p>
      </div>

      {/* 目次 */}
      <Card>
        <CardContent className="py-5 px-5 space-y-2">
          <h3 className="text-lg font-semibold">ページ一覧</h3>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <Link href="/admin/contracts" className="font-medium text-primary hover:underline">通常コース管理</Link>
            <span className="text-muted-foreground">通常コースの契約を登録・編集・削除</span>

            <Link href="/admin/contracts/lectures" className="font-medium text-primary hover:underline">講習管理</Link>
            <span className="text-muted-foreground">講習の登録・月別コマ数配分・金額計算</span>

            <Link href="/admin/contracts/materials" className="font-medium text-primary hover:underline">教材販売</Link>
            <span className="text-muted-foreground">教材の販売記録の管理</span>

            <Link href="/admin/contracts/billing" className="font-medium text-primary hover:underline">請求・入金</Link>
            <span className="text-muted-foreground">月ごとの請求一覧と入金管理</span>

            <Link href="/admin/contracts/billing/history" className="font-medium text-primary hover:underline">入金履歴</Link>
            <span className="text-muted-foreground">過去の入金記録の閲覧</span>

            <Link href="/admin/contracts/dashboard" className="font-medium text-primary hover:underline">経営ダッシュボード</Link>
            <span className="text-muted-foreground">売上・生徒数の推移グラフ</span>

            <Link href="/admin/contracts/renew" className="font-medium text-primary hover:underline">次年度契約一括更新</Link>
            <span className="text-muted-foreground">期限が近い契約を一括で更新</span>
          </div>
        </CardContent>
      </Card>

      {/* ── 通常コース管理 ── */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">通常コース管理</h3>
          <p className="text-sm leading-relaxed">
            生徒ごとの通常コース契約（月謝制）を管理するページです。
          </p>
          <div className="text-sm space-y-2">
            <p className="font-medium">主な操作:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong>新規登録:</strong> 「＋」ボタンから生徒・学年・コース・開始日・終了日を入力して契約を作成</li>
              <li><strong>編集:</strong> 各契約の鉛筆アイコンから内容を編集</li>
              <li><strong>削除:</strong> ゴミ箱アイコンで契約を削除</li>
              <li><strong>CSV一括登録:</strong> CSVファイルから複数の契約をまとめて登録</li>
              <li><strong>検索・フィルタ:</strong> 生徒名で検索、有効／全件／期限切れで絞り込み</li>
              <li><strong>並び替え:</strong> 生徒番号順・学年順の切り替え</li>
            </ul>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
            <p><strong>月謝の自動計算:</strong> コース（週コマ数）と学年に基づいて月額料金が自動算出されます。</p>
            <p><strong>生徒別グループ表示:</strong> 同じ生徒に複数の契約がある場合、生徒ごとにまとめて表示されます。</p>
          </div>
        </CardContent>
      </Card>

      {/* ── 講習管理 ── */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">講習管理</h3>
          <p className="text-sm leading-relaxed">
            春期・夏期・冬期などの講習受講情報を管理します。
          </p>
          <div className="text-sm space-y-2">
            <p className="font-medium">主な操作:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong>新規登録:</strong> 生徒・ラベル（春期講習など）・学年・コースを指定して登録</li>
              <li><strong>コマ数配分:</strong> 各コースの合計コマ数を設定し、月別に配分を指定</li>
              <li><strong>ビュー切替:</strong> 「生徒別」と「時系列」の2種類の表示に切り替え可能</li>
              <li><strong>編集・削除:</strong> 各講習の内容を編集またはごみ箱アイコンで削除</li>
            </ul>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <p><strong>月別配分:</strong> 各コースの「配分」ボタンで月ごとのコマ数を設定します。配分合計が合計コマ数と一致する必要があります。</p>
            <p><strong>金額自動計算:</strong> 学年とコースに応じた単価 × コマ数で金額が自動計算されます。月別内訳も表示されます。</p>
            <p><strong>生徒別ビュー:</strong> 生徒ごとにカードでまとめて表示。合計金額と月別内訳が一目で確認できます。</p>
            <p><strong>時系列ビュー:</strong> 全講習を年月順に並べて表示。全体の流れを把握するのに便利です。</p>
          </div>
        </CardContent>
      </Card>

      {/* ── 教材販売 ── */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">教材販売</h3>
          <p className="text-sm leading-relaxed">
            生徒への教材販売記録を管理します。
          </p>
          <div className="text-sm space-y-2">
            <p className="font-medium">主な操作:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong>新規登録:</strong> 生徒・教材名・金額・販売日・請求年月を入力して登録</li>
              <li><strong>編集・削除:</strong> 各販売記録の編集・削除</li>
              <li><strong>ビュー切替:</strong> 「生徒別」と「時系列」の2種類の表示に切り替え可能</li>
            </ul>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
            <p><strong>請求年月:</strong> 販売日とは別に、どの月の請求に含めるかを指定できます。</p>
            <p><strong>生徒別ビュー:</strong> 生徒ごとにカードでまとめて表示。合計金額を確認できます。</p>
            <p><strong>時系列ビュー:</strong> 全販売記録を請求年月順に並べて表示します。</p>
          </div>
        </CardContent>
      </Card>

      {/* ── 請求・入金 ── */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">請求・入金</h3>
          <p className="text-sm leading-relaxed">
            月ごとの請求一覧を確認し、入金処理を行うページです。通常コース・講習・教材の請求が統合表示されます。
          </p>

          <div className="text-sm space-y-3">
            <div>
              <p className="font-medium mb-1">支払方法の仕組み</p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
                <p><strong>口座振替開始年月が未設定</strong> → すべての請求が「振込」</p>
                <p><strong>口座振替開始年月が設定済み</strong> → その月以降は「口座振替」、それより前は「振込」</p>
                <p className="text-muted-foreground">設定場所: 通常コース管理 → 生徒名クリック → 支払方法セクション、または生徒管理の編集ダイアログ</p>
              </div>
            </div>

            <div>
              <p className="font-medium mb-1">支払方法のオーバーライド</p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
                <p>請求行の「振込/口座振替」バッジをクリックすると、その行のみ支払方法を切り替えられます。</p>
                <p>オーバーライドされたバッジにはリング（枠線）が付きます。解除は入金詳細ダイアログから行えます。</p>
              </div>
            </div>

            <div>
              <p className="font-medium mb-1">入金の記録方法</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li><strong>入金OK:</strong> 請求額＝入金額としてワンクリックで入金済みに</li>
                <li><strong>詳細ボタン:</strong> 入金額・入金日・支払方法・備考を個別指定</li>
                <li><strong>一括入金OK:</strong> チェックボックスで複数行を選択してまとめて処理</li>
                <li><strong>口座振替 一括入金OK:</strong> 口座振替の未入金をまとめて処理（振込オーバーライド行はスキップ）</li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-1">入金ステータス</p>
              <div className="flex flex-wrap gap-3 text-sm">
                <span><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">未入金</span> 未確認</span>
                <span><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">入金済み</span> 確認済み</span>
                <span><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-600 text-white">過不足あり</span> 差額あり</span>
              </div>
            </div>

            <div>
              <p className="font-medium mb-1">フィルタ機能</p>
              <p className="text-muted-foreground ml-2">入金ステータス（すべて/未入金/入金済み/過不足あり）と支払方法（全件/振込/口座振替）で絞り込みが可能です。</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 入金履歴 ── */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">入金履歴</h3>
          <p className="text-sm leading-relaxed">
            過去の入金記録を一覧で確認できるページです。入金日・金額・支払方法・備考などの詳細を閲覧できます。
          </p>
        </CardContent>
      </Card>

      {/* ── 経営ダッシュボード ── */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">経営ダッシュボード</h3>
          <p className="text-sm leading-relaxed">
            売上・生徒数の推移を視覚的に確認できるページです。閲覧にはパスワード認証が必要です。
          </p>
          <div className="text-sm space-y-2">
            <p className="font-medium">表示内容:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong>KPIカード:</strong> 当月売上・生徒数・平均月謝</li>
              <li><strong>売上推移グラフ:</strong> 月ごとの売上をグラフで表示</li>
              <li><strong>学年別統計:</strong> 学年ごとの生徒数・月額売上・週コマ数の内訳</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* ── 次年度契約一括更新 ── */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">次年度契約一括更新</h3>
          <p className="text-sm leading-relaxed">
            年度末に期限が近づく契約をまとめて更新するための機能です。通常は年に1回、3月頃に使用します。
          </p>
          <div className="text-sm space-y-2">
            <p className="font-medium">操作の流れ:</p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1 ml-2">
              <li>終了日の範囲を指定して、更新対象の契約を一覧表示</li>
              <li>各契約に新しい学年・コース・期間のデフォルト値が自動セット</li>
              <li>必要に応じて値を修正</li>
              <li>契約ごとに「更新」ボタンで新契約を作成</li>
            </ol>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
            <p><strong>学年の自動進級:</strong> 3月末→4月の切り替えの場合のみ、学年が自動的に1つ上がります。</p>
            <p><strong>受験生:</strong> 終了日が1月31日の契約は受験生として扱われ、2月1日〜3月31日の短期契約（学年据え置き）がデフォルトになります。</p>
            <p><strong>月謝プレビュー:</strong> 新しい学年・コースに応じた月謝がリアルタイムで表示されます。</p>
          </div>
        </CardContent>
      </Card>

      {/* ── 退塾時のデータ保持 ── */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <h3 className="text-lg font-semibold">退塾時のデータ保持について</h3>
          <p className="text-sm leading-relaxed">
            生徒が退塾した場合でも、契約・講習・教材販売・請求/入金データはすべて保持されます。
            売上履歴を追跡するため、売上データがある生徒は削除できず、「退塾」処理を行う仕組みになっています。
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
            <p><strong>退塾処理の効果:</strong></p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>授業テンプレートが無効化されます</li>
              <li>未来の予定済み授業がキャンセルされます</li>
              <li>契約・講習・教材・入金データはそのまま残ります</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

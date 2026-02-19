'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, PlusCircle, Camera, Pencil, HelpCircle } from 'lucide-react'

const sections = [
  {
    icon: PlusCircle,
    title: '1. レポートを入力する',
    steps: [
      '画面下の「新規入力」をタップします。',
      '生徒・授業日・科目を選択します。',
      '使用テキスト（複数追加可）、扱った単元、宿題チェックを入力します。',
      '授業中の様子をポジティブ／ネガティブから選択し、得意・苦手を記入します。',
      '自由コメント・出した宿題・次回やることを記入します。',
      '「講師間の申し送り」は保護者には見えません。講師同士の引き継ぎにご活用ください。',
      '「保存」を押して完了です。',
    ],
  },
  {
    icon: Camera,
    title: '2. 写真からレポートを入力する',
    steps: [
      '画面下の「写真入力」をタップします。',
      '「カメラで撮影」または「画像を選択」で手書きレポート用紙の写真を取り込みます。',
      'AIが内容を自動で読み取り、フォームに反映します。',
      '読み取り結果（黄色でハイライト）を確認・修正してから「保存」してください。',
    ],
  },
  {
    icon: ClipboardList,
    title: '3. レポートを確認・編集する',
    steps: [
      '画面下の「レポート」をタップすると、自分が作成したレポートの一覧が表示されます。',
      'レポートをタップすると詳細を確認できます。',
      '詳細画面の「編集」ボタンから内容を修正できます。',
    ],
  },
]

const faqs = [
  {
    q: '生徒や科目の一覧に出てこない名前があります',
    a: '管理者が登録した生徒・科目のみ表示されます。管理者にご連絡ください。',
  },
  {
    q: '入力を途中でやめたいです',
    a: '保存せずにページを離れれば入力内容は破棄されます。下書き保存機能はありません。',
  },
  {
    q: 'パスワードを忘れました',
    a: 'ログイン画面の「パスワードを忘れた方」からリセットできます。',
  },
  {
    q: 'レポートを間違えて保存しました',
    a: 'レポート一覧から該当のレポートを開き、「編集」ボタンから修正してください。',
  },
]

export default function GuidePage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold">使い方ガイド</h2>

      {sections.map((section) => {
        const Icon = section.icon
        return (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700">
                {section.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )
      })}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
            よくある質問
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i}>
              <p className="text-sm font-medium">Q. {faq.q}</p>
              <p className="text-sm text-gray-600 mt-0.5">A. {faq.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

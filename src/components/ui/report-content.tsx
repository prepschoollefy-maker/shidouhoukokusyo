'use client'

import { BookOpen, Brain, UserCheck, Home, Lightbulb, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Section {
  title: string
  body: string
}

// セクションタイトルに応じたテーマ色とアイコン
const sectionThemes: { pattern: RegExp; color: string; bgColor: string; borderColor: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { pattern: /学習(内容|進捗)/, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', icon: BookOpen },
  { pattern: /理解度|理解/, color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300', icon: Brain },
  { pattern: /様子/, color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', icon: UserCheck },
  { pattern: /方針|家庭|お願い/, color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300', icon: Home },
  { pattern: /宿題|次回/, color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-300', icon: ClipboardList },
]

const defaultTheme = { color: 'text-slate-700', bgColor: 'bg-slate-50', borderColor: 'border-slate-300', icon: Lightbulb }

function getTheme(title: string) {
  for (const t of sectionThemes) {
    if (t.pattern.test(title)) return t
  }
  return defaultTheme
}

/**
 * コンテンツ文字列を【section】ベースでパース
 */
function parseSections(content: string): Section[] {
  const regex = /【([^】]+)】/g
  const parts: Section[] = []
  const matches: { title: string; index: number }[] = []
  let match

  while ((match = regex.exec(content)) !== null) {
    matches.push({ title: match[1], index: match.index })
  }

  if (matches.length === 0) return [{ title: '', body: content.trim() }]

  const preamble = content.slice(0, matches[0].index).trim()
  if (preamble) {
    parts.push({ title: '', body: preamble })
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].title.length + 2
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length
    const body = content.slice(start, end).trim()
    parts.push({ title: matches[i].title, body })
  }

  return parts
}

/**
 * テキストからmarkdown残骸をクリーンアップし、「」強調をレンダリング
 */
function cleanAndRender(text: string): React.ReactNode[] {
  // Strip markdown artifacts
  let cleaned = text
    .replace(/^#{1,6}\s*/gm, '')        // ## heading
    .replace(/^---+$/gm, '')            // ---
    .replace(/^\*{3,}$/gm, '')          // ***
    .replace(/```[\s\S]*?```/g, '')     // code blocks
    .replace(/\n{3,}/g, '\n\n')         // excess newlines

  // Split by **bold** and 「quoted」 to render inline formatting
  const parts = cleaned.split(/(\*\*[^*]+\*\*|「[^」]+」)/)

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('「') && part.endsWith('」')) {
      return <span key={i} className="font-semibold text-gray-800">{part}</span>
    }
    return <span key={i}>{part}</span>
  })
}

interface ReportContentProps {
  content: string
  className?: string
  variant?: 'card' | 'inline'
}

/**
 * レポート内容を美しくレンダリングするコンポーネント
 * - 【section】ヘッダーをセクション分割
 * - セクションごとに色分けしたカード表示
 * - **bold** と「強調」をインライン処理
 * - markdown残骸を自動クリーンアップ
 */
export function ReportContent({ content, className, variant = 'card' }: ReportContentProps) {
  const sections = parseSections(content)

  if (variant === 'inline') {
    return (
      <div className={cn('space-y-4', className)}>
        {sections.map((section, i) => {
          const theme = section.title ? getTheme(section.title) : null
          return (
            <div key={i}>
              {section.title && (
                <h3 className={cn('font-bold text-sm mb-1.5', theme?.color || 'text-gray-800')}>
                  {section.title}
                </h3>
              )}
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {cleanAndRender(section.body)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {sections.map((section, i) => {
        const theme = section.title ? getTheme(section.title) : null
        const Icon = theme?.icon

        if (!section.title) {
          return (
            <div key={i} className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {cleanAndRender(section.body)}
            </div>
          )
        }

        return (
          <div
            key={i}
            className={cn(
              'rounded-xl border-l-4 bg-white shadow-sm overflow-hidden',
              theme?.borderColor || 'border-gray-300'
            )}
          >
            <div className={cn('px-4 py-2.5 flex items-center gap-2', theme?.bgColor || 'bg-gray-50')}>
              {Icon && <Icon className={cn('h-4 w-4', theme?.color)} />}
              <h3 className={cn('font-bold text-sm', theme?.color || 'text-gray-800')}>
                {section.title}
              </h3>
            </div>
            <div className="px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {cleanAndRender(section.body)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

import { createAdminClient } from '@/lib/supabase/admin'

export async function getAiPromptSettings(): Promise<{
  ai_lesson_prompt: string | null
  ai_monthly_prompt: string | null
}> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('school_settings')
    .select('ai_lesson_prompt, ai_monthly_prompt')
    .limit(1)
    .single()
  return {
    ai_lesson_prompt: data?.ai_lesson_prompt || null,
    ai_monthly_prompt: data?.ai_monthly_prompt || null,
  }
}

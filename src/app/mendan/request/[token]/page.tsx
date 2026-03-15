import { redirect } from 'next/navigation'

export default async function MendanRequestRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  redirect(`/m/${token}`)
}

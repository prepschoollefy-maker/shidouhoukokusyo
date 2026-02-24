import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/admin/login', '/register', '/reset-password', '/auth/callback', '/auth/confirm', '/view', '/api/summaries/view', '/api/register', '/print', '/mendan', '/api/mendan/requests']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  if (!user && !isPublicRoute) {
    // Redirect unauthenticated users to the appropriate login page
    const url = request.nextUrl.clone()
    url.pathname = pathname.startsWith('/admin') ? '/admin/login' : '/login'
    return NextResponse.redirect(url)
  }

  // Redirect already-logged-in users away from login pages
  if (user && pathname === '/login') {
    const role = user.app_metadata?.role || 'teacher'
    const url = request.nextUrl.clone()
    url.pathname = role === 'admin' ? '/admin/dashboard' : '/reports'
    return NextResponse.redirect(url)
  }
  if (user && pathname === '/admin/login') {
    const role = user.app_metadata?.role || 'teacher'
    const url = request.nextUrl.clone()
    url.pathname = role === 'admin' ? '/admin/dashboard' : '/reports'
    return NextResponse.redirect(url)
  }

  // Role-based route protection
  if (user && pathname.startsWith('/admin')) {
    const role = user.app_metadata?.role || 'teacher'
    if (role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/reports'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

import { redirect } from 'next/navigation'
import { Auth0Client } from '@auth0/nextjs-auth0/server'

declare module '@auth0/nextjs-auth0/server' {
  interface User {
    id: string
  }
}

export const auth0 = new Auth0Client({
    async beforeSessionSaved(session) {
        const user = session.user

        return {
            ...session,
            user: {
                id: user.sub,
                ...user,
            }
        }
    }
})

export async function authenticate() {
    const session = await auth0.getSession()
    if (! session?.user)
        return redirect('/auth/login')
    return session.user
}
import type { Metadata } from 'next'
import { Provider } from '@/components/ui/provider'
import { DatabaseProvider } from 'asasvirtuais/react-interface'
import { ChatsProvider } from './chat/table'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body>
        <Provider>
          <DatabaseProvider>
            <ChatsProvider>
              {children}
            </ChatsProvider>
          </DatabaseProvider>
        </Provider>
      </body>
    </html>
  )
}

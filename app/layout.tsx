import type { Metadata } from 'next'
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import { StoreProvider } from '@/lib/store'

export const metadata: Metadata = {
  title: 'ShopBot — AI Commerce Agent',
  description:
    'Your intelligent shopping assistant. Discover products through natural conversation or image search.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClerkProvider>
          <StoreProvider>{children}</StoreProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}

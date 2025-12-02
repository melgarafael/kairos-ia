export const metadata = {
  title: 'Prompt Creator API - TomikOS',
  description: 'AI-powered prompt creator for n8n agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}


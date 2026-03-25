import type { Metadata, Viewport } from "next"
import "./globals.css"
import AuthGuard from "@/components/AuthGuard"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#B400FF"
}

export const metadata: Metadata = {
  title: "IRL — In Real Life",
  description: "Rewiring the reward system of a generation",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IRL"
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#B400FF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="IRL" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-black min-h-screen overflow-hidden">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  )
}
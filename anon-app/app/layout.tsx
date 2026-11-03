import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./sw-register";
import ConsentBanner from "./consent-banner";
import ErrorBoundary from "./error-boundary";

export const metadata: Metadata = {
  title: "ANON // Anonymous Chat",
  description: "Pseudonymous chat with local privacy controls. Live chats are not yet end-to-end encrypted.",
  manifest: "/manifest.json",
  applicationName: "ANON",
  openGraph: {
    title: "ANON // Anonymous Chat",
    description: "Pseudonymous conversations with clear privacy controls. Live chats are not yet end-to-end encrypted.",
    siteName: "ANON",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ANON // Anonymous Chat",
    description: "Pseudonymous conversations with local privacy controls.",
  },
  appleWebApp: {
    capable: true,
    title: "ANON",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon.svg",
    shortcut: "/icons/icon.svg",
    apple: [
      { url: "/icons/icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#040203",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
        <ConsentBanner />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}



import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./sw-register";
import ConsentBanner from "./consent-banner";

export const metadata: Metadata = {
  title: "ANON// — Anonymous Chat",
  description: "Anonymous chat. No account. No profile.",
  manifest: "/manifest.json",
  applicationName: "ANON",
  appleWebApp: {
    capable: true,
    title: "ANON",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#040203",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        {children}
        <ConsentBanner />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Winter Tour 26/27",
  description: "Turneringsoversikt, scorekort og Order of Merit for Winter Tour 26/27.",
  applicationName: "Winter Tour 26/27",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Winter Tour",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/logo-ny-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/logo-ny-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/logo-ny-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f4f5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}

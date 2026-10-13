import type { Metadata, Viewport } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    description: SITE_DESCRIPTION,
    locale: "en_US",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    type: "profile",
    url: "/",
  },
  robots: {
    follow: true,
    googleBot: { "max-image-preview": "large", "max-snippet": -1 },
    index: true,
  },
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  twitter: {
    card: "summary_large_image",
    creator: "@metaloozee",
    description: SITE_DESCRIPTION,
    title: SITE_TITLE,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#08090b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          as="font"
          crossOrigin="anonymous"
          href="/fonts/ibm-vga-8x16.woff"
          rel="preload"
          type="font/woff"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

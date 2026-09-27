import type { Metadata, Viewport } from "next";
import "./globals.css";

const DESCRIPTION =
  "Ayan Parkar, a programmer from Mumbai, India, working on full-stack development and AI.";

export const metadata: Metadata = {
  authors: [{ name: "Ayan Parkar", url: "https://github.com/metaloozee" }],
  creator: "Ayan Parkar",
  description: DESCRIPTION,
  openGraph: {
    description: DESCRIPTION,
    locale: "en_US",
    siteName: "Ayan Parkar",
    title: "Ayan Parkar",
    type: "website",
  },
  title: {
    default: "Ayan Parkar",
    template: "%s | Ayan Parkar",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@metaloozee",
    description: DESCRIPTION,
    title: "Ayan Parkar",
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

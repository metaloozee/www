import type { Metadata } from "next";
import "./globals.css";

import { GeistSans } from "geist/font/sans";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  authors: [{ name: "Ayan", url: "https://github.com/metaloozee" }],
  creator: "Ayan",
  description:
    "I'm Ayan, an 18-year-old computer science student from Mumbai, India. Passionate about full-stack development and artificial intelligence.",
  keywords: [
    "Ayan",
    "Full-Stack Developer",
    "AI",
    "Machine Learning",
    "Web Development",
    "React",
    "Next.js",
  ],
  openGraph: {
    description:
      "I'm Ayan, an 18-year-old computer science student from Mumbai, India. Passionate about full-stack development and artificial intelligence.",
    locale: "en_US",
    siteName: "Ayan's Portfolio",
    title: "Ayan | Full-Stack Developer & AI Enthusiast",
    type: "website",
  },
  robots: {
    follow: true,
    index: true,
  },
  title: {
    default: "Ayan | Full-Stack Developer & AI Enthusiast",
    template: "%s | Ayan",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@metaloozee",
    description:
      "I'm Ayan, an 18-year-old computer science student from Mumbai, India. Passionate about full-stack development and artificial intelligence.",
    title: "Ayan | Full-Stack Developer & AI Enthusiast",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta content="#0a0a0a" name="theme-color" />
      </head>
      <body className={GeistSans.className}>
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            disableTransitionOnChange
            enableSystem
          >
            <main>{children}</main>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}

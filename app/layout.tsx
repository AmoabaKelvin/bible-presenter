import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// Wordmark only — soft editorial serif for the "FlowCast" logotype.
const fraunces = Fraunces({
  variable: "--font-wordmark",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const APP_NAME = "FlowCast";
const APP_DESCRIPTION =
  "FlowCast is a calm presentation console for worship and gatherings — project scripture in any translation, sermon notes, media, and stream background music from Spotify or YouTube to a second screen.";

export const metadata: Metadata = {
  metadataBase: new URL("https://bible.kelvinamoaba.com"),
  title: {
    default: "FlowCast — worship presentation console",
    template: "%s · FlowCast",
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
  },
  // Theme-aware favicon: the browser picks the file matching the OS/browser
  // color scheme via the media attribute — dark waves on light, white on dark.
  icons: {
    icon: [
      { url: "/icon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  keywords: [
    "worship presentation",
    "scripture projection",
    "church slides",
    "sermon notes",
    "lyrics projection",
    "bible presenter",
  ],
  authors: [{ name: "Kelvin Amoaba" }],
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: "FlowCast — worship presentation console",
    description: APP_DESCRIPTION,
    url: "https://bible.kelvinamoaba.com",
  },
  twitter: {
    card: "summary",
    title: "FlowCast — worship presentation console",
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased overflow-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

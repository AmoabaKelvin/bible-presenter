import type { Metadata, Viewport } from "next";
import { Figtree, Geist_Mono, Jost } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// Wordmark fallback — Jost is the closest free geometric sans to Century
// Gothic, used for the "FlowCast" logotype when Century Gothic isn't installed.
const jost = Jost({
  variable: "--font-wordmark",
  weight: ["400", "700"],
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
        className={`${figtree.variable} ${geistMono.variable} ${jost.variable} antialiased overflow-hidden`}
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
        {process.env.NODE_ENV === 'production' && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon='{"token": "7052633bfd194daa81f16d2966295eb2"}'
          />
        )}
      </body>
    </html>
  );
}

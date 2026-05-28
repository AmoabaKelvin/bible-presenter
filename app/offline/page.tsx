import type { Metadata } from "next"
import { BrandLogo } from "@/components/operator/brand"

export const metadata: Metadata = {
  title: "Offline",
}

export default function OfflinePage() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-background text-foreground p-8">
      <div className="flex flex-col items-center text-center gap-4 max-w-sm">
        <BrandLogo />
        <h1 className="text-lg font-medium">You&rsquo;re offline</h1>
        <p className="text-sm text-muted-foreground">
          flowwww can&rsquo;t reach the network right now. Pages and scripture
          you&rsquo;ve already opened are still available — reconnect to load
          anything new.
        </p>
      </div>
    </div>
  )
}

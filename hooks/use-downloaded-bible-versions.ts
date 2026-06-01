import { useCallback, useEffect, useState } from "react"
import { listDownloadedVersions } from "@/lib/bible-cache"

export function useDownloadedBibleVersions() {
  const [downloadedVersions, setDownloadedVersions] = useState<Set<string>>(new Set())

  const refreshDownloadedVersions = useCallback(() => {
    listDownloadedVersions().then((metas) =>
      setDownloadedVersions(
        new Set(metas.filter((meta) => meta.complete).map((meta) => meta.code)),
      ),
    )
  }, [])

  useEffect(() => {
    refreshDownloadedVersions()
  }, [refreshDownloadedVersions])

  return { downloadedVersions, refreshDownloadedVersions }
}

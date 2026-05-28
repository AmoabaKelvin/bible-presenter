import { clearYouTubeSession } from "@/lib/youtube-auth"

export const runtime = "nodejs"

export async function POST() {
  await clearYouTubeSession()
  return Response.json({ ok: true })
}

export async function GET(request: Request) {
  await clearYouTubeSession()
  return Response.redirect(new URL("/", request.url))
}

// Browser side of the chunked file transfer — spec §14 F-06, "Storage".
// Files cross Vercel in CHUNK_SIZE pieces (a function takes and returns at
// most 4.5 MB); these helpers hide that from the screens.

export type DeckFileMeta = {
  id: string
  kind: "TEMPLATE" | "DECK"
  fileName: string
  size: number
  chunkCount: number
  createdAt: string
  sharedAt: string | null
}

async function errorOf(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => null)
  return new Error(body?.error ?? fallback)
}

export async function uploadTemplate(file: File, onProgress?: (done: number, total: number) => void): Promise<DeckFileMeta> {
  const start = await fetch("/api/matzgot/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, size: file.size }),
  })
  if (!start.ok) throw await errorOf(start, "ההעלאה נכשלה")
  const { id, chunkCount, chunkSize } = (await start.json()) as { id: string; chunkCount: number; chunkSize: number }

  for (let i = 0; i < chunkCount; i++) {
    onProgress?.(i, chunkCount)
    const res = await fetch(`/api/matzgot/files/${id}/chunks/${i}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: file.slice(i * chunkSize, (i + 1) * chunkSize),
    })
    if (!res.ok) throw await errorOf(res, "ההעלאה נכשלה")
  }
  onProgress?.(chunkCount, chunkCount)

  const done = await fetch(`/api/matzgot/files/${id}/complete`, { method: "POST" })
  if (!done.ok) throw await errorOf(done, "ההעלאה נכשלה")
  return done.json()
}

const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

export async function downloadFile(meta: DeckFileMeta, onProgress?: (done: number, total: number) => void) {
  const parts: ArrayBuffer[] = []
  for (let i = 0; i < meta.chunkCount; i++) {
    onProgress?.(i, meta.chunkCount)
    const res = await fetch(`/api/matzgot/files/${meta.id}/chunks/${i}`)
    if (!res.ok) throw await errorOf(res, "ההורדה נכשלה")
    parts.push(await res.arrayBuffer())
  }
  onProgress?.(meta.chunkCount, meta.chunkCount)
  const url = URL.createObjectURL(new Blob(parts, { type: PPTX_TYPE }))
  const a = document.createElement("a")
  a.href = url
  a.download = meta.fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

import { fileService } from '@/services/modules/file.service'
import { extractStoredEvidenceFileName, splitEvidenceFilesAndUrls } from '@/utils/memberKpiHelpers'

export type EvidenceUrlNamePair = { url: string; name?: string }

export type PendingEvidenceListRow = { id: string; url: string; name?: string }

function storedNamesFromPairs(pairs: EvidenceUrlNamePair[]): string[] {
  return pairs
    .map(p => extractStoredEvidenceFileName(p.url))
    .filter((n): n is string => Boolean(n))
}

/** Xóa file upload trên disk khi user bỏ khỏi evidences và Save thành công. */
export async function purgeRemovedUploadedEvidenceFiles(
  previousJson: string,
  newPayload: Record<string, unknown>,
): Promise<void> {
  let previousNames = new Set<string>()
  const trimmed = (previousJson ?? '').trim()
  if (trimmed && trimmed !== '{}' && trimmed !== '[]') {
    try {
      const o = JSON.parse(trimmed) as Record<string, unknown>
      const { files } = splitEvidenceFilesAndUrls(o)
      previousNames = new Set(
        storedNamesFromPairs(files.map(f => ({ url: f.url, name: f.name }))),
      )
    } catch {
      /* ignore */
    }
  }

  const newFiles = Array.isArray(newPayload.files) ? (newPayload.files as unknown[]) : []
  const newNames = new Set(
    newFiles
      .map(x => {
        if (!x || typeof x !== 'object') return null
        const url = String((x as Record<string, unknown>).url ?? '').trim()
        return extractStoredEvidenceFileName(url)
      })
      .filter((n): n is string => Boolean(n)),
  )

  const toDelete = [...previousNames].filter(n => !newNames.has(n))
  for (const name of [...new Set(toDelete)]) {
    try {
      await fileService.deleteUploadedFile(name)
    } catch (error) {
      console.error('Failed to delete uploaded evidence file from disk', name, error)
    }
  }
}

/** Upload file mới chọn trên máy → cặp url/name API trả về. */
export async function uploadPendingEvidenceFiles(
  items: Array<{ file: File }>,
): Promise<EvidenceUrlNamePair[]> {
  const out: EvidenceUrlNamePair[] = []
  for (const item of items) {
    const res = await fileService.uploadFile(item.file)
    out.push({ url: res.url, name: res.name })
  }
  return out
}

export function appendEvidenceFilesUrlsToPayload(
  out: Record<string, unknown>,
  filePairs: EvidenceUrlNamePair[],
  urlPairs: EvidenceUrlNamePair[],
): void {
  const files = filePairs
    .map(p => ({ url: String(p.url ?? '').trim(), name: String(p.name ?? '').trim() }))
    .filter(p => p.url)
  const urls = urlPairs
    .map(p => ({ url: String(p.url ?? '').trim(), name: String(p.name ?? '').trim() }))
    .filter(p => p.url)
  if (files.length) out.files = files
  else delete out.files
  if (urls.length) out.urls = urls
  else delete out.urls
  delete out.evd
}

export function mapEvidencePairsToPending(
  pairs: EvidenceUrlNamePair[],
  idPrefix: string,
): PendingEvidenceListRow[] {
  return pairs
    .map(p => {
      const url = String(p.url ?? '').trim()
      if (!url) return null
      const name = String(p.name ?? '').trim()
      return {
        id: `${idPrefix}-${Math.random().toString(36).slice(2, 9)}`,
        url,
        ...(name ? { name } : {}),
      }
    })
    .filter((x): x is PendingEvidenceListRow => x != null)
}

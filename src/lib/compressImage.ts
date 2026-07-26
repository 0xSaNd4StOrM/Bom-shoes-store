type Options = { maxDim?: number; quality?: number }

// Client-side image compression before uploading to Supabase storage, to keep
// the free-tier storage (1 GB) and egress (5 GB/mo) lean. Resizes so the
// longest edge is <= maxDim and re-encodes as WebP -- alpha is preserved, so
// transparent brand logos stay transparent.
//
// Returns the ORIGINAL file untouched when it can't/shouldn't rasterize (SVG is
// already tiny + vector; GIF would lose animation; non-images pass through) or
// when compression wouldn't actually make the file smaller (already optimized).
export async function compressImage(file: File, opts: Options = {}): Promise<File> {
  const maxDim = opts.maxDim ?? 1200
  const quality = opts.quality ?? 0.82

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file // decode failed -> upload the original
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close?.(); return file }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality))
  if (!blob || blob.size >= file.size) {
    return file // didn't help -> keep the original, never bloat
  }

  const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
  return new File([blob], name, { type: 'image/webp' })
}

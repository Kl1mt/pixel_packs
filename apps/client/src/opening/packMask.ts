/** Which pack-local pixels a `size`×`size` sprite covers (so wrappings hug its silhouette). */
export function packMask(img: HTMLImageElement, size = 64): (x: number, y: number) => boolean {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return () => true;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, size, size).data;
  return (x, y) =>
    x >= 0 && y >= 0 && x < size && y < size && (data[(y * size + x) * 4 + 3] ?? 0) > 0;
}

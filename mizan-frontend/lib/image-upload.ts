const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_JPEG_QUALITY = 0.85;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode the selected image."));
    image.src = src;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Unable to compress the selected image."))),
      type,
      quality
    );
  });

/** Downscale large camera photos before upload to stay under backend limits. */
export async function prepareProfilePhotoUpload(
  file: File,
  options?: { maxBytes?: number; maxEdge?: number; quality?: number }
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options?.quality ?? DEFAULT_JPEG_QUALITY;

  if (file.size <= maxBytes && file.type === "image/jpeg") {
    return file;
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(image, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  if (blob.size <= maxBytes) {
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  }

  for (let attempt = 0; attempt < 4 && blob.size > maxBytes; attempt += 1) {
    blob = await canvasToBlob(canvas, "image/jpeg", Math.max(0.55, quality - (attempt + 1) * 0.1));
  }

  if (blob.size > maxBytes) {
    throw new Error("Image is too large. Choose a photo under 5 MB.");
  }

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

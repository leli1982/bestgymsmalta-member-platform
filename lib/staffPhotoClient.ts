export async function normaliseStaffPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size <= 0 || file.size > 12 * 1024 * 1024) throw new Error("Photo must be 12 MB or smaller before processing.");

  const bitmap = await createImageBitmap(file);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not process this photo.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  if (!blob) throw new Error("Could not convert this photo.");
  if (blob.size > 5 * 1024 * 1024) throw new Error("Processed photo is still larger than 5 MB.");
  return new File([blob], "staff-photo.webp", { type: "image/webp", lastModified: Date.now() });
}

/**
 * Image preparation for diagnosis.
 *
 * The uploaded photo is downscaled in the browser (max 1024 px) and encoded
 * as JPEG before it is sent as inline data to Firebase AI Logic. This keeps
 * uploads small on rural connections and gives us a thumbnail data URL for
 * the local history in the same pass.
 */

export interface PreparedImage {
  /** Base64 payload (no data-URL prefix) for the inlineData part. */
  base64: string;
  mimeType: string;
  /** Data URL used for preview and stored in local history. */
  dataUrl: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image file."));
    img.src = src;
  });
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && file.type !== "") {
    throw new Error("Please choose an image file (JPEG or PNG works best).");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return {
      base64: dataUrl.split(",")[1] ?? "",
      mimeType: "image/jpeg",
      dataUrl,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Normalizes user/admin entered image links so they reliably render inside React Native <Image>.
 * Handles:
 * - Google Drive share links (converts to direct streamable CDN URL)
 * - Dropbox preview links (converts ?dl=0 to ?raw=1)
 * - Imgur gallery/page links (converts to direct i.imgur.com/*.jpg)
 * - Discord CDN / Postimages
 * - Missing protocol (adds https://)
 * - Leading/trailing spaces
 */
export function normalizeImageUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  let url = rawUrl.trim();
  if (!url) return "";

  // Protocol normalization
  if (url.startsWith("//")) {
    url = "https:" + url;
  } else if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("file://") && !url.startsWith("data:")) {
    url = "https://" + url;
  }

  // 1. Google Drive Links:
  // Examples:
  // https://drive.google.com/file/d/1w8A9vXyz.../view?usp=sharing
  // https://drive.google.com/open?id=1w8A9vXyz...
  // https://drive.google.com/uc?id=1w8A9vXyz...
  if (url.includes("drive.google.com")) {
    let fileId: string | null = null;
    const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileDMatch && fileDMatch[1]) {
      fileId = fileDMatch[1];
    } else {
      const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idParamMatch && idParamMatch[1]) {
        fileId = idParamMatch[1];
      }
    }

    if (fileId) {
      // lh3.googleusercontent.com/d/ID directly streams the raw image from Google CDN
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  // 2. Dropbox Links:
  // https://www.dropbox.com/s/xyz/photo.jpg?dl=0 -> ?raw=1
  if (url.includes("dropbox.com")) {
    if (url.includes("?dl=0")) {
      return url.replace("?dl=0", "?raw=1");
    }
    if (url.includes("&dl=0")) {
      return url.replace("&dl=0", "&raw=1");
    }
    if (!url.includes("raw=1")) {
      return url + (url.includes("?") ? "&raw=1" : "?raw=1");
    }
  }

  // 3. Imgur Web Page Links:
  // https://imgur.com/xyz -> https://i.imgur.com/xyz.jpg
  if (url.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)$/)) {
    const match = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)$/);
    if (match && match[1]) {
      return `https://i.imgur.com/${match[1]}.jpg`;
    }
  }

  return url;
}

/** Upload limits shared by the browser uploader and the server checks. */
export const BUCKET = "candidate-documents";
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES_PER_APPLICATION = 6;
export const ALLOWED_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type AllowedType = keyof typeof ALLOWED_TYPES;
export const ACCEPT_ATTR = Object.keys(ALLOWED_TYPES).join(",");

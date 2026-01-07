import { router } from "src/server/trpc/def";

import { copyImage, createImage, deleteImage, getImageById, getImageCreationLog, getImageQuota, list,
  shareOrUnshareImage, updateImage } from "./image";

export const image = router({
  list,
  getImageById,
  updateImage,
  deleteImage,
  createImage,
  shareOrUnshareImage,
  copyImage,
  getImageQuota,
  getImageCreationLog,
});

import {
  fetchAdminMapDocument,
  putAdminMapDocument,
  uploadAdminMapAsset,
  type AdminMapDocument,
} from "../../api/adminMap";
import { LianApiError } from "../../api/http";

export type { AdminMapDocument };

export function useAdminMapApi() {
  return {
    load: fetchAdminMapDocument,
    save: putAdminMapDocument,
    upload: uploadAdminMapAsset,
    isAuthorizationError(error: unknown): boolean {
      return error instanceof LianApiError && (error.status === 401 || error.status === 403);
    },
  };
}

import { ref } from "vue";
import { LianApiError } from "../../api/http";
import { fetchAuthMe } from "../../api/profile";
import type { ProfileUser } from "../../types/profile";

export function useProfileSession() {
  const user = ref<ProfileUser | null>(null);
  const loading = ref(false);
  const errorMessage = ref("");

  function isMissingSessionError(error: unknown) {
    return error instanceof LianApiError && (error.code === "not-authorised" || error.status === 401 || error.status === 403);
  }

  async function refreshCurrentSession() {
    try {
      const refreshedUser = await fetchAuthMe();
      if (!refreshedUser) return false;
      user.value = refreshedUser;
      return true;
    } catch {
      return false;
    }
  }

  return { user, loading, errorMessage, isMissingSessionError, refreshCurrentSession };
}

import { onMounted, ref, type Ref } from "vue";
import { fetchAudienceOptions } from "../api/audience";
import type { AudienceOption, AudienceVisibility } from "../types/audience";

interface UseAudienceOptionsResult {
  options: Ref<AudienceOption[]>;
  loading: Ref<boolean>;
  error: Ref<string>;
  reload: () => Promise<void>;
  isAllowed: (visibility: AudienceVisibility) => boolean;
  disabledReason: (visibility: AudienceVisibility) => string;
}

const FALLBACK: AudienceOption[] = [
  { visibility: "public", label: "公开", disabled: false },
];

/**
 * Loads the user-allowed audience choices from the backend on mount.
 *
 * Why a composable: publish, event creation, and admin moderation will all
 * need the same "what audiences can this user pick?" answer. Centralizing
 * the load lets every surface trust a single source while the policy lives
 * server-side. Fallback ensures the UI keeps working against backends that
 * have not deployed the route yet (PRD V0.1 §7.4.3).
 */
export function useAudienceOptions(): UseAudienceOptionsResult {
  const options = ref<AudienceOption[]>([...FALLBACK]);
  const loading = ref(false);
  const error = ref("");

  async function reload() {
    if (loading.value) return;
    loading.value = true;
    error.value = "";
    try {
      const next = await fetchAudienceOptions();
      options.value = next.length ? next : [...FALLBACK];
    } catch (err) {
      error.value = err instanceof Error ? err.message : "audience options 加载失败";
      // Keep last-known options so the UI is never empty.
    } finally {
      loading.value = false;
    }
  }

  function isAllowed(visibility: AudienceVisibility): boolean {
    const match = options.value.find((opt) => opt.visibility === visibility);
    return match ? !match.disabled : visibility === "public";
  }

  function disabledReason(visibility: AudienceVisibility): string {
    const match = options.value.find((opt) => opt.visibility === visibility);
    return match?.disabledReason || "";
  }

  onMounted(() => {
    void reload();
  });

  return { options, loading, error, reload, isAllowed, disabledReason };
}

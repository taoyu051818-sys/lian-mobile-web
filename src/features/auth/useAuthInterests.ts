import { computed, onMounted, ref, type Ref } from "vue";
import { fetchAuthRules } from "../../api/auth";
import {
  AUTH_INTEREST_LOADING, AUTH_INTEREST_EMPTY, AUTH_INTEREST_ERROR,
  AUTH_INTEREST_PICK_HINT, AUTH_INTEREST_SKIP_DEFAULT,
} from "../../config/brand";
import {
  AUTH_MAX_INTEREST_SELECTIONS,
  toggleSelectedInterest as toggleSharedSelectedInterest,
} from "../../domain/validation/forms";
import type { AuthInterestOption, AuthRulesResponse } from "../../api/auth";

export type AuthInterestStatus = "loading" | "ready" | "empty" | "unavailable";

export interface AuthInterestSettings {
  options: AuthInterestOption[];
  status: AuthInterestStatus;
  required: boolean;
}

export function toggleSelectedInterest(current: string[], id: string, max = AUTH_MAX_INTEREST_SELECTIONS): string[] {
  return toggleSharedSelectedInterest(current, id, max);
}

export async function loadAuthInterestSettings(
  fetchRules: () => Promise<AuthRulesResponse> = fetchAuthRules,
): Promise<AuthInterestSettings> {
  try {
    const rules = await fetchRules();
    const options = rules.interests || [];
    if (!options.length) {
      return { options: [], status: "empty", required: false };
    }
    return {
      options,
      status: "ready",
      required: rules.interestsRequired === true,
    };
  } catch {
    return { options: [], status: "unavailable", required: false };
  }
}

export function useAuthInterests(
  mode: Ref<"login" | "register">,
) {
  const interestOptions = ref<AuthInterestOption[]>([]);
  const interestStatus = ref<AuthInterestStatus>("loading");
  const interestsRequired = ref(false);
  const selectedInterests = ref<string[]>([]);

  const hasInterestChoices = computed(
    () => interestStatus.value === "ready" && interestOptions.value.length > 0,
  );
  const showInterestSkip = computed(() => mode.value === "register" && !interestsRequired.value);
  const interestHint = computed(() => {
    if (interestStatus.value === "loading") {
      return AUTH_INTEREST_LOADING;
    }
    if (interestStatus.value === "empty") {
      return AUTH_INTEREST_EMPTY;
    }
    if (interestStatus.value === "unavailable") {
      return AUTH_INTEREST_ERROR;
    }
    if (interestsRequired.value) {
      return AUTH_INTEREST_PICK_HINT;
    }
    return AUTH_INTEREST_SKIP_DEFAULT;
  });

  function toggleInterest(id: string) {
    selectedInterests.value = toggleSelectedInterest(selectedInterests.value, id);
  }

  function skipInterestSelection() {
    selectedInterests.value = [];
  }

  function isInterestDisabled(id: string): boolean {
    return selectedInterests.value.length >= AUTH_MAX_INTEREST_SELECTIONS && !selectedInterests.value.includes(id);
  }

  async function refreshInterestSettings() {
    interestStatus.value = "loading";
    const settings = await loadAuthInterestSettings();
    interestOptions.value = settings.options;
    interestStatus.value = settings.status;
    interestsRequired.value = settings.required;
    if (!settings.options.length) {
      selectedInterests.value = [];
      return;
    }
    const optionIds = new Set(settings.options.map((option) => option.id));
    selectedInterests.value = selectedInterests.value.filter((id) => optionIds.has(id));
  }

  onMounted(() => {
    void refreshInterestSettings();
  });

  return {
    interestOptions,
    interestStatus,
    interestsRequired,
    selectedInterests,
    hasInterestChoices,
    showInterestSkip,
    interestHint,
    toggleInterest,
    skipInterestSelection,
    isInterestDisabled,
    refreshInterestSettings,
  };
}

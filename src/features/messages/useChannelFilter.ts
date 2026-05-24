import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { AudienceVisibility } from "../../types/audience";
import type { ChannelMessage } from "../../types/messages";

/**
 * Extended ChannelMessage with optional filter fields.
 * These fields will be populated by the backend once the filter feature ships.
 */
export interface FilterableChannelMessage extends ChannelMessage {
  visibility?: AudienceVisibility;
  category?: string;
}

export type FilterMode = "visibility" | "category";

export interface UseChannelFilterReturn {
  filterMode: Ref<FilterMode>;
  selectedVisibilities: Ref<Set<AudienceVisibility>>;
  selectedCategories: Ref<Set<string>>;
  filteredItems: ComputedRef<FilterableChannelMessage[]>;
  toggleFilterMode: () => void;
  toggleVisibility: (v: AudienceVisibility) => void;
  toggleCategory: (c: string) => void;
  clearFilters: () => void;
  hasActiveFilters: ComputedRef<boolean>;
}

/**
 * Composable for filtering channel messages by visibility or category.
 *
 * Supports two filter modes:
 * - "visibility": filter by AudienceVisibility (public, campus, school, private, linkOnly)
 * - "category": filter by category string
 *
 * When no filters are selected in the active mode, all items pass through.
 */
export function useChannelFilter(
  channelItems: Ref<FilterableChannelMessage[]>,
): UseChannelFilterReturn {
  const filterMode = ref<FilterMode>("visibility");
  const selectedVisibilities = ref<Set<AudienceVisibility>>(new Set());
  const selectedCategories = ref<Set<string>>(new Set());

  const hasActiveFilters = computed(() => {
    if (filterMode.value === "visibility") {
      return selectedVisibilities.value.size > 0;
    }
    return selectedCategories.value.size > 0;
  });

  const filteredItems = computed<FilterableChannelMessage[]>(() => {
    const items = channelItems.value;

    // No filters active — return all items
    if (!hasActiveFilters.value) {
      return items;
    }

    if (filterMode.value === "visibility") {
      const selected = selectedVisibilities.value;
      return items.filter((item) => {
        // Items without visibility field pass through when filtering by visibility
        if (!item.visibility) return true;
        return selected.has(item.visibility);
      });
    }

    // category mode
    const selected = selectedCategories.value;
    return items.filter((item) => {
      // Items without category field pass through when filtering by category
      if (!item.category) return true;
      return selected.has(item.category);
    });
  });

  function toggleFilterMode() {
    filterMode.value = filterMode.value === "visibility" ? "category" : "visibility";
  }

  function toggleVisibility(v: AudienceVisibility) {
    const next = new Set(selectedVisibilities.value);
    if (next.has(v)) {
      next.delete(v);
    } else {
      next.add(v);
    }
    selectedVisibilities.value = next;
  }

  function toggleCategory(c: string) {
    const next = new Set(selectedCategories.value);
    if (next.has(c)) {
      next.delete(c);
    } else {
      next.add(c);
    }
    selectedCategories.value = next;
  }

  function clearFilters() {
    selectedVisibilities.value = new Set();
    selectedCategories.value = new Set();
  }

  return {
    filterMode,
    selectedVisibilities,
    selectedCategories,
    filteredItems,
    toggleFilterMode,
    toggleVisibility,
    toggleCategory,
    clearFilters,
    hasActiveFilters,
  };
}

import { watch, onBeforeUnmount, type Ref } from "vue";

export function useEscapeListener(active: Ref<boolean>, onEscape: () => void) {
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onEscape();
    }
  }

  watch(active, (isActive) => {
    if (isActive) document.addEventListener("keydown", handleKeydown);
    else document.removeEventListener("keydown", handleKeydown);
  });

  onBeforeUnmount(() => document.removeEventListener("keydown", handleKeydown));
}

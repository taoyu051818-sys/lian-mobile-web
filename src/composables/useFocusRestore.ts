export function useFocusRestore() {
  let triggerEl: HTMLElement | null = null;

  function save() {
    triggerEl = document.activeElement as HTMLElement;
  }

  function restore() {
    triggerEl?.focus();
    triggerEl = null;
  }

  return { save, restore };
}

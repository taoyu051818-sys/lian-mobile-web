import { watch, onBeforeUnmount, type Ref } from "vue";

let lockCount = 0;
let savedOverflow = "";

export function useBodyScrollLock(active: Ref<boolean>) {
  function lock() {
    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.setProperty("overflow", "hidden");
    }
    lockCount++;
  }

  function unlock() {
    if (lockCount <= 0) return;
    lockCount--;
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow;
    }
  }

  watch(
    active,
    (isActive) => {
      if (isActive) lock();
      else unlock();
    },
    { immediate: true },
  );

  onBeforeUnmount(unlock);
}

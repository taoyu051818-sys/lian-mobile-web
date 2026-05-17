import { watch, onBeforeUnmount, type Ref } from "vue";

export function useBodyScrollLock(active: Ref<boolean>) {
  function lock() {
    document.body.style.setProperty("overflow", "hidden");
  }

  function unlock() {
    document.body.style.removeProperty("overflow");
  }

  watch(active, (isActive) => {
    if (isActive) lock();
    else unlock();
  });

  onBeforeUnmount(unlock);
}

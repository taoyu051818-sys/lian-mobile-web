import { onBeforeUnmount, ref } from "vue";

export function useNowTicker(intervalMs = 30_000) {
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | null = null;

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      now.value = Date.now();
    }, intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  onBeforeUnmount(stop);
  start();

  return { now };
}

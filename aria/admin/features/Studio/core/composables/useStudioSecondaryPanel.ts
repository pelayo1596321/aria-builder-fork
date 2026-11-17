import { readonly, ref } from "vue";

const title = ref("");
const visible = ref(false);
const hostReady = ref(false);

export function useStudioSecondaryPanel() {
  function setPanel(nextTitle: string, nextVisible: boolean): void {
    title.value = nextTitle;
    visible.value = nextVisible;
  }

  function setHostReady(ready: boolean): void {
    hostReady.value = ready;
  }

  return {
    title: readonly(title),
    visible: readonly(visible),
    hostReady: readonly(hostReady),
    setPanel,
    setHostReady,
  };
}

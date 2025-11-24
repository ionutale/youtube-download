<script lang="ts">
  import { onMount } from 'svelte';

  let show = false;

  function toggle() {
    show = !show;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === '?' && e.target instanceof Element && !e.target.matches('input, textarea')) {
      toggle();
    }
    if (e.key === 'Escape' && show) {
      show = false;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" on:click={toggle}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="glass-panel p-8 rounded-2xl max-w-md w-full" on:click|stopPropagation>
      <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-neon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Keyboard Shortcuts
      </h2>
      
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <span class="text-[var(--text-muted)]">Download</span>
          <kbd class="kbd kbd-sm">Enter</kbd>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-[var(--text-muted)]">Show Shortcuts</span>
          <kbd class="kbd kbd-sm">?</kbd>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-[var(--text-muted)]">Close Modals</span>
          <kbd class="kbd kbd-sm">Esc</kbd>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-[var(--text-muted)]">Focus Input</span>
          <kbd class="kbd kbd-sm">/</kbd>
        </div>
      </div>

      <div class="mt-8 text-center">
        <button class="btn btn-ghost btn-sm" on:click={toggle}>Close</button>
      </div>
    </div>
  </div>
{/if}

<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  let history: any[] = [];
  let loading = true;
  let searchTerm = '';
  let previewItem: any = null;

  async function loadHistory() {
    loading = true;
    try {
      const res = await fetch('/api/history');
      history = await res.json();
    } catch (e) {
      toast.error('Failed to load history');
    } finally {
      loading = false;
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this item?')) return;
    try {
      await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      history = history.filter(h => h.id !== id);
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  function redownload(item: any) {
    const params = new URLSearchParams({
      url: item.url,
      format: item.format,
      quality: item.quality || 'highest'
    });
    window.location.href = `/?${params.toString()}`;
  }

  function openPreview(item: any) {
    previewItem = item;
    (document.getElementById('preview_modal') as HTMLDialogElement)?.showModal();
  }

  function closePreview() {
    previewItem = null;
  }

  $: filteredHistory = history.filter(h => 
    !searchTerm || (h.title && h.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  onMount(loadHistory);
</script>

<div class="max-w-7xl mx-auto w-full">
  <div class="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
    <div>
      <h1 class="text-3xl font-bold flex items-center gap-2">
        <span class="w-2 h-8 rounded-full bg-neon-blue"></span>
        History
      </h1>
      <p class="text-gray-400 text-sm mt-1">Your download history</p>
    </div>

    <!-- Search -->
    <div class="relative w-full md:w-64">
      <input 
        type="text" 
        bind:value={searchTerm}
        placeholder="Search history..." 
        class="input input-bordered bg-white/5 border-glass-border focus:border-neon-blue text-white w-full pl-10 rounded-xl"
      />
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center p-20">
      <span class="loading loading-dots loading-lg text-neon-blue"></span>
    </div>
  {:else if filteredHistory.length === 0}
    <div class="glass-panel rounded-2xl p-16 text-center border-dashed border-2 border-white/10">
      <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-xl font-bold text-gray-300">No history found</h3>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each filteredHistory as item (item.id)}
        <div class="glass-panel rounded-2xl overflow-hidden group hover:border-neon-blue/50 transition-all duration-300 hover:-translate-y-1 flex flex-col">
          <!-- Thumbnail -->
          <div class="aspect-video bg-black/40 relative flex items-center justify-center group-hover:bg-black/30 transition-colors overflow-hidden">
            {#if item.thumbnail}
              <img src={item.thumbnail} alt={item.title} class="w-full h-full object-cover" />
            {:else}
              <div class="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
              </div>
            {/if}
            
            <!-- Overlay Actions -->
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
              <button on:click={() => openPreview(item)} class="btn btn-circle btn-sm bg-white text-black border-none hover:bg-neon-blue hover:text-white transition-colors" title="Play">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
              </button>
              <button on:click={() => redownload(item)} class="btn btn-circle btn-sm bg-white text-black border-none hover:bg-neon-pink hover:text-white transition-colors" title="Redownload">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button on:click={() => deleteItem(item.id)} class="btn btn-circle btn-sm bg-white text-black border-none hover:bg-red-500 hover:text-white transition-colors" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <div class="p-4 flex-1 flex flex-col">
            <h3 class="font-medium text-white truncate mb-1" title={item.title}>{item.title}</h3>
            <div class="flex justify-between items-center text-xs text-gray-400 mt-auto">
              <span>{item.format.toUpperCase()}</span>
              <span>{new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Preview Modal -->
<dialog id="preview_modal" class="modal">
  <div class="modal-box w-11/12 max-w-5xl bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-xl">
    {#if previewItem}
      <h3 class="font-bold text-lg text-[var(--text-color)] mb-4 truncate">{previewItem.title}</h3>
      <div class="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
        {#if previewItem.format === 'mp3'}
          <div class="flex flex-col items-center gap-4 p-8">
            {#if previewItem.thumbnail}
              <img src={previewItem.thumbnail} alt="Cover" class="w-48 h-48 rounded-lg shadow-2xl object-cover" />
            {/if}
            <audio controls class="w-full max-w-md" src="/files/{previewItem.relPath}" autoplay></audio>
          </div>
        {:else}
          <!-- svelte-ignore a11y-media-has-caption -->
          <video controls class="w-full h-full" src="/files/{previewItem.relPath}" autoplay></video>
        {/if}
      </div>
    {/if}
    <div class="modal-action">
      <form method="dialog">
        <button class="btn btn-ghost text-[var(--text-color)]" on:click={closePreview}>Close</button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button on:click={closePreview}>close</button>
  </form>
</dialog>

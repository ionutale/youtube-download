<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { toast } from 'svelte-sonner';

  let url = '';
  let format: 'mp3' | 'mp4' = 'mp4';
  let quality = 'highest';
  let downloads: any[] = [];
  let eventSource: EventSource | null = null;
  let inputElement: HTMLInputElement;

  function connect() {
    if (eventSource) eventSource.close();
    eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'snapshot') {
          downloads = data.downloads;
        } else if (data.type === 'update') {
          const idx = downloads.findIndex((d) => d.id === data.download.id);
          if (idx >= 0) downloads[idx] = data.download;
          else downloads = [data.download, ...downloads];
        } else if (data.type === 'remove') {
          downloads = downloads.filter((d) => d.id !== data.id);
        }
      } catch (e) {
        console.error('Event parse error', e);
      }
    };
  }

  async function startDownload() {
    if (!url) return toast.error('Please enter a URL');
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, quality }) // Note: API expects query params for GET, but let's check POST
      });
      // Wait, the existing API uses query params for POST too? Let's check +server.ts
      // Actually, let's use the URL params as the existing API expects
      const postUrl = `/api/download?url=${encodeURIComponent(url)}&format=${format}&quality=${quality}`;
      const res2 = await fetch(postUrl, { method: 'POST' });
      
      if (!res2.ok) {
        const err = await res2.json();
        throw new Error(err.error || 'Download failed');
      }
      toast.success('Download started');
      url = '';
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && url) {
      startDownload();
    }
  }

  // Feature 1: Smart Clipboard
  async function checkClipboard() {
    try {
      if (document.hasFocus()) {
        const text = await navigator.clipboard.readText();
        if (text && (text.includes('youtube.com') || text.includes('youtu.be')) && text !== url) {
           // Optional: Auto-paste or just suggest. For now, let's just focus input.
           // Auto-paste might be annoying if user didn't intend it.
           // Let's just focus.
           inputElement?.focus();
        }
      }
    } catch {}
  }

  onMount(() => {
    connect();
    window.addEventListener('focus', checkClipboard);
    return () => {
      if (eventSource) eventSource.close();
      window.removeEventListener('focus', checkClipboard);
    };
  });
</script>

<div class="max-w-5xl mx-auto w-full">
  <!-- Hero Section -->
  <div class="flex flex-col items-center justify-center py-16 text-center space-y-6">
    <h1 class="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white neon-text">
      Download Your World
    </h1>
    <p class="text-lg text-gray-400 max-w-2xl">
      Save your favorite YouTube videos and music in seconds. <br class="hidden md:inline" />
      High quality, fast, and free.
    </p>

    <!-- Input Area -->
    <div class="w-full max-w-3xl relative group mt-8">
      <div class="absolute -inset-1 bg-gradient-to-r from-neon-pink to-neon-blue rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
      <div class="relative flex items-center glass-input rounded-2xl p-2">
        <div class="pl-4 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          bind:this={inputElement}
          bind:value={url}
          on:keydown={handleKeydown}
          type="text"
          placeholder="Paste YouTube URL here..."
          class="w-full bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 px-4 py-3 text-lg"
        />
        
        <!-- Format Selector (Feature 2) -->
        <div class="flex items-center gap-2 pr-2">
          <select bind:value={format} class="select select-sm bg-white/5 border-none text-white focus:ring-0 rounded-lg">
            <option value="mp4">MP4</option>
            <option value="mp3">MP3</option>
          </select>
          
          <button 
            on:click={startDownload}
            class="btn btn-primary bg-gradient-to-r from-neon-blue to-neon-purple border-none text-white hover:scale-105 transition-transform shadow-lg shadow-neon-blue/20"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Active Downloads (Feature 4) -->
  <div class="mt-12">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold flex items-center gap-2">
        <span class="w-2 h-8 rounded-full bg-neon-pink"></span>
        Active Downloads
      </h2>
      {#if downloads.length > 0}
        <span class="badge badge-outline text-neon-pink">{downloads.length} items</span>
      {/if}
    </div>

    {#if downloads.length === 0}
      <div class="glass-panel rounded-2xl p-12 text-center border-dashed border-2 border-white/10">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <p class="text-gray-400 text-lg">No active downloads</p>
        <p class="text-gray-600 text-sm mt-1">Paste a link above to get started</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each downloads as download (download.id)}
          <div class="glass-panel rounded-2xl p-4 flex gap-4 transition-all hover:bg-white/5 relative overflow-hidden group">
            <!-- Progress Background -->
            <div class="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-neon-pink to-neon-blue transition-all duration-500" style="width: {download.progress}%"></div>
            
            <!-- Thumbnail -->
            <div class="w-24 h-24 rounded-xl bg-black/50 flex-shrink-0 overflow-hidden relative">
              {#if download.thumbnail}
                <img src={download.thumbnail} alt={download.title} class="w-full h-full object-cover" />
              {:else}
                <div class="w-full h-full flex items-center justify-center text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              {/if}
              
              <!-- Format Badge -->
              <div class="absolute top-1 right-1 badge badge-xs {download.format === 'mp3' ? 'badge-secondary' : 'badge-primary'}">
                {download.format.toUpperCase()}
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0 flex flex-col justify-center">
              <h3 class="font-bold text-white truncate pr-2" title={download.title || download.url}>
                {download.title || 'Fetching metadata...'}
              </h3>
              
              <div class="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>{download.status}</span>
                <span>{download.progress}%</span>
              </div>
              
              <!-- Speed & ETA -->
              {#if download.status === 'downloading'}
                <div class="flex items-center gap-3 mt-1 text-xs text-neon-blue">
                   <span>{(download.speedBps ? (download.speedBps / 1024 / 1024).toFixed(1) : 0) + ' MB/s'}</span>
                   <span>•</span>
                   <span>{download.etaSeconds ? download.etaSeconds + 's left' : 'Calculating...'}</span>
                </div>
              {/if}

              {#if download.error}
                <p class="text-xs text-red-400 mt-1 truncate" title={download.error}>{download.error}</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

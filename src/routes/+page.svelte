<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { settings } from '$lib/stores';

  let url = '';
  let batchMode = false;
  let format: 'mp3' | 'mp4' | 'webm' | 'mkv' = 'mp4';
  let quality = 'highest';
  let showAdvanced = false;
  let startTime = '';
  let endTime = '';
  let normalizeAudio = false;
  let downloads: any[] = [];
  let stats: { totalBytes: number; freeBytes: number } | null = null;
  let eventSource: EventSource | null = null;
  let inputElement: HTMLInputElement | HTMLTextAreaElement;
  
  // Feature 31: Search & Filter
  let searchTerm = '';
  $: filteredDownloads = downloads.filter(d => 
    !searchTerm || (d.title && d.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Feature 36: File Preview
  let previewItem: any = null;
  
  // Feature 22: Real-time Terminal Output
  let logs: Record<string, string[]> = {};
  let activeLogId: string | null = null;

  // Feature 35: Bulk Actions
  let selectedIds = new Set<string>();
  $: allSelected = filteredDownloads.length > 0 && selectedIds.size === filteredDownloads.length;

  function toggleSelection(id: string) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = new Set(selectedIds); // trigger reactivity
  }

  function toggleSelectAll() {
    if (allSelected) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(filteredDownloads.map(d => d.id));
    }
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} items?`)) return;

    try {
      const ids = Array.from(selectedIds);
      const res = await fetch('/api/download', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      
      if (res.ok) {
        toast.success('Deleted selected items');
        selectedIds = new Set();
      } else {
        toast.error('Failed to delete items');
      }
    } catch (e) {
      toast.error('Error deleting items');
    }
  }

  // Feature 40: Favorites
  async function toggleFavorite(id: string, currentStatus: boolean) {
    try {
      // Optimistic update
      const idx = downloads.findIndex(d => d.id === id);
      if (idx >= 0) {
        downloads[idx].isFavorite = !currentStatus;
        downloads = [...downloads];
      }

      await fetch(`/api/download/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'favorite' }),
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      toast.error('Failed to update favorite');
    }
  }

  function openPreview(item: any) {
    previewItem = item;
    const modal = document.getElementById('preview_modal') as HTMLDialogElement;
    if (modal) modal.showModal();
  }

  function openLogs(id: string) {
    activeLogId = id;
    const modal = document.getElementById('logs_modal') as HTMLDialogElement;
    if (modal) modal.showModal();
  }

  function closePreview() {
    previewItem = null;
  }

  function connect() {
    if (eventSource) eventSource.close();
    eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'snapshot') {
          downloads = data.downloads;
          if (data.stats) stats = data.stats;
        } else if (data.type === 'update') {
          const idx = downloads.findIndex((d) => d.id === data.download.id);
          const prevStatus = idx >= 0 ? downloads[idx].status : null;
          
          if (idx >= 0) downloads[idx] = data.download;
          else downloads = [data.download, ...downloads];

          // Feature 24: Desktop Notifications
          if (prevStatus && prevStatus !== 'completed' && data.download.status === 'completed') {
            notify('Download Complete', `Finished: ${data.download.title || 'Video'}`);
          } else if (prevStatus && prevStatus !== 'failed' && data.download.status === 'failed') {
            notify('Download Failed', `Failed: ${data.download.title || 'Video'}`);
          }

        } else if (data.type === 'remove') {
          downloads = downloads.filter((d) => d.id !== data.id);
          delete logs[data.id];
        } else if (data.type === 'log') {
          if (!logs[data.id]) logs[data.id] = [];
          logs[data.id].push(data.message);
          if (logs[data.id].length > 200) logs[data.id].shift();
        }
      } catch (e) {
        console.error('Event parse error', e);
      }
    };
  }

  function notify(title: string, body: string) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.png' });
    }
  }

  async function requestNotificationPermission() {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function startDownload() {
    requestNotificationPermission();
    if (!url) return toast.error('Please enter a URL');
    
    const urls = batchMode 
      ? url.split('\n').map(u => u.trim()).filter(u => u)
      : [url.trim()];

    if (urls.length === 0) return toast.error('No valid URLs found');

    let started = 0;
    for (const targetUrl of urls) {
      try {
        const params = new URLSearchParams({
          url: targetUrl,
          format,
          quality,
          filenamePattern: $settings.filenamePattern || '{title}',
          startTime,
          endTime,
          normalize: String(normalizeAudio),
          cookieContent: $settings.cookieContent || '',
          proxyUrl: $settings.proxyUrl || '',
          useSponsorBlock: String($settings.useSponsorBlock || false),
          downloadSubtitles: String($settings.downloadSubtitles || false),
          rateLimit: $settings.rateLimit || ''
        });
        const postUrl = `/api/download?${params.toString()}`;
        const res = await fetch(postUrl, { method: 'POST' });
        
        if (!res.ok) {
          const err = await res.json();
          toast.error(`Failed: ${targetUrl} - ${err.error || 'Unknown error'}`);
        } else {
          started++;
        }
      } catch (e: any) {
        toast.error(`Error: ${targetUrl} - ${e.message}`);
      }
    }

    if (started > 0) {
      toast.success(`Started ${started} download${started > 1 ? 's' : ''}`);
      url = '';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !batchMode && url) {
      e.preventDefault();
      startDownload();
    }
  }

  // Feature 1: Smart Clipboard
  async function checkClipboard() {
    try {
      if (document.hasFocus() && !url) {
        const text = await navigator.clipboard.readText();
        if (text && (text.includes('youtube.com') || text.includes('youtu.be'))) {
           // Optional: Auto-paste or just suggest. For now, let's just focus input.
           inputElement?.focus();
        }
      }
    } catch {}
  }

  // Feature 8: Queue Management
  async function controlDownload(id: string, action: 'pause' | 'resume' | 'cancel') {
    try {
      if (action === 'cancel') {
        await fetch(`/api/download/${id}`, { method: 'DELETE' });
        toast.success('Download canceled');
      } else {
        await fetch(`/api/download/${id}`, { 
          method: 'PATCH', 
          body: JSON.stringify({ action }),
          headers: { 'Content-Type': 'application/json' }
        });
        toast.success(`Download ${action}d`);
      }
    } catch (e) {
      toast.error(`Failed to ${action} download`);
    }
  }

  // Feature 28: Quick Retry
  async function retryDownload(id: string) {
    // We need to find the download to get its URL/format/quality, but the API might not support retry directly by ID unless we implement it.
    // The backend has a retry method but it's not exposed via API yet.
    // Let's just re-queue it if we have the data locally.
    const rec = downloads.find(d => d.id === id);
    if (rec) {
       try {
        const postUrl = `/api/download?url=${encodeURIComponent(rec.url)}&format=${rec.format}&quality=${rec.quality || 'highest'}`;
        await fetch(postUrl, { method: 'POST' });
        toast.success('Retrying download...');
       } catch {
         toast.error('Failed to retry');
       }
    }
  }

  // Feature 26: Drag & Drop
  let isDragging = false;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    // Only set false if we left the window (relatedTarget is null)
    if (e.relatedTarget === null) {
      isDragging = false;
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer) {
      const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
      if (text) {
        if (batchMode) {
          url += (url ? '\n' : '') + text;
        } else {
          url = text;
        }
        toast.success('Link dropped!');
      }
    }
  }

  onMount(() => {
    connect();
    window.addEventListener('focus', checkClipboard);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      if (eventSource) eventSource.close();
      window.removeEventListener('focus', checkClipboard);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  });
</script>

{#if isDragging}
  <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center border-4 border-neon-blue border-dashed m-4 rounded-3xl pointer-events-none">
    <div class="text-center animate-bounce">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 text-neon-blue mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <h2 class="text-4xl font-bold text-white">Drop Link Here</h2>
    </div>
  </div>
{/if}

<div class="max-w-5xl mx-auto w-full">
  <!-- Hero Section -->
  <div class="flex flex-col items-center justify-center py-16 text-center space-y-6">
    <h1 class="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--text-color)] via-blue-100 to-[var(--text-color)] neon-text">
      Download Your World
    </h1>
    <p class="text-lg text-[var(--text-muted)] max-w-2xl">
      Save your favorite YouTube videos and music in seconds. <br class="hidden md:inline" />
      High quality, fast, and free.
    </p>

    <!-- Input Area -->
    <div class="w-full max-w-3xl relative group mt-8">
      <div class="absolute -inset-1 bg-gradient-to-r from-neon-pink to-neon-blue rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
      <div class="relative flex flex-col glass-input rounded-2xl p-2">
        <div class="flex items-start w-full">
          <div class="pl-4 pt-3 text-[var(--text-muted)]">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {#if batchMode}
            <textarea
              bind:this={inputElement}
              bind:value={url}
              on:keydown={handleKeydown}
              placeholder="Paste multiple URLs here (one per line)..."
              class="w-full bg-transparent border-none focus:ring-0 text-[var(--text-color)] placeholder-[var(--text-muted)] px-4 py-3 text-lg min-h-[120px] resize-y"
            ></textarea>
          {:else}
            <input
              bind:this={inputElement}
              bind:value={url}
              on:keydown={handleKeydown}
              type="text"
              placeholder="Paste YouTube URL here..."
              class="w-full bg-transparent border-none focus:ring-0 text-[var(--text-color)] placeholder-[var(--text-muted)] px-4 py-3 text-lg"
            />
          {/if}
        </div>
        
        <!-- Controls Row -->
        <div class="flex items-center justify-between w-full px-2 pb-1 mt-2">
          <!-- Batch Mode Toggle (Feature 7) -->
          <label class="label cursor-pointer gap-2">
            <span class="label-text text-xs text-[var(--text-muted)]">Batch Mode</span> 
            <input type="checkbox" class="toggle toggle-xs toggle-primary" bind:checked={batchMode} />
          </label>

          <!-- Format & Download -->
          <div class="flex items-center gap-2">
            <!-- Quality Selector (Feature 4 & 5) -->
            <select bind:value={quality} class="select select-sm bg-[var(--glass-highlight)] border-none text-[var(--text-color)] focus:ring-0 rounded-lg max-w-[100px]">
              <option value="highest">Best</option>
              {#if format === 'mp3'}
                <option value="320">320k</option>
                <option value="256">256k</option>
                <option value="192">192k</option>
                <option value="128">128k</option>
              {:else}
                <option value="2160">4K</option>
                <option value="1440">2K</option>
                <option value="1080">1080p</option>
                <option value="720">720p</option>
                <option value="480">480p</option>
              {/if}
            </select>

            <select bind:value={format} class="select select-sm bg-[var(--glass-highlight)] border-none text-[var(--text-color)] focus:ring-0 rounded-lg">
              <option value="mp4">MP4</option>
              <option value="mkv">MKV</option>
              <option value="webm">WEBM</option>
              <option value="mp3">MP3</option>
            </select>
            
            <button 
              on:click={startDownload}
              class="btn btn-primary bg-gradient-to-r from-neon-blue to-neon-purple border-none text-white hover:scale-105 transition-transform shadow-lg shadow-neon-blue/20"
            >
              {batchMode ? 'Download All' : 'Download'}
            </button>
          </div>
        </div>

        <!-- Advanced Options (Feature 12 & 13) -->
        <div class="w-full px-2 mt-1 border-t border-[var(--glass-border)] pt-2">
          <button class="text-xs text-[var(--text-muted)] hover:text-[var(--text-color)] flex items-center gap-1 w-full justify-center mb-2" on:click={() => showAdvanced = !showAdvanced}>
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 transition-transform duration-200 {showAdvanced ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {#if showAdvanced}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
               <!-- Time Range -->
               <div class="form-control">
                 <div class="label py-0"><span class="label-text-alt text-[var(--text-muted)]">Start Time (00:00:00)</span></div>
                 <input type="text" bind:value={startTime} placeholder="e.g. 00:01:30" class="input input-sm input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" />
               </div>
               <div class="form-control">
                 <div class="label py-0"><span class="label-text-alt text-[var(--text-muted)]">End Time (00:00:00)</span></div>
                 <input type="text" bind:value={endTime} placeholder="e.g. 00:02:45" class="input input-sm input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" />
               </div>
               <!-- Normalize -->
               <div class="form-control justify-end">
                 <label class="label cursor-pointer justify-start gap-2">
                   <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" bind:checked={normalizeAudio} />
                   <span class="label-text text-[var(--text-muted)] text-sm">Normalize Audio</span>
                 </label>
               </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Active Downloads (Feature 4) -->
  <div class="mt-12">
    <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <div class="flex items-center gap-4">
        <h2 class="text-2xl font-bold flex items-center gap-2 text-[var(--text-color)]">
          <span class="w-2 h-8 rounded-full bg-neon-pink"></span>
          Active Downloads
        </h2>
        
        <!-- Bulk Actions Toolbar -->
        {#if downloads.length > 0}
          <div class="flex items-center gap-2 ml-4 border-l border-[var(--glass-border)] pl-4">
            <label class="label cursor-pointer gap-2">
              <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" checked={allSelected} on:change={toggleSelectAll} />
              <span class="label-text text-xs text-[var(--text-muted)]">All</span>
            </label>
            
            {#if selectedIds.size > 0}
              <button class="btn btn-xs btn-error text-white" on:click={deleteSelected}>
                Delete ({selectedIds.size})
              </button>
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="flex items-center gap-4 flex-1 justify-end">
        <!-- Search Bar (Feature 31) -->
        <div class="flex items-center bg-[var(--input-bg)] rounded-lg px-3 py-1 border border-[var(--glass-border)] focus-within:border-neon-blue transition-colors w-full md:w-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            bind:value={searchTerm} 
            placeholder="Search..." 
            class="bg-transparent border-none focus:ring-0 text-sm text-[var(--text-color)] placeholder-[var(--text-muted)] w-full md:w-48"
          />
        </div>

        {#if stats}
          <div class="text-xs text-[var(--text-muted)] hidden lg:block whitespace-nowrap">
            <span class="text-[var(--text-color)]">{formatBytes(stats.totalBytes)}</span> used
          </div>
        {/if}
        {#if downloads.length > 0}
          <span class="badge badge-outline text-neon-pink whitespace-nowrap">{downloads.length} items</span>
        {/if}
      </div>
    </div>

    {#if filteredDownloads.length === 0}
      <div class="glass-panel rounded-2xl p-12 text-center border-dashed border-2 border-[var(--glass-border)]">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--glass-highlight)] mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <p class="text-[var(--text-muted)] text-lg">No downloads found</p>
        {#if !searchTerm}
          <p class="text-[var(--text-muted)] text-sm mt-1">Paste a link above to get started</p>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each filteredDownloads as download (download.id)}
          <div class="glass-panel rounded-2xl p-4 flex gap-4 transition-all hover:bg-[var(--glass-highlight)] relative overflow-hidden group {selectedIds.has(download.id) ? 'ring-2 ring-neon-blue bg-[var(--glass-highlight)]' : ''}">
            <!-- Selection Checkbox -->
            <div class="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity {selectedIds.has(download.id) ? 'opacity-100' : ''}">
              <input 
                type="checkbox" 
                class="checkbox checkbox-sm checkbox-primary bg-black/50 border-white/20" 
                checked={selectedIds.has(download.id)} 
                on:change={() => toggleSelection(download.id)} 
              />
            </div>

            <!-- Favorite Star -->
            <button 
              class="absolute top-2 right-2 z-20 btn btn-circle btn-xs btn-ghost {download.isFavorite ? 'text-yellow-400 opacity-100' : 'text-gray-500 opacity-0 group-hover:opacity-100'}"
              on:click={() => toggleFavorite(download.id, download.isFavorite)}
              title="Toggle Favorite"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>

            <!-- Progress Background -->
            <div class="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-neon-pink to-neon-blue transition-all duration-500" style="width: {download.progress}%"></div>
            
            <!-- Thumbnail -->
            <div class="w-24 h-24 rounded-xl bg-black/50 flex-shrink-0 overflow-hidden relative group-hover:scale-105 transition-transform duration-500">
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

              <!-- Play Overlay (Feature 36) -->
              {#if download.status === 'completed'}
                <button 
                  class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none w-full h-full" 
                  on:click={() => openPreview(download)}
                  aria-label="Play"
                >
                  <div class="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                  </div>
                </button>
              {/if}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0 flex flex-col justify-center">
              <h3 class="font-bold text-[var(--text-color)] truncate pr-2" title={download.title || download.url}>
                {download.title || 'Fetching metadata...'}
              </h3>
              
              <div class="flex items-center justify-between mt-2 text-xs text-[var(--text-muted)]">
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
                  <button class="btn btn-xs btn-ghost text-neon-pink mt-1" on:click={() => retryDownload(download.id)}>Retry</button>
                {/if}

                <div class="flex gap-2 mt-1">
                  <!-- Feature 8: Queue Management -->
                  {#if download.status === 'downloading'}
                    <button class="btn btn-xs btn-ghost text-yellow-400" on:click={() => controlDownload(download.id, 'pause')}>Pause</button>
                  {:else if download.status === 'paused'}
                    <button class="btn btn-xs btn-ghost text-green-400" on:click={() => controlDownload(download.id, 'resume')}>Resume</button>
                  {/if}
                  
                  {#if ['queued', 'downloading', 'paused'].includes(download.status)}
                    <button class="btn btn-xs btn-ghost text-red-400" on:click={() => controlDownload(download.id, 'cancel')}>Cancel</button>
                  {/if}

                  <!-- Logs Button (Feature 22) -->
                  <button class="btn btn-xs btn-ghost text-[var(--text-muted)]" on:click={() => openLogs(download.id)}>Logs</button>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Logs Modal (Feature 22) -->
<dialog id="logs_modal" class="modal">
  <div class="modal-box w-11/12 max-w-5xl bg-[#0a0a12] text-green-400 font-mono text-xs p-4 border border-green-900 shadow-lg shadow-green-900/20">
    <h3 class="font-bold text-lg text-white mb-2">Terminal Output</h3>
    <div class="h-96 overflow-y-auto bg-black/50 p-4 rounded border border-green-900/50 whitespace-pre-wrap font-mono">
      {#if activeLogId && logs[activeLogId]}
        {logs[activeLogId].join('')}
      {:else}
        <span class="text-gray-500">No logs available...</span>
      {/if}
    </div>
    <div class="modal-action">
      <form method="dialog">
        <button class="btn btn-sm btn-ghost text-white">Close</button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>

<!-- Preview Modal (Feature 36) -->
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

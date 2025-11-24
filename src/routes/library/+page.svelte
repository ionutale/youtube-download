<script lang="ts">
  import { onMount } from 'svelte';

  type FileItem = {
    name: string;
    size: number;
    mtime: string;
    url: string;
  };

  let files: FileItem[] = [];
  let loading = true;
  let error: string | null = null;
  let searchQuery = '';
  let filter: 'all' | 'audio' | 'video' = 'all';

  async function loadFiles() {
    loading = true;
    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error('Failed to load files');
      const data = await res.json();
      files = data.files;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function isAudio(name: string) {
    return name.endsWith('.mp3') || name.endsWith('.m4a') || name.endsWith('.wav');
  }

  function isVideo(name: string) {
    return name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mkv');
  }

  $: filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' 
      ? true 
      : filter === 'audio' 
        ? isAudio(file.name) 
        : isVideo(file.name);
    return matchesSearch && matchesFilter;
  });

  onMount(() => {
    loadFiles();
  });
</script>

<div class="max-w-7xl mx-auto w-full">
  <div class="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
    <div>
      <h1 class="text-3xl font-bold flex items-center gap-2">
        <span class="w-2 h-8 rounded-full bg-neon-purple"></span>
        Library
      </h1>
      <p class="text-gray-400 text-sm mt-1">Manage your downloaded content</p>
    </div>

    <!-- Search & Filter (Feature 23, 25) -->
    <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
      <div class="relative">
        <input 
          type="text" 
          bind:value={searchQuery}
          placeholder="Search files..." 
          class="input input-bordered bg-white/5 border-glass-border focus:border-neon-purple text-white w-full sm:w-64 pl-10 rounded-xl"
        />
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      
      <div class="join bg-white/5 border border-glass-border rounded-xl p-1">
        <button 
          class="join-item btn btn-sm border-none {filter === 'all' ? 'bg-white/10 text-white' : 'bg-transparent text-gray-400 hover:text-white'}"
          on:click={() => filter = 'all'}
        >All</button>
        <button 
          class="join-item btn btn-sm border-none {filter === 'audio' ? 'bg-white/10 text-neon-pink' : 'bg-transparent text-gray-400 hover:text-white'}"
          on:click={() => filter = 'audio'}
        >Audio</button>
        <button 
          class="join-item btn btn-sm border-none {filter === 'video' ? 'bg-white/10 text-neon-blue' : 'bg-transparent text-gray-400 hover:text-white'}"
          on:click={() => filter = 'video'}
        >Video</button>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center p-20">
      <span class="loading loading-dots loading-lg text-neon-purple"></span>
    </div>
  {:else if error}
    <div class="alert alert-error glass-panel">
      <span>{error}</span>
    </div>
  {:else if filteredFiles.length === 0}
    <div class="glass-panel rounded-2xl p-16 text-center border-dashed border-2 border-white/10">
      <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 class="text-xl font-bold text-gray-300">No files found</h3>
      <p class="text-gray-500 mt-2">Try adjusting your search or download something new.</p>
    </div>
  {:else}
    <!-- Grid View (Feature 24) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each filteredFiles as file}
        <div class="glass-panel rounded-2xl overflow-hidden group hover:border-neon-purple/50 transition-all duration-300 hover:-translate-y-1">
          <!-- Preview / Icon Area -->
          <div class="aspect-video bg-black/40 relative flex items-center justify-center group-hover:bg-black/30 transition-colors">
            {#if isAudio(file.name)}
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-neon-pink to-neon-purple flex items-center justify-center shadow-lg shadow-neon-pink/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            {:else}
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-neon-blue to-cyan-500 flex items-center justify-center shadow-lg shadow-neon-blue/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            {/if}
            
            <!-- Overlay Actions -->
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
              <a href={file.url} download={file.name} class="btn btn-circle btn-sm bg-white text-black border-none hover:bg-neon-blue hover:text-white transition-colors" title="Download">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
              {#if isVideo(file.name)}
                <a href={file.url} target="_blank" class="btn btn-circle btn-sm bg-white text-black border-none hover:bg-neon-pink hover:text-white transition-colors" title="Play">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                </a>
              {/if}
            </div>
          </div>

          <div class="p-4">
            <h3 class="font-medium text-white truncate mb-1" title={file.name}>{file.name}</h3>
            <div class="flex justify-between items-center text-xs text-gray-400">
              <span>{formatSize(file.size)}</span>
              <span>{new Date(file.mtime).toLocaleDateString()}</span>
            </div>
            
            {#if isAudio(file.name)}
              <div class="mt-3">
                <audio controls class="w-full h-8 opacity-70 hover:opacity-100 transition-opacity" src={file.url} preload="none"></audio>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

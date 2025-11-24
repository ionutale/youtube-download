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
  let currentAudio: string | null = null;

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

  onMount(() => {
    loadFiles();
  });
</script>

<div class="container mx-auto p-4 max-w-4xl">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold">Library</h1>
    <a href="/" class="btn btn-outline">Back to Downloader</a>
  </div>

  {#if loading}
    <div class="flex justify-center p-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <span>{error}</span>
    </div>
  {:else if files.length === 0}
    <div class="text-center p-8 bg-base-200 rounded-lg">
      <p class="text-lg opacity-70">No files found in the library.</p>
    </div>
  {:else}
    <div class="grid gap-4">
      {#each files as file}
        <div class="card bg-base-100 shadow-md border border-base-200">
          <div class="card-body p-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-lg truncate" title={file.name}>{file.name}</h3>
                <p class="text-sm opacity-60">
                  {formatSize(file.size)} • {new Date(file.mtime).toLocaleString()}
                </p>
              </div>
              
              <div class="flex items-center gap-2 w-full sm:w-auto">
                {#if file.name.endsWith('.mp3') || file.name.endsWith('.m4a') || file.name.endsWith('.wav')}
                  <audio controls class="h-10 w-full sm:w-48" src={file.url} preload="none"></audio>
                {:else if file.name.endsWith('.mp4') || file.name.endsWith('.webm')}
                   <!-- Video preview could go here, but keeping it simple with download/open -->
                   <a href={file.url} target="_blank" class="btn btn-sm btn-ghost">Open</a>
                {/if}
                
                <a href={file.url} download={file.name} class="btn btn-sm btn-primary">
                  Download
                </a>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

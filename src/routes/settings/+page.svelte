<script lang="ts">
  import { settings } from '$lib/stores';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  let pattern = $settings.filenamePattern;
  let proxyUrl = $settings.proxyUrl || '';
  let cookieContent = $settings.cookieContent || '';
  let useSponsorBlock = $settings.useSponsorBlock || false;
  let downloadSubtitles = $settings.downloadSubtitles || false;
  let rateLimit = $settings.rateLimit || '';
  let organizeByUploader = $settings.organizeByUploader || false;
  let splitChapters = $settings.splitChapters || false;
  let primaryColor = $settings.primaryColor || '#00ffff';

  // System Stats
  let systemStats: any = null;
  let retentionDays = 0;

  onMount(async () => {
    loadSystemStats();
  });

  async function loadSystemStats() {
    try {
      const res = await fetch('/api/system');
      const data = await res.json();
      systemStats = data;
      retentionDays = data.settings.retentionDays;
    } catch (e) {
      console.error('Failed to load system stats', e);
    }
  }

  async function saveRetention() {
    try {
      await fetch('/api/system', {
        method: 'POST',
        body: JSON.stringify({ retentionDays }),
        headers: { 'Content-Type': 'application/json' }
      });
      toast.success('Retention settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function save() {
    settings.update(s => ({ 
      ...s, 
      filenamePattern: pattern,
      proxyUrl,
      cookieContent,
      useSponsorBlock,
      downloadSubtitles,
      rateLimit,
      organizeByUploader,
      splitChapters,
      primaryColor
    }));
  }

  // Auto-save on change
  $: {
    if (pattern !== $settings.filenamePattern || 
        proxyUrl !== $settings.proxyUrl ||
        cookieContent !== $settings.cookieContent ||
        useSponsorBlock !== $settings.useSponsorBlock ||
        downloadSubtitles !== $settings.downloadSubtitles ||
        rateLimit !== $settings.rateLimit ||
        organizeByUploader !== $settings.organizeByUploader ||
        splitChapters !== $settings.splitChapters ||
        primaryColor !== $settings.primaryColor) {
      save();
    }
  }
</script>

<div class="max-w-4xl mx-auto w-full pb-20">
  <h1 class="text-3xl font-bold text-[var(--text-color)] mb-8">Settings</h1>

  <div class="glass-panel rounded-2xl p-6 space-y-8">
    <!-- Appearance -->
    <section>
      <h2 class="text-xl font-semibold text-[var(--text-color)] mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-neon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        Appearance
      </h2>
      
      <div class="form-control w-full max-w-xs">
        <label class="label">
          <span class="label-text text-[var(--text-muted)]">Accent Color</span>
        </label>
        <div class="flex gap-2">
          <input 
            type="color" 
            bind:value={primaryColor} 
            class="input input-bordered w-12 p-1 h-10 bg-[var(--input-bg)] border-[var(--glass-border)]" 
          />
          <input 
            type="text" 
            bind:value={primaryColor} 
            class="input input-bordered flex-1 bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" 
          />
        </div>
      </div>
    </section>

    <!-- System Status (Feature 42 & 43) -->
    <section>
      <h2 class="text-xl font-semibold text-[var(--text-color)] mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-neon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        System Status
      </h2>

      {#if systemStats}
        <div class="text-xs font-mono text-[var(--text-muted)] mb-4 bg-black/20 p-2 rounded border border-[var(--glass-border)] truncate">
          Location: {systemStats.system.downloadDir}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <!-- Disk Usage -->
          <div class="bg-black/20 rounded-xl p-4">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-[var(--text-muted)]">Storage Usage</span>
              <span class="text-[var(--text-color)]">{formatBytes(systemStats.stats.totalBytes)} used</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2.5">
              <!-- We don't have total disk size easily without a library, so we just show used as a bar relative to free+used if available, or just a visual -->
              {#if systemStats.stats.freeBytes}
                {@const total = systemStats.stats.totalBytes + systemStats.stats.freeBytes}
                {@const pct = (systemStats.stats.totalBytes / total) * 100}
                <div class="bg-neon-pink h-2.5 rounded-full" style="width: {pct}%"></div>
                <div class="text-xs text-right mt-1 text-[var(--text-muted)]">{formatBytes(systemStats.stats.freeBytes)} free</div>
              {:else}
                <div class="bg-neon-pink h-2.5 rounded-full w-full animate-pulse"></div>
              {/if}
            </div>
          </div>

          <!-- Memory Usage -->
          <div class="bg-black/20 rounded-xl p-4">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-[var(--text-muted)]">Memory Usage</span>
              <span class="text-[var(--text-color)]">{formatBytes(systemStats.system.memory.total - systemStats.system.memory.free)} / {formatBytes(systemStats.system.memory.total)}</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2.5">
              <div class="bg-neon-blue h-2.5 rounded-full" style="width: {((systemStats.system.memory.total - systemStats.system.memory.free) / systemStats.system.memory.total) * 100}%"></div>
            </div>
          </div>
        </div>

        <!-- Auto Cleanup -->
        <div class="form-control w-full max-w-md">
          <label class="label">
            <span class="label-text text-[var(--text-muted)]">Auto-delete downloads after (days)</span>
          </label>
          <div class="flex gap-2">
            <input 
              type="number" 
              bind:value={retentionDays} 
              min="0"
              class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue w-full" 
            />
            <button class="btn btn-primary" on:click={saveRetention}>Save</button>
          </div>
          <label class="label">
            <span class="label-text-alt text-[var(--text-muted)]">Set to 0 to disable auto-cleanup.</span>
          </label>
        </div>
      {:else}
        <div class="flex justify-center p-4">
          <span class="loading loading-dots loading-md text-neon-blue"></span>
        </div>
      {/if}
    </section>

    <!-- Naming Pattern -->
    <section>
      <h2 class="text-xl font-semibold text-[var(--text-color)] mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-neon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        File Naming (Feature 17)
      </h2>
      
      <div class="form-control w-full max-w-md">
        <label class="label">
          <span class="label-text text-[var(--text-muted)]">Filename Pattern</span>
        </label>
        <input 
          type="text" 
          bind:value={pattern} 
          placeholder={'{title}'} 
          class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" 
        />
        <label class="label">
          <span class="label-text-alt text-[var(--text-muted)]">
            Available variables: <code class="bg-black/20 px-1 rounded">{'{title}'}</code>, <code class="bg-black/20 px-1 rounded">{'{id}'}</code>, <code class="bg-black/20 px-1 rounded">{'{uploader}'}</code>, <code class="bg-black/20 px-1 rounded">{'{date}'}</code>
          </span>
        </label>
      </div>
      
      <div class="mt-4 p-4 rounded-lg bg-black/20 text-sm text-[var(--text-muted)]">
        <p class="font-semibold mb-1">Preview:</p>
        <p class="font-mono text-neon-pink">
          {pattern
            .replace('{title}', 'Never Gonna Give You Up')
            .replace('{id}', 'dQw4w9WgXcQ')
            .replace('{uploader}', 'Rick Astley')
            .replace('{date}', new Date().toISOString().split('T')[0])
          }.mp4
        </p>
      </div>
    </section>

    <!-- Network Settings -->
    <section>
      <h2 class="text-xl font-semibold text-[var(--text-color)] mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-neon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Network & Access
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Proxy (Feature 9) -->
        <div class="form-control w-full">
          <label class="label">
            <span class="label-text text-[var(--text-muted)]">Proxy URL</span>
          </label>
          <input 
            type="text" 
            bind:value={proxyUrl} 
            placeholder="http://user:pass@host:port" 
            class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" 
          />
        </div>

        <!-- Rate Limit (Feature 47) -->
        <div class="form-control w-full">
          <label class="label">
            <span class="label-text text-[var(--text-muted)]">Rate Limit</span>
          </label>
          <input 
            type="text" 
            bind:value={rateLimit} 
            placeholder="e.g. 5M, 500K" 
            class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" 
          />
        </div>
      </div>

      <!-- Cookies (Feature 8) -->
      <div class="form-control w-full mt-4">
        <label class="label">
          <span class="label-text text-[var(--text-muted)]">Cookies (Netscape format)</span>
        </label>
        <textarea 
          bind:value={cookieContent} 
          placeholder="# Netscape HTTP Cookie File..." 
          class="textarea textarea-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue h-32 font-mono text-xs"
        ></textarea>
        <label class="label">
          <span class="label-text-alt text-[var(--text-muted)]">Paste content of cookies.txt here to access age-restricted videos.</span>
        </label>
      </div>
    </section>

    <!-- Advanced Features -->
    <section>
      <h2 class="text-xl font-semibold text-[var(--text-color)] mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-neon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Extras
      </h2>

      <div class="flex flex-col gap-4">
        <!-- SponsorBlock (Feature 16) -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" class="toggle toggle-primary" bind:checked={useSponsorBlock} />
            <div class="flex flex-col">
              <span class="label-text text-[var(--text-color)] font-bold">SponsorBlock</span>
              <span class="label-text-alt text-[var(--text-muted)]">Automatically skip sponsor segments</span>
            </div>
          </label>
        </div>

        <!-- Subtitles (Feature 3) -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" class="toggle toggle-primary" bind:checked={downloadSubtitles} />
            <div class="flex flex-col">
              <span class="label-text text-[var(--text-color)] font-bold">Download Subtitles</span>
              <span class="label-text-alt text-[var(--text-muted)]">Embed subtitles if available (auto-generated included)</span>
            </div>
          </label>
        </div>

        <!-- Organization (Feature 33) -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" class="toggle toggle-primary" bind:checked={organizeByUploader} />
            <div class="flex flex-col">
              <span class="label-text text-[var(--text-color)] font-bold">Organize by Uploader</span>
              <span class="label-text-alt text-[var(--text-muted)]">Save files into subfolders named after the channel</span>
            </div>
          </label>
        </div>

        <!-- Chapter Splitting (Feature 14) -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" class="toggle toggle-primary" bind:checked={splitChapters} />
            <div class="flex flex-col">
              <span class="label-text text-[var(--text-color)] font-bold">Split Chapters</span>
              <span class="label-text-alt text-[var(--text-muted)]">Create separate files for each video chapter</span>
            </div>
          </label>
        </div>
      </div>
    </section>

    <!-- Danger Zone -->
    <section class="border-t border-red-900/30 pt-6">
      <h2 class="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Danger Zone
      </h2>
      
      <div class="flex items-center justify-between p-4 border border-red-900/30 rounded-xl bg-red-900/10">
        <div>
          <h3 class="font-bold text-red-200">Clear All History</h3>
          <p class="text-xs text-red-300/70">Permanently delete all download records and files.</p>
        </div>
        <button 
          class="btn btn-error btn-sm text-white"
          on:click={async () => {
            if(confirm('Are you sure? This will delete ALL files.')) {
              await fetch('/api/history?all=true', { method: 'DELETE' });
              toast.success('History cleared');
              loadSystemStats(); // refresh stats
            }
          }}
        >
          Clear Everything
        </button>
      </div>
    </section>
  </div>
</div>

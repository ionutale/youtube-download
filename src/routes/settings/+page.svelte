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
  let downloadLyrics = $settings.downloadLyrics || false;
  let videoCodec = $settings.videoCodec || 'default';
  let embedMetadata = $settings.embedMetadata !== false; // Default true
  let embedThumbnail = $settings.embedThumbnail !== false; // Default true
  let primaryColor = $settings.primaryColor || '#00ffff';
  let language = $settings.language || 'en';

  // System Stats
  let systemStats: any = null;
  let retentionDays = 0;
  let webhookUrl = '';
  let scheduleEnabled = false;
  let scheduleStart = '00:00';
  let scheduleEnd = '06:00';
  let maxConcurrency = 2;
  let userAgent = '';

  let maxRetries = 0;
  let cloudSyncEnabled = false;
  let cloudProvider = 'google_drive';
  let apiKey = '';
  let showKey = false;
  let rssFeeds: string[] = [];
  let newFeedUrl = '';

  onMount(async () => {
    loadSystemStats();
  });

  async function loadSystemStats() {
    try {
      const res = await fetch('/api/system');
      const data = await res.json();
      systemStats = data;
      retentionDays = data.settings.retentionDays;
      webhookUrl = data.settings.webhookUrl || '';
      scheduleEnabled = data.settings.scheduleEnabled || false;
      scheduleStart = data.settings.scheduleStart || '00:00';
      scheduleEnd = data.settings.scheduleEnd || '06:00';
      maxConcurrency = data.settings.maxConcurrency || 2;
      userAgent = data.settings.userAgent || '';

      maxRetries = data.settings.maxRetries || 0;
      cloudSyncEnabled = data.settings.cloudSyncEnabled || false;
      cloudProvider = data.settings.cloudProvider || 'google_drive';

      apiKey = data.settings.apiKey || '';
      rssFeeds = data.settings.rssFeeds || [];
    } catch (e) {
      console.error('Failed to load system stats', e);
    }
  }

  async function saveSystemSettings() {
    try {
      await fetch('/api/system', {
        method: 'POST',
        body: JSON.stringify({ 
          retentionDays, 
          webhookUrl, 
          scheduleEnabled, 
          scheduleStart, 
          scheduleEnd,
          maxConcurrency,
          userAgent,

          maxRetries,
          cloudSyncEnabled,
          cloudProvider
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      toast.success('System settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  }



  async function addFeed() {
    if (!newFeedUrl) return;
    try {
      await fetch('/api/system/rss', {
        method: 'POST',
        body: JSON.stringify({ url: newFeedUrl }),
        headers: { 'Content-Type': 'application/json' }
      });
      rssFeeds = [...rssFeeds, newFeedUrl];
      newFeedUrl = '';
      toast.success('Feed added');
    } catch {
      toast.error('Failed to add feed');
    }
  }

  async function removeFeed(url: string) {
    try {
      await fetch(`/api/system/rss?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
      rssFeeds = rssFeeds.filter(f => f !== url);
      toast.success('Feed removed');
    } catch {
      toast.error('Failed to remove feed');
    }
  }

  async function generateKey() {
    try {
      const res = await fetch('/api/system/auth', { method: 'POST' });
      const data = await res.json();
      apiKey = data.apiKey;
      toast.success('New API Key generated');
    } catch {
      toast.error('Failed to generate key');
    }
  }

  async function revokeKey() {
    if (!confirm('Revoke API Key? External tools will stop working.')) return;
    try {
      await fetch('/api/system/auth', { method: 'DELETE' });
      apiKey = '';
      toast.success('API Key revoked');
    } catch {
      toast.error('Failed to revoke key');
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
      downloadLyrics,
      videoCodec,
      embedMetadata,
      embedThumbnail,
      primaryColor,
      language
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
        downloadLyrics !== $settings.downloadLyrics ||
        videoCodec !== $settings.videoCodec ||
        embedMetadata !== $settings.embedMetadata ||
        embedThumbnail !== $settings.embedThumbnail ||
        primaryColor !== $settings.primaryColor ||
        language !== $settings.language) {
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


      <div class="form-control w-full max-w-xs mt-4">
        <label class="label">
          <span class="label-text text-[var(--text-muted)]">Language</span>
        </label>
        <select bind:value={language} class="select select-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue">
          <option value="en">English</option>
          <option value="it">Italiano</option>
        </select>
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
          </div>
          <label class="label">
            <span class="label-text-alt text-[var(--text-muted)]">Set to 0 to disable auto-cleanup.</span>
          </label>
        </div>

        <!-- Webhook (Feature 43) -->
        <div class="form-control w-full max-w-md mt-4">
          <label class="label">
            <span class="label-text text-[var(--text-muted)]">Webhook URL</span>
          </label>
          <div class="flex gap-2">
            <input 
              type="text" 
              bind:value={webhookUrl} 
              placeholder="https://discord.com/api/webhooks/..." 
              class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue w-full" 
            />
          </div>
          <label class="label">
            <span class="label-text-alt text-[var(--text-muted)]">Send POST request on completion/failure.</span>
          </label>
        </div>

        <!-- Cloud Sync (Feature 46) -->
        <div class="form-control w-full max-w-md mt-4 border-t border-[var(--glass-border)] pt-4">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" class="toggle toggle-primary" bind:checked={cloudSyncEnabled} />
            <div class="flex flex-col">
              <span class="label-text text-[var(--text-color)] font-bold">Cloud Sync</span>
              <span class="label-text-alt text-[var(--text-muted)]">Automatically upload completed files</span>
            </div>
          </label>
          
          {#if cloudSyncEnabled}
            <div class="form-control w-full mt-2">
              <label class="label py-0"><span class="label-text-alt text-[var(--text-muted)]">Provider</span></label>
              <select bind:value={cloudProvider} class="select select-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue">
                <option value="google_drive">Google Drive</option>
                <option value="dropbox">Dropbox</option>
                <option value="s3">Amazon S3</option>
              </select>
            </div>
          {/if}
        </div>

        <!-- Scheduled Downloads (Feature 49) -->
        <div class="form-control w-full max-w-md mt-4 border-t border-[var(--glass-border)] pt-4">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" class="toggle toggle-primary" bind:checked={scheduleEnabled} />
            <div class="flex flex-col">
              <span class="label-text text-[var(--text-color)] font-bold">Enable Schedule</span>
              <span class="label-text-alt text-[var(--text-muted)]">Only download during specific hours</span>
            </div>
          </label>
          
          {#if scheduleEnabled}
            <div class="flex gap-4 mt-2">
              <div class="form-control w-full">
                <label class="label py-0"><span class="label-text-alt text-[var(--text-muted)]">Start Time</span></label>
                <input type="time" bind:value={scheduleStart} class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" />
              </div>
              <div class="form-control w-full">
                <label class="label py-0"><span class="label-text-alt text-[var(--text-muted)]">End Time</span></label>
                <input type="time" bind:value={scheduleEnd} class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" />
              </div>
            </div>
          {/if}
        </div>

        <!-- Max Concurrency (Feature 30) -->
        <div class="form-control w-full max-w-md mt-4">
          <label class="label">
            <span class="label-text text-[var(--text-muted)]">Max Concurrent Downloads</span>
          </label>
          <input 
            type="number" 
            bind:value={maxConcurrency} 
            min="1"
            max="10"
            class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue w-full" 
          />
        </div>

        <!-- User Agent (Feature 10) -->
        <div class="form-control w-full max-w-md mt-4">
          <label class="label">
            <span class="label-text text-[var(--text-muted)]">Custom User Agent</span>
          </label>
          <input 
            type="text" 
            bind:value={userAgent} 
            placeholder="Mozilla/5.0..." 
            class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue w-full" 
          />
        </div>

        <!-- Max Retries (Feature 29) -->
        <div class="form-control w-full max-w-md mt-4">
          <label class="label">
            <span class="label-text text-[var(--text-muted)]">Auto-Retry Attempts</span>
          </label>
          <input 
            type="number" 
            bind:value={maxRetries} 
            min="0"
            max="10"
            class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue w-full" 
          />
          <label class="label">
            <span class="label-text-alt text-[var(--text-muted)]">Number of times to retry failed downloads automatically.</span>
          </label>
        </div>

        <div class="mt-4">
          <button class="btn btn-primary" on:click={saveSystemSettings}>Save System Settings</button>
        </div>
      {:else}
        <div class="flex justify-center p-4">
          <span class="loading loading-dots loading-md text-neon-blue"></span>
        </div>
      {/if}
    </section>



    <!-- Security (Feature 42) -->
    <section>
      <h2 class="text-xl font-semibold text-[var(--text-color)] mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-neon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Security
      </h2>

      <div class="form-control w-full max-w-md">
        <label class="label">
          <span class="label-text text-[var(--text-color)] font-bold">API Key</span>
        </label>
        
        {#if apiKey}
          <div class="flex gap-2">
            <input 
              type={showKey ? "text" : "password"} 
              value={apiKey} 
              readonly
              class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue w-full font-mono text-sm" 
            />
            <button class="btn btn-square btn-ghost text-[var(--text-muted)]" on:click={() => showKey = !showKey}>
              {#if showKey}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              {/if}
            </button>
          </div>
          <div class="mt-2 flex gap-2">
            <button class="btn btn-sm btn-error btn-outline" on:click={revokeKey}>Revoke Key</button>
            <button class="btn btn-sm btn-ghost" on:click={() => { navigator.clipboard.writeText(apiKey); toast.success('Copied'); }}>Copy</button>
          </div>
        {:else}
          <div class="text-sm text-[var(--text-muted)] mb-2">No API Key configured. External access is open (or restricted depending on network).</div>
          <button class="btn btn-primary btn-sm" on:click={generateKey}>Generate API Key</button>
        {/if}
        <label class="label">
          <span class="label-text-alt text-[var(--text-muted)]">Use <code>x-api-key</code> header for external tools.</span>
        </label>
      </div>
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



    <!-- RSS Feeds (Feature 45) -->
    <section>
      <h2 class="text-xl font-semibold text-[var(--text-color)] mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-neon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
        RSS Feeds
      </h2>
      
      <div class="form-control w-full max-w-md mb-4">
        <label class="label">
          <span class="label-text text-[var(--text-muted)]">Add YouTube RSS Feed</span>
        </label>
        <div class="flex gap-2">
          <input 
            type="text" 
            bind:value={newFeedUrl} 
            placeholder="https://www.youtube.com/feeds/videos.xml?channel_id=..." 
            class="input input-bordered flex-1 bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" 
          />
          <button class="btn btn-primary" on:click={addFeed}>Add</button>
        </div>
      </div>

      {#if rssFeeds.length > 0}
        <div class="space-y-2 max-w-md">
          {#each rssFeeds as feed}
            <div class="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-[var(--glass-border)]">
              <span class="text-sm text-[var(--text-color)] truncate flex-1 mr-2" title={feed}>{feed}</span>
              <button class="btn btn-ghost btn-xs text-red-400 hover:bg-red-900/20" on:click={() => removeFeed(feed)}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-[var(--text-muted)]">No RSS feeds configured.</p>
      {/if}
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

        <!-- Max Concurrency (Feature 30) -->
        <div class="form-control w-full">
          <label class="label">
            <span class="label-text text-[var(--text-muted)]">Max Concurrent Downloads</span>
          </label>
          <input 
            type="number" 
            bind:value={maxConcurrency} 
            min="1"
            max="10"
            class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" 
          />
        </div>

        <!-- User Agent (Feature 10) -->
        <div class="form-control w-full">
          <label class="label">
            <span class="label-text text-[var,--text-muted)]">Custom User Agent</span>
          </label>
          <input 
            type="text" 
            bind:value={userAgent} 
            placeholder="Mozilla/5.0..." 
            class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" 
          />
        </div>

        <!-- Max Retries (Feature 29) -->
        <div class="form-control w-full">
          <label class="label">
            <span class="label-text text-[var(--text-muted)]">Auto-Retry Attempts</span>
          </label>
          <input 
            type="number" 
            bind:value={maxRetries} 
            min="0"
            max="10"
            class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" 
          />
          <label class="label">
            <span class="label-text-alt text-[var(--text-muted)]">Number of times to retry failed downloads automatically.</span>
          </label>
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

        <!-- Lyrics (Feature 18) -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" class="toggle toggle-primary" bind:checked={downloadLyrics} />
            <div class="flex flex-col">
              <span class="label-text text-[var(--text-color)] font-bold">Download Lyrics</span>
              <span class="label-text-alt text-[var(--text-muted)]">Fetch and embed lyrics if available</span>
            </div>
          </label>
        </div>

        <!-- Video Codec (Feature 20) -->
        <div class="form-control w-full max-w-md mt-2">
          <label class="label">
            <span class="label-text text-[var(--text-color)] font-bold">Video Codec Preference</span>
          </label>
          <select bind:value={videoCodec} class="select select-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue">
            <option value="default">Default (Best Compatibility)</option>
            <option value="h264">H.264 (Most Compatible)</option>
            <option value="hevc">HEVC/H.265 (High Compression)</option>
          </select>
          <label class="label">
            <span class="label-text-alt text-[var(--text-muted)]">Prefer specific video codec when available.</span>
          </label>
        </div>

        <!-- Metadata (Feature 11) -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" class="toggle toggle-primary" bind:checked={embedMetadata} />
            <div class="flex flex-col">
              <span class="label-text text-[var(--text-color)] font-bold">Embed Metadata</span>
              <span class="label-text-alt text-[var(--text-muted)]">Add ID3 tags (Artist, Title, etc.) to files</span>
            </div>
          </label>
        </div>

        <!-- Thumbnail (Feature 15) -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" class="toggle toggle-primary" bind:checked={embedThumbnail} />
            <div class="flex flex-col">
              <span class="label-text text-[var(--text-color)] font-bold">Embed Thumbnail</span>
              <span class="label-text-alt text-[var(--text-muted)]">Set video thumbnail as file icon/cover art</span>
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

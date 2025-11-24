<script>
  import { settings } from '$lib/stores';
  import { onMount } from 'svelte';

  let pattern = $settings.filenamePattern;
  let proxyUrl = $settings.proxyUrl || '';
  let cookieContent = $settings.cookieContent || '';
  let useSponsorBlock = $settings.useSponsorBlock || false;
  let downloadSubtitles = $settings.downloadSubtitles || false;
  let rateLimit = $settings.rateLimit || '';
  let organizeByUploader = $settings.organizeByUploader || false;
  let splitChapters = $settings.splitChapters || false;

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
      splitChapters
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
        splitChapters !== $settings.splitChapters) {
      save();
    }
  }
</script>

<div class="max-w-4xl mx-auto w-full pb-20">
  <h1 class="text-3xl font-bold text-[var(--text-color)] mb-8">Settings</h1>

  <div class="glass-panel rounded-2xl p-6 space-y-8">
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
          placeholder="{title}" 
          class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" 
        />
        <label class="label">
          <span class="label-text-alt text-[var(--text-muted)]">
            Available variables: <code class="bg-black/20 px-1 rounded">{title}</code>, <code class="bg-black/20 px-1 rounded">{id}</code>, <code class="bg-black/20 px-1 rounded">{uploader}</code>, <code class="bg-black/20 px-1 rounded">{date}</code>
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
  </div>
</div>

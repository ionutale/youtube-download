<script>
  import '../app.css';
  import { page } from '$app/stores';
</script>

<div class="flex h-screen bg-midnight text-white overflow-hidden selection:bg-neon-pink selection:text-white">
  <!-- Sidebar -->
  <aside class="w-20 lg:w-64 flex-shrink-0 glass-panel border-r border-glass-border flex flex-col transition-all duration-300 z-20">
    <div class="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-glass-border">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-pink to-neon-purple flex items-center justify-center shadow-lg shadow-neon-pink/20">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
      <span class="hidden lg:block ml-3 font-display font-bold text-xl tracking-wide">Downloader</span>
    </div>

    <nav class="flex-1 py-6 flex flex-col gap-2 px-3">
      <a href="/" class="flex items-center p-3 rounded-xl transition-all duration-200 hover:bg-white/5 {$page.url.pathname === '/' ? 'bg-white/10 text-neon-blue shadow-lg shadow-neon-blue/10' : 'text-gray-400 hover:text-white'}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span class="hidden lg:block ml-3 font-medium">Home</span>
      </a>
      
      <a href="/library" class="flex items-center p-3 rounded-xl transition-all duration-200 hover:bg-white/5 {$page.url.pathname === '/library' ? 'bg-white/10 text-neon-pink shadow-lg shadow-neon-pink/10' : 'text-gray-400 hover:text-white'}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <span class="hidden lg:block ml-3 font-medium">Library</span>
      </a>

      <a href="/settings" class="flex items-center p-3 rounded-xl transition-all duration-200 hover:bg-white/5 {$page.url.pathname === '/settings' ? 'bg-white/10 text-neon-purple shadow-lg shadow-neon-purple/10' : 'text-gray-400 hover:text-white'}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span class="hidden lg:block ml-3 font-medium">Settings</span>
      </a>
    </nav>

    <div class="p-4 border-t border-glass-border">
      <div class="flex items-center justify-center lg:justify-start gap-3 text-xs text-gray-500">
        <span class="hidden lg:inline">v1.0.0</span>
      </div>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 relative overflow-hidden flex flex-col">
    <!-- Background Glows -->
    <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-neon-purple/10 blur-[100px] pointer-events-none"></div>
    <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-neon-blue/10 blur-[100px] pointer-events-none"></div>

    <!-- Scrollable Area -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-8 relative z-10">
      <slot />
    </div>
  </main>
</div>

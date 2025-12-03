<script lang="ts">
  import { toast } from 'svelte-sonner';

  let username = '';
  let password = '';
  let isRegister = false;

  async function handleSubmit() {
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (res.ok) {
        if (isRegister) {
          toast.success('Registered successfully! Please login.');
          isRegister = false;
        } else {
          const data = await res.json();
          toast.success('Logged in!');
          // Save token or redirect
          window.location.href = '/';
        }
      } else {
        toast.error('Failed: ' + res.statusText);
      }
    } catch {
      toast.error('Error connecting to server');
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-[var(--bg-color)]">
  <div class="glass-panel p-8 rounded-2xl w-full max-w-md space-y-6">
    <h1 class="text-3xl font-bold text-center text-[var(--text-color)]">
      {isRegister ? 'Create Account' : 'Welcome Back'}
    </h1>
    
    <div class="form-control">
      <label class="label">
        <span class="label-text text-[var(--text-muted)]">Username</span>
      </label>
      <input type="text" bind:value={username} class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" />
    </div>

    <div class="form-control">
      <label class="label">
        <span class="label-text text-[var(--text-muted)]">Password</span>
      </label>
      <input type="password" bind:value={password} class="input input-bordered bg-[var(--input-bg)] text-[var(--text-color)] border-[var(--glass-border)] focus:border-neon-blue" />
    </div>

    <button class="btn btn-primary w-full" on:click={handleSubmit}>
      {isRegister ? 'Sign Up' : 'Sign In'}
    </button>

    <div class="text-center text-sm text-[var(--text-muted)]">
      {isRegister ? 'Already have an account?' : "Don't have an account?"}
      <button class="text-neon-blue hover:underline ml-1" on:click={() => isRegister = !isRegister}>
        {isRegister ? 'Login' : 'Register'}
      </button>
    </div>
  </div>
</div>

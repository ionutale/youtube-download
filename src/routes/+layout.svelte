<script lang="ts">
	import '../app.css';
	import { Toaster } from 'svelte-sonner';
	import Header from '$lib/components/Header.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		const theme = localStorage.getItem('theme') || 'light';
		document.documentElement.setAttribute('data-theme', theme);
	});

	function toggleTheme() {
		const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}
</script>

<Toaster />
<div class="flex min-h-screen flex-col bg-base-200">
	<div class="navbar bg-base-100">
		<div class="flex-1">
			<a href="/" class="btn btn-ghost text-xl normal-case">YouTube Downloader</a>
			<a href="/history" class="btn btn-ghost normal-case">History</a>
		</div>
		<div class="flex-none">
			<button class="btn btn-square btn-ghost" onclick={toggleTheme} aria-label="Toggle theme">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="h-6 w-6"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
					/>
				</svg>
			</button>
		</div>
	</div>
	<Header />
	<main class="container mx-auto p-4 flex-1">
		<slot />
	</main>
</div>

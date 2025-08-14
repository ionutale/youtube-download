<script lang="ts">
	import '../app.css';
	import { Toaster } from 'svelte-sonner';
	import Header from '$lib/components/Header.svelte';
</script>

<Toaster />
<div class="flex min-h-screen flex-col bg-base-200">
	<Header />
	<main class="flex-1">
		<slot />
	</main>
</div>

<script lang="ts">
	import { onMount } from 'svelte';

	let history = $state([]);

	onMount(async () => {
		const response = await fetch('/api/history');
		history = await response.json();
	});

	async function remove(path) {
		await fetch(`/api/history?path=${path}`, {
			method: 'DELETE'
		});
		history = history.filter((video) => video.path !== path);
	}
</script>

<h1 class="text-4xl font-bold">History</h1>

<div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
	{#each history as video}
		<div class="card bg-base-100 shadow-xl">
			<figure><img src={video.thumbnail} alt={video.title} /></figure>
			<div class="card-body">
				<h2 class="card-title">{video.title}</h2>
				<div class="card-actions justify-end">
					<a href={video.path} download class="btn btn-primary">Download</a>
					<button class="btn btn-secondary" on:click={() => remove(video.path)}>Remove</button>
				</div>
			</div>
		</div>
	{/each}
</div>

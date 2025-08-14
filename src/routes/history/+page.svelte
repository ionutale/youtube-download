<script lang="ts">
	import { history } from '$lib/stores';
</script>

<h1 class="text-2xl font-bold">Download History</h1>

{#if $history.length === 0}
	<p>No downloads yet.</p>
{:else}
	<ul class="mt-4 space-y-2">
		{#each $history as item}
			<li>{item.title}</li>
		{/each}
	</ul>
{/if}

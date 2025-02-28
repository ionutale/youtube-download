<script lang="ts">
    import type { PageProps } from './$types';

	type VideoDetails = {
		title: string;
		lengthSeconds: string;
		description: string;
		thumbnails: Array<{ url: string }>;
	};

    
    
	let { data }: PageProps = $props();
    
	type SearchVideoData = typeof data;

	let query = $state('https://www.youtube.com/watch?v=1VQZTFyvcqc');
	let searchVideoData: SearchVideoData = $state(data);

    $effect(() => {
        console.log('searchVideoData:', searchVideoData);
    });

	async function findVideo(query: string) {
		const response = await fetch(`/api/search?url=${encodeURIComponent(query)}`);
		const data = await response.json();
		if (response.ok) {
			console.log('Download started:', data);
			searchVideoData = data;
			console.log(searchVideoData);
		} else {
			console.error('Error starting download:', data);
			searchVideoData = { videoDetails: undefined };
		}
	}
</script>

<section id="search">
	<input type="text" bind:value={query} />
	<button on:click={() => findVideo(query)}>Search</button>
</section>

<section id="search-result">
	{#if searchVideoData.videoDetails !== undefined}
		<article>
			<img src={searchVideoData.videoDetails.thumbnails[0].url} alt="thumbnail" />
			<div id="info">
				<p id="title">{searchVideoData.videoDetails.title}</p>
				<p id="lengthSeconds">{searchVideoData.videoDetails.lengthSeconds}</p>
				<p id="description">{searchVideoData.videoDetails.description.substring(0, 150)}</p>
				<div id="actions">
					<select>
						{#each searchVideoData.formats as format}
							<option value={format.itag}>{format.mimeType}</option>
						{/each}
					</select>
					<button id="download"> Download </button>
				</div>
			</div>
		</article>
	{/if}
</section>

<style>
	section#search {
		display: flex;
		flex-direction: row;
		justify-content: center;
	}

	section#search input {
		font-size: x-large;
		width: 50rem;
		height: 2rem;
	}

	section#search-result {
		margin-top: 2rem;

		display: flex;
		flex-direction: row;
		justify-content: center;
	}

	section#search-result article {
		display: flex;
		flex-direction: row;
		justify-content: center;
		max-width: 780px;
		gap: 1rem;
	}
</style>

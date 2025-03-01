<script lang="ts">
	import type { PageProps } from './$types';
	const qualities = [
		'highest',
		'lowest',
		'highestaudio',
		'lowestaudio',
		'highestvideo',
		'lowestvideo'
	];

	type VideoDetails = {
		title: string;
		lengthSeconds: string;
		description: string;
		thumbnails: Array<{ url: string }>;
	};

	let { data }: PageProps = $props();
	let quality = $state('highest');

	type SearchVideoData = typeof data | undefined;

	let query = $state('https://www.youtube.com/watch?v=jxIzy3gWR1U');
	let searchVideoData: SearchVideoData = $state(undefined);

	$effect(() => {
		console.log('searchVideoData:', searchVideoData);
	});

	async function findVideo(query: string) {
		const response = await fetch(`/api/download?url=${encodeURIComponent(query)}&quality=${quality}`);
		const data = await response.json();
		if (response.ok) {
			console.log('Download started:', data);
			searchVideoData = data;
			console.log(searchVideoData);
		} else {
			console.error('Error starting download:', data);
		}
	}

	async function downloadVideo(query: string, quality: string) {
		const response = await fetch(`/api/download?url=${encodeURIComponent(query)}&quality=${quality}`,
			{ method: 'POST' });
		const data = await response.json();
		if (response.ok) {
			console.log('Download started:', data);
		} else {
			console.error('Error starting download:', data);
		}
	}
</script>

<section id="search">
	<input type="text" bind:value={query} />
	<button on:click={() => findVideo(query)}>Search</button>
</section>

<section id="search-result">
	{#if searchVideoData?.videoDetails !== undefined}
		<article>
			<img src={searchVideoData.videoDetails.thumbnails[0].url} alt="thumbnail" />
			<div id="info">
				<p id="title">{searchVideoData.videoDetails.title}</p>
				<p id="lengthSeconds">{searchVideoData.videoDetails.lengthSeconds}</p>
				<p id="description">{searchVideoData.videoDetails.description.substring(0, 150)}</p>
				<div id="actions">
					<select bind:value={quality}>
						{#each qualities as q}
							<option value={q}>{q}</option>
						{/each}
					</select>
					<button id="download"
						on:click={() => downloadVideo(query, quality)}
					> Download </button>
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

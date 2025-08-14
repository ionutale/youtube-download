<script lang="ts">
	import "../app.css";
	import { Progress } from '$lib/components/ui/progress';
	import { Separator } from '$lib/components/ui/separator';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	
	import type { PageProps } from './$types';
	const qualities = [
		{ value: 'highest', description: 'Highest quality (video and audio)' },
		{ value: 'lowest', description: 'Lowest quality (video and audio)' },
		{ value: 'highestaudio', description: 'Highest quality audio' },
		{ value: 'lowestaudio', description: 'Lowest quality audio' },
		{ value: 'highestvideo', description: 'Highest quality video' },
		{ value: 'lowestvideo', description: 'Lowest quality video' }
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

	let url = '';
	let loading = false;
	let video: {
		title: string;
		thumbnail: string;
		path: string;
	} | null = null;
	let progress = 0;
	let downloads = $state([]);

	onMount(() => {
		const ws = new WebSocket('ws://localhost:3000');

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.type === 'progress') {
				progress = data.progress;
			}
			if (data.type === 'downloads') {
				downloads = data.downloads;
			}
		};
	});

	async function search() {
		if (!url) return;
		loading = true;
		progress = 0;
		video = null;
		try {
			const response = await fetch(`/api/download?url=${url}`, {
				method: 'POST'
			});
			const data = await response.json();
			video = data;
		} catch (error) {
			console.error(error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="form-control">
	<div class="input-group">
		<input type="text" placeholder="Search…" class="input input-bordered w-full" bind:value={url} />
		<button class="btn btn-square" on:click={search} disabled={loading}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/></svg
			>
		</button>
	</div>
</div>

{#if loading}
	<progress class="progress progress-primary mt-4 w-full" value={progress} max="100"></progress>
{/if}

{#if video}
	<div class="card lg:card-side bg-base-100 shadow-xl mt-4">
		<figure><img src={video.thumbnail} alt={video.title} /></figure>
		<div class="card-body">
			<h2 class="card-title">{video.title}</h2>
			<div class="card-actions justify-end">
				<a href={video.path} download class="btn btn-primary">Download</a>
			</div>
		</div>
	</div>
{/if}

<div class="mt-8">
	<h2 class="text-2xl font-bold">Concurrent Downloads</h2>
	<div class="overflow-x-auto">
		<table class="table w-full">
			<thead>
				<tr>
					<th></th>
					<th>Title</th>
					<th>Progress</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each downloads as download, i}
					<tr>
						<th>{i + 1}</th>
						<td>{download.title}</td>
						<td><progress class="progress progress-primary" value={download.progress} max="100"></progress></td>
						<td>{download.status}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

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

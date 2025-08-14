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

	onMount(() => {
		const ws = new WebSocket('ws://localhost:3000');

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.type === 'progress') {
				progress = data.progress;
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
			toast.success('Video downloaded successfully');
		} catch (error) {
			console.error(error);
			toast.error('Failed to download video');
		} finally {
			loading = false;
		}
	}
</script>

<div class="container mx-auto p-4">
	<div class="flex items-center space-x-2">
		<Input bind:value={url} placeholder="Enter YouTube URL" />
		<Button on:click={search} disabled={loading}>
			{#if loading}
				<svg
					class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					/>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
			{/if}
			Search
		</Button>
	</div>

	{#if loading}
		<div class="mt-4">
			<Progress value={progress} />
		</div>
	{/if}

	{#if video}
		<div class="mt-4">
			<h2 class="text-xl font-bold">{video.title}</h2>
			<img src={video.thumbnail} alt={video.title} class="mt-2" />
			<video src={video.path} controls class="mt-2" />
		</div>
	{/if}

	<Separator class="my-4" />

	<div class="mt-4">
		<h2 class="text-2xl font-bold">History</h2>
		<div class="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
			<!-- History items will be rendered here -->
		</div>
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

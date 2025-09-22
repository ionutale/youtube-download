<script lang="ts">
	import "../app.css";
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
	let format: 'mp3' | 'mp4' = $state('mp4');

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

	let url = $state('');
	let loading = $state(false);
	let video: {
		id?: string;
		title?: string;
		thumbnail?: string;
		path?: string;
	} | null = $state(null);
	let progress = $state(0);
	import type { DownloadItem } from '$lib/types';
	let downloads = $state<DownloadItem[]>([]);
	let sortBy: 'createdAt' | 'progress' = $state('createdAt');
	let filterBy: 'all' | 'active' | 'completed' | 'failed' = $state('all');

	onMount(() => {
		const es = new EventSource('/api/events');
		es.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'snapshot') {
					downloads = data.downloads;
				} else if (data.type === 'update') {
					const d = data.download;
					const idx = downloads.findIndex((x) => x.id === d.id);
					if (idx >= 0) downloads[idx] = d; else downloads = [d, ...downloads];
					progress = d.progress ?? progress;
				}
			} catch (e) {
				console.error('SSE parse error', e);
			}
		};
		es.onerror = () => {
			console.error('SSE disconnected');
		};
	});

	const visible = $derived.by(() => {
		return downloads
			.filter((d) => {
				if (filterBy === 'active') return d.status === 'queued' || d.status === 'downloading' || d.status === 'paused';
				if (filterBy === 'completed') return d.status === 'completed';
				if (filterBy === 'failed') return d.status === 'failed';
				return true;
			})
			.sort((a, b) => {
				if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
				if (sortBy === 'createdAt') return (b.createdAt || 0) - (a.createdAt || 0);
				return 0;
			});
	});

	async function search() {
		if (!url) return;
		loading = true;
		progress = 0;
		video = null;
		try {
			const response = await fetch(`/api/download?url=${encodeURIComponent(url)}&format=${format}&quality=${quality}` , {
				method: 'POST'
			});
			const data = await response.json();
			if (response.ok) {
				video = { id: data.id };
				toast.success('Download queued');
			} else {
				toast.error(data?.error || 'Failed to start download');
			}
		} catch (error) {
			console.error(error);
			toast.error('Unexpected error');
		} finally {
			loading = false;
		}
	}
</script>

<div class="form-control">
	<div class="input-group">
		<input type="text" placeholder="Search…" class="input input-bordered w-full" bind:value={url} />
		<select class="select select-bordered" bind:value={format}>
			<option value="mp4">MP4</option>
			<option value="mp3">MP3</option>
		</select>
		<select class="select select-bordered" bind:value={quality}>
			<option value="highest">Highest</option>
			<option value="lowest">Lowest</option>
			<option value="highestaudio">Highest audio</option>
			<option value="lowestaudio">Lowest audio</option>
			<option value="highestvideo">Highest video</option>
			<option value="lowestvideo">Lowest video</option>
		</select>
	<button class="btn btn-square" aria-label="Search" onclick={search} disabled={loading}>
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

<div class="mt-4 flex items-center gap-2">
	<label for="filterBy">Filter</label>
	<select id="filterBy" class="select select-bordered select-xs" bind:value={filterBy}>
		<option value="all">All</option>
		<option value="active">Active</option>
		<option value="completed">Completed</option>
		<option value="failed">Failed</option>
	</select>
	<label for="sortBy">Sort</label>
	<select id="sortBy" class="select select-bordered select-xs" bind:value={sortBy}>
		<option value="createdAt">Created</option>
		<option value="progress">Progress</option>
	</select>
	<span class="text-sm opacity-70">{visible.length} shown</span>
  </div>

{#if loading}
	<progress class="progress progress-primary mt-4 w-full" value={progress} max="100"></progress>
{/if}

{#if video?.path}
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
	{#if visible.length === 0}
		<div class="mt-4 alert">
			<span>No downloads yet. Paste a YouTube link above to start one.</span>
		</div>
	{/if}
	<div class="overflow-x-auto">
		<table class="table w-full">
			<thead>
				<tr>
					<th></th>
					<th>Title</th>
					<th>Progress</th>
					<th>Status</th>
					<th>Speed</th>
					<th>ETA</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each visible as download, i}
					<tr>
						<th>{i + 1}</th>
						<td>{download.title}</td>
						<td><progress class="progress progress-primary" value={download.progress} max="100"></progress></td>
						<td>{download.status}</td>
						<td>{download.speedBps ? Math.round(download.speedBps/1024) + ' KB/s' : '-'}</td>
						<td>{download.etaSeconds ? download.etaSeconds + 's' : '-'}</td>
						<td class="space-x-2">
							<button class="btn btn-xs" aria-label="Pause" onclick={() => fetch(`/api/download/${download.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pause' }) })}>Pause</button>
							<button class="btn btn-xs" aria-label="Resume" onclick={() => fetch(`/api/download/${download.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resume' }) })}>Resume</button>
							<button class="btn btn-xs btn-error" aria-label="Cancel" onclick={() => fetch(`/api/download/${download.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) })}>Cancel</button>
							<button class="btn btn-xs btn-primary" aria-label="Retry" onclick={() => fetch(`/api/download/${download.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'retry' }) })}>Retry</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
</style>

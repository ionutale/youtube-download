<script lang="ts">
	import { page } from '$app/stores';
</script>

<header class="bg-base-200">
	<nav class="container mx-auto navbar">
		<div class="flex-1">
			<a href="/" class="text-xl normal-case btn btn-ghost">YouTube Downloader</a>
		</div>
		<div class="flex-none">
			<ul class="p-0 menu menu-horizontal">
				<li>
					<a href="/" class:active={$page.url.pathname === '/'}>Home</a>
				</li>
				<li>
					<a href="/history" class:active={$page.url.pathname === '/history'}>History</a>
				</li>
			</ul>
		</div>
	</nav>
</header>

export type HistoryItem = {
	id: string;
	title: string;
	url: string;
	thumbnail: string;
	status: 'downloading' | 'downloaded' | 'error';
	progress?: number;
	filePath?: string;
};

export type Notification = {
	id: number;
	type: 'info' | 'success' | 'error';
	message: string;
};

export type DownloadItem = {
	id: string;
	title?: string;
	progress?: number;
	status: 'queued' | 'downloading' | 'completed' | 'failed' | 'canceled';
};

export type HistoryEntry = {
	title: string;
	path: string; // /files/<rel>
	thumbnail?: string;
};

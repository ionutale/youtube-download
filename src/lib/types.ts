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

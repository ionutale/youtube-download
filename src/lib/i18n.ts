import { derived } from 'svelte/store';
import { settings } from './stores';

const translations = {
  en: {
    'app.title': 'Download Your World',
    'app.subtitle': 'Save your favorite videos and music in seconds.',
    'input.placeholder': 'Paste URL (YouTube, Twitch, SoundCloud...)',
    'btn.download': 'Download',
    'btn.download_all': 'Download All',
    'label.batch_mode': 'Batch Mode',
    'label.advanced_options': 'Advanced Options',
    'label.show': 'Show',
    'label.hide': 'Hide',
    'label.start_time': 'Start Time',
    'label.end_time': 'End Time',
    'label.category': 'Category',
    'label.normalize': 'Normalize Audio',
    'header.active_downloads': 'Active Downloads',
    'msg.no_downloads': 'No downloads found',
    'msg.paste_link': 'Paste a link above to get started',
    'status.queued': 'Queued',
    'status.downloading': 'Downloading',
    'status.paused': 'Paused',
    'status.completed': 'Completed',
    'status.failed': 'Failed',
    'status.canceled': 'Canceled'
  },
  it: {
    'app.title': 'Scarica il Tuo Mondo',
    'app.subtitle': 'Salva i tuoi video e musica preferiti in pochi secondi.',
    'input.placeholder': 'Incolla URL (YouTube, Twitch, SoundCloud...)',
    'btn.download': 'Scarica',
    'btn.download_all': 'Scarica Tutto',
    'label.batch_mode': 'Modalità Batch',
    'label.advanced_options': 'Opzioni Avanzate',
    'label.show': 'Mostra',
    'label.hide': 'Nascondi',
    'label.start_time': 'Inizio',
    'label.end_time': 'Fine',
    'label.category': 'Categoria',
    'label.normalize': 'Normalizza Audio',
    'header.active_downloads': 'Download Attivi',
    'msg.no_downloads': 'Nessun download trovato',
    'msg.paste_link': 'Incolla un link sopra per iniziare',
    'status.queued': 'In coda',
    'status.downloading': 'Scaricamento',
    'status.paused': 'In pausa',
    'status.completed': 'Completato',
    'status.failed': 'Fallito',
    'status.canceled': 'Annullato'
  }
};

export const t = derived(settings, ($settings) => {
  const lang = ($settings as any).language || 'en';
  return (key: string) => {
    const dict = translations[lang as keyof typeof translations] || translations.en;
    return dict[key as keyof typeof dict] || key;
  };
});

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ytdl = require('ytdl-core');
export default ytdl as any;

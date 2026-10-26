import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Every page renders per request and nothing uses ISR or next/image, so the
// adapter's defaults need no incremental cache or image binding.
export default defineCloudflareConfig({});

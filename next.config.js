/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;

// `next dev` gets the Worker's bindings from wrangler.jsonc, with a local D1
// in .wrangler/state that `npm run db:migrate` prepares.
if (process.env.NODE_ENV === 'development') {
  import('@opennextjs/cloudflare')
    .then(({ initOpenNextCloudflareForDev }) => initOpenNextCloudflareForDev())
    .catch((err) => console.error('Setting up the local Cloudflare bindings failed', err));
}

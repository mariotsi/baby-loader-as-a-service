const ROUTES = {
  staging: {
    zoneId: '3f6bbc9bfbd447a3e230fa7cb64bd719',
    pattern: 'media.staging-loading-baby.fyi/*',
  },
  production: {
    zoneId: '553c7fe576c8388403a910053856375d',
    pattern: 'media.loading.baby/*',
  },
};

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  throw new Error('CLOUDFLARE_API_TOKEN is required.');
}

async function api(zoneId, route = '', options = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes${route}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(`Cloudflare route request failed with status ${response.status}.`);
  }
  return body.result;
}

async function ensureBypass({ zoneId, pattern }) {
  const routes = await api(zoneId);
  const route = routes.find((item) => item.pattern === pattern);
  if (!route) {
    await api(zoneId, '', { method: 'POST', body: JSON.stringify({ pattern }) });
    return;
  }
  if (route.script) {
    await api(zoneId, `/${route.id}`, { method: 'PUT', body: JSON.stringify({ pattern }) });
  }
}

const target = process.argv[2];
if (target === 'staging') {
  await ensureBypass(ROUTES.staging);
} else if (target === 'production') {
  await ensureBypass(ROUTES.production);
} else {
  throw new Error('Usage: node scripts/ensure-media-route.mjs staging|production');
}

# A Job Listings Discord bot

A simple Cloudflare worker that will draw from a source of job listings and post
a weekly roundup

## Development

```sh
# Install node modules
$ npm ci
# Launch a local dev instance (requires Cloudflare account)
$ npm run dev
```

## Deployment

```sh
npx wrangler publish
```

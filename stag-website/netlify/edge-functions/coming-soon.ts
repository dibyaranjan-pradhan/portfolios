import type { Config, Context } from '@netlify/edge-functions'

// Shared secret for team/reviewer preview links while the site is taken down
// pre-launch. Share a link like https://<site>/?preview=<key> to grant access;
// the edge function remembers it in a cookie so the link only needs to be
// opened once per browser.
const BYPASS_KEY = 'L3mG1rUR41GY3LiVUDs4'
const COOKIE_NAME = 'stag_preview_access'

const COMING_SOON_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>STAG — Coming Soon</title>
<style>
  :root {
    --bg: #0d0d1a;
    --bg-deep: #111118;
    --red: #e0302a;
    --white: #ffffff;
  }
  * { box-sizing: border-box; }
  html, body {
    height: 100%;
    margin: 0;
    background: radial-gradient(circle at 50% 20%, var(--bg-deep), var(--bg) 70%);
    color: var(--white);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .wrap {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
  }
  h1 {
    margin: 0 0 12px;
    font-size: clamp(1.8rem, 5vw, 3rem);
    letter-spacing: 0.04em;
  }
  h1 span { color: var(--red); }
  p {
    margin: 0;
    max-width: 32rem;
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.05rem;
    line-height: 1.6;
  }
</style>
</head>
<body>
  <div class="wrap">
    <h1>STAG is almost <span>ready</span></h1>
    <p>We're putting the finishing touches on things and will be live shortly. Please check back soon.</p>
  </div>
</body>
</html>`

export default async (req: Request, context: Context) => {
  const url = new URL(req.url)
  const queryKey = url.searchParams.get('preview')
  const hasCookie = context.cookies.get(COOKIE_NAME) === BYPASS_KEY

  if (hasCookie) {
    return
  }

  if (queryKey === BYPASS_KEY) {
    context.cookies.set({
      name: COOKIE_NAME,
      value: BYPASS_KEY,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'Lax',
    })
    return
  }

  return new Response(COMING_SOON_HTML, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'retry-after': '3600',
      'cache-control': 'no-store',
    },
  })
}

export const config: Config = {
  path: '/*',
}

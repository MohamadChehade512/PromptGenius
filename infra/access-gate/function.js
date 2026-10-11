// Prompt IQ edge function: a CloudFront Function (cloudfront-js-2.0) on viewer requests.
//
// 1. Access codes for the Prompt Workshop and Prompt Studio. Their pages and their code bundle
//    (assets/w/, which holds the scoring engine) need a valid code; home and docs are public.
//    The codes (code -> who it's for) are written into the deployed copy of this function by
//    scripts/access-gate.sh, in place of `__CODES__`; they are never in this repo. (A CloudFront
//    KeyValueStore would be neater, but the CloudFront Free plan doesn't allow one on a function.)
// 2. Page addresses: /docs, /workshop, /studio and other paths without a file extension are
//    served the single-page app's index.html.
//
//   /__access?code=PIQ-XXXX-XXXX  checks a code, sets the cookie, opens the Workshop
//   /__access?code=…&to=studio    …or Studio
//   /__logout                     clears the cookie
//
// The cookie holds the code itself and is re-checked on every request, so removing a code locks
// that person out as soon as the updated function is live (usually within a minute or two).
/* eslint-disable no-unused-vars, no-undef -- CloudFront calls `handler` by name; the script fills in __CODES__. */
const CODES = __CODES__;
const COOKIE = 'piq_access';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const ATTRS = 'Path=/; Secure; HttpOnly; SameSite=Lax';

function normalize(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 40);
}

function isValid(code) {
  return code !== '' && Object.prototype.hasOwnProperty.call(CODES, code);
}

function isStudio(uri) {
  return uri === '/studio' || uri.indexOf('/studio/') === 0;
}

function isGated(uri) {
  return (
    uri === '/workshop' ||
    uri.indexOf('/workshop/') === 0 ||
    isStudio(uri) ||
    uri.indexOf('/assets/w/') === 0
  );
}

function hasValidCookie(request) {
  const cookie = request.cookies[COOKIE];
  return !!cookie && isValid(normalize(cookie.value));
}

function page(error, studio) {
  const tool = studio ? 'Studio' : 'Workshop';
  const message = error
    ? '<p class="error" role="alert">That code didn’t work. Check it and try again.</p>'
    : '';
  // Same look as the site (apps/web/src/styles.css): Inter from a fixed public path, warm
  // paper, ink buttons, light and dark.
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">' +
    '<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>' +
    '<title>Prompt ' +
    tool +
    ' · Access code</title><style>' +
    "@font-face{font-family:'Inter Variable';font-style:normal;font-display:swap;font-weight:100 900;" +
    "src:url(/fonts/inter-latin.woff2) format('woff2-variations')}" +
    ':root{--bg:#f7f5f0;--card:#fff;--soft:#f2efe8;--text:#1b1a17;--text2:#4a4740;--muted:#77736a;--border:#e4e0d6;' +
    '--strong:#cfcabd;--btn:#1b1a17;--btn-text:#f7f5f0;--ring:rgba(51,71,107,.22);--bad:#ab4436;--good:#3f7a52}' +
    '@media (prefers-color-scheme:dark){:root{--bg:#141412;--card:#1b1a18;--soft:#232220;--text:#f1eee7;--text2:#cdc8bc;' +
    '--muted:#979284;--border:#2f2d29;--strong:#45423c;--btn:#f1eee7;--btn-text:#141412;--ring:rgba(169,184,216,.3);' +
    '--bad:#dd8576;--good:#7fb48d}}' +
    '*{box-sizing:border-box}html,body{height:100%}' +
    'body{margin:0;display:flex;flex-direction:column;background:var(--bg);color:var(--text);' +
    "font:16px/1.55 'Inter Variable',system-ui,-apple-system,'Segoe UI',sans-serif;font-optical-sizing:auto;" +
    '-webkit-font-smoothing:antialiased}' +
    'header{display:flex;align-items:center;gap:10px;min-height:60px;padding:10px clamp(16px,3.2vw,48px);border-bottom:1px solid var(--border)}' +
    '.brand{font-size:1.1875rem;font-weight:700;letter-spacing:-.03em;color:var(--text);text-decoration:none}' +
    '.badge{display:inline-block;padding:1px 7px;border-radius:999px;border:1px solid var(--strong);font-size:.6875rem;' +
    'font-weight:600;letter-spacing:.04em;line-height:1.5;color:var(--text2)}' +
    'main{flex:1;display:grid;place-items:center;padding:32px 16px}' +
    '.card{width:100%;max-width:420px;background:var(--card);border:1px solid var(--border);border-radius:18px;padding:32px;' +
    'box-shadow:0 18px 48px -18px rgba(27,26,23,.28);animation:rise .6s cubic-bezier(.2,.8,.2,1) both}' +
    '@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
    '.eyebrow{display:flex;align-items:center;gap:8px;margin:0 0 14px;font-size:.75rem;font-weight:600;letter-spacing:.08em;' +
    'text-transform:uppercase;color:var(--muted)}.dot{width:6px;height:6px;border-radius:50%;background:var(--good)}' +
    'h1{margin:0 0 8px;font-size:2rem;font-weight:650;letter-spacing:-.035em;line-height:1.05}' +
    'p{margin:0 0 22px;color:var(--text2);font-size:.9375rem}' +
    'label{display:block;font-weight:500;font-size:.8125rem;color:var(--text2);margin-bottom:6px}' +
    'input{width:100%;height:44px;padding:0 12px;border:1px solid var(--border);border-radius:9px;background:var(--card);' +
    'color:var(--text);font:inherit;font-variant-numeric:tabular-nums;letter-spacing:.08em;text-transform:uppercase}' +
    'input::placeholder{color:var(--muted);letter-spacing:.08em}input:hover{border-color:var(--strong)}' +
    'input:focus{outline:none;border-color:var(--text);box-shadow:0 0 0 3px var(--ring)}' +
    'button{margin-top:14px;width:100%;height:44px;border:0;border-radius:9px;background:var(--btn);color:var(--btn-text);' +
    'font:inherit;font-weight:600;cursor:pointer;transition:opacity .15s}button:hover{opacity:.88}' +
    'button:focus-visible{outline:none;box-shadow:0 0 0 3px var(--ring)}' +
    '.error{margin:12px 0 0;color:var(--bad);font-size:.875rem}' +
    '.back{display:inline-block;margin-top:22px;font-size:.875rem;color:var(--muted);text-decoration:none}' +
    '.back:hover{color:var(--text)}' +
    '@media (prefers-reduced-motion:reduce){.card{animation:none}}' +
    '</style></head><body>' +
    '<header><a class="brand" href="/">Prompt IQ</a><span class="badge">BETA</span></header>' +
    '<main><div class="card">' +
    '<p class="eyebrow"><span class="dot"></span>Private beta</p>' +
    '<h1>Prompt ' +
    tool +
    '</h1>' +
    '<p>' +
    (studio ? 'Studio' : 'The Workshop') +
    ' is in a private beta. Enter the access code you were given.</p>' +
    '<form method="get" action="/__access">' +
    (studio ? '<input type="hidden" name="to" value="studio">' : '') +
    '<label for="code">Access code</label>' +
    '<input id="code" name="code" placeholder="PIQ-XXXX-XXXX-XXXX" autocomplete="off" ' +
    'autocapitalize="characters" spellcheck="false" required autofocus>' +
    '<button type="submit">Continue</button></form>' +
    message +
    '<a class="back" href="/">← Back to Prompt IQ</a>' +
    '</div></main></body></html>';
  return {
    statusCode: 401,
    statusDescription: 'Unauthorized',
    headers: {
      'content-type': { value: 'text/html; charset=utf-8' },
      'cache-control': { value: 'no-store' },
    },
    body: html,
  };
}

function redirect(location, cookieValue, attrs) {
  const cookies = {};
  cookies[COOKIE] = { value: cookieValue, attributes: attrs };
  return {
    statusCode: 302,
    statusDescription: 'Found',
    headers: {
      location: { value: location },
      'cache-control': { value: 'no-store' },
    },
    cookies: cookies,
  };
}

function handler(event) {
  const request = event.request;
  const uri = request.uri;

  if (uri === '/__logout') return redirect('/', '', ATTRS + '; Max-Age=0');

  if (uri === '/__access') {
    const param = request.querystring.code;
    const code = normalize(param && param.value);
    const to = request.querystring.to;
    const studio = !!to && to.value === 'studio';
    if (isValid(code))
      return redirect(studio ? '/studio' : '/workshop', code, ATTRS + '; Max-Age=' + MAX_AGE);
    return page(true, studio);
  }

  if (isGated(uri) && !hasValidCookie(request)) return page(false, isStudio(uri));

  // Page addresses (no file extension) are all served by the app's index.html.
  const last = uri.slice(uri.lastIndexOf('/') + 1);
  if (last.indexOf('.') === -1) request.uri = '/index.html';
  return request;
}

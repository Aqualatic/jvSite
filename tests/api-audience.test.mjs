import test from 'node:test';
import assert from 'node:assert/strict';
import songs from '../api/songs.js';
import analytics from '../api/analytics.js';
import ratings from '../api/ratings.js';
import comments from '../api/comments.js';
import plays from '../api/plays.js';
import upload from '../api/upload.js';

function response() {
  return {
    statusCode: 200, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
function request(query = {}, method = 'GET', body = {}) {
  const params = new URLSearchParams(query);
  return { url: '/api/test?' + params, headers: { host: 'localhost' }, query, method, body };
}

test('API defaults only serve demo songs and demo analytics, without Supabase access', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected live database access'); };
  try {
    for (const query of [{}, { audience: 'demo' }, { private: 'true' }]) {
      const result = response();
      await songs(request(query), result);
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.body.songs.map(song => song.title), ['First Light', 'After Hours', 'Slow Orbit']);
      assert.equal(result.headers['Cache-Control'], 'no-store');
    }
    const result = response();
    await analytics(request(), result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.totals, { songs: 3, plays: 0, likes: 0 });
    assert.ok(result.body.stats.every(song => song.id.startsWith('demo-')));
  } finally { globalThis.fetch = original; }
});

test('default API requests cannot read or write friends activity or uploads', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected live database access'); };
  try {
    for (const handler of [ratings, comments, plays, upload]) {
      for (const method of ['GET', 'POST']) {
        const result = response();
        await handler(request({ song_id: 'original-track' }, method, { song_id: 'original-track', likeDelta: 1, author: 'Demo', body: 'hello' }), result);
        assert.ok([400, 405].includes(result.statusCode));
      }
    }
  } finally { globalThis.fetch = original; }
});

test('unknown audiences are rejected instead of falling back to the friends library', async () => {
  for (const handler of [songs, analytics, ratings, comments, plays, upload]) {
    const result = response();
    const method = handler === plays || handler === upload ? 'POST' : 'GET';
    await handler(request({ audience: 'other' }, method), result);
    assert.equal(result.statusCode, 400);
  }
});

test('explicit friends API still reads the original catalogue and persists its activity', async () => {
  const original = globalThis.fetch;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    let data = [];
    if (url.includes('/songs?')) data = [{ id: 'original-track', title: 'Friends recording', audio_path: 'old.mp3', artwork_path: 'old.jpg' }];
    if (url.includes('/ratings?') || url.includes('/rpc/')) data = [{ likes: 2, dislikes: 1 }];
    if (url.includes('/comments?')) data = [{ author: 'Friend', body: 'Original comment', created_at: new Date().toISOString() }];
    if (url.includes('/plays?')) data = [{ song_id: 'original-track', played_at: new Date().toISOString() }];
    return { ok: true, text: async () => JSON.stringify(data) };
  };
  try {
    const result = response();
    await songs(request({ audience: 'friends' }), result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.songs[0].title, 'Friends recording');
    assert.match(result.body.songs[0].audioSrc, /media\/audio\/old.mp3$/);
    assert.match(calls.at(-1).url, /is_private=eq.false/);

    for (const handler of [ratings, comments]) {
      const read = response();
      await handler(request({ audience: 'friends', song_id: 'original-track' }), read);
      assert.equal(read.statusCode, 200);
      const write = response();
      await handler(request({ audience: 'friends' }, 'POST', { song_id: 'original-track', likeDelta: 1, author: 'Friend', body: 'New comment' }), write);
      assert.equal(write.statusCode, 200);
    }
    const played = response();
    await plays(request({ audience: 'friends' }, 'POST', { song_id: 'original-track' }), played);
    assert.equal(played.statusCode, 200);
    assert.ok(calls.some(call => call.url.endsWith('/plays') && call.options.method === 'POST'));
    const file = response();
    await upload(request({ audience: 'friends' }, 'POST', { dataUrl: 'data:image/png;base64,aGVsbG8=', filename: 'test.png' }), file);
    assert.equal(file.statusCode, 200);
    assert.match(file.body.url, /media\/comment-uploads\//);
    const stats = response();
    await analytics(request({ audience: 'friends' }), stats);
    assert.equal(stats.statusCode, 200);
    assert.equal(stats.body.stats[0].title, 'Friends recording');
    assert.equal(stats.body.totals.plays, 1);
  } finally {
    globalThis.fetch = original;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

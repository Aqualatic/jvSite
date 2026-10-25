import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { audienceForPath, createExperience } from '../assets/experience.js';
import { DEMO_SONGS } from '../assets/demo/catalog.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}
const noNetwork = () => { throw new Error('Demo must not call the live API'); };
const post = body => ({ method: 'POST', body: JSON.stringify(body) });

test('main and JVHub URLs select separate experiences, including trailing slashes', () => {
  assert.equal(audienceForPath('/'), 'demo');
  assert.equal(audienceForPath('/jvhub'), 'friends');
  assert.equal(audienceForPath('/jvhub/'), 'friends');
  assert.equal(audienceForPath('/jvhub-lookalike'), 'demo');
  assert.equal(audienceForPath('/friends'), 'demo');
  assert.equal(createExperience('/jvhub/').basePath, '/jvhub');
  assert.equal(createExperience('/').basePath, '/');
});

test('demo catalogue is playable without Supabase or a network request', async () => {
  const experience = createExperience('/');
  const data = await experience.request('/api/songs?audience=friends', undefined, noNetwork);
  assert.deepEqual(data.songs.map(song => song.title), ['First Light', 'After Hours', 'Slow Orbit']);
  for (const song of data.songs) {
    const wav = readFileSync(new URL('..' + song.audioSrc, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt32LE(40), wav.length - 44);
    assert.ok(wav.readUInt32LE(40) / wav.readUInt32LE(28) > 30);
    assert.match(readFileSync(new URL('..' + song.coverSrc, import.meta.url), 'utf8'), /<svg/);
  }
});

test('demo votes persist across reloads without changing friend vote keys', async () => {
  const storage = memoryStorage();
  storage.setItem('jvhub.vote.original-track', 'like');
  const experience = createExperience('/', storage);
  const song_id = DEMO_SONGS[0].id;
  const vote = await experience.request('/api/ratings', post({ song_id, likeDelta: 1 }), noNetwork);
  assert.equal(vote.likes, 1);
  const reloaded = createExperience('/', storage);
  assert.deepEqual(await reloaded.request('/api/ratings?song_id=' + song_id, undefined, noNetwork), { likes: 1, dislikes: 0 });
  assert.equal(storage.getItem('jvhub.vote.original-track'), 'like');
  await reloaded.request('/api/ratings', post({ song_id, likeDelta: -1, dislikeDelta: 1 }), noNetwork);
  assert.deepEqual(await reloaded.request('/api/ratings?song_id=' + song_id, undefined, noNetwork), { likes: 0, dislikes: 1 });
});

test('demo supports image comments, timestamps, plays, and current analytics in browser storage', async () => {
  const experience = createExperience('/', memoryStorage());
  const song_id = DEMO_SONGS[0].id;
  const image = 'data:image/png;base64,aGVsbG8=';
  assert.equal((await experience.request('/api/upload', post({ dataUrl: image }), noNetwork)).url, image);
  await experience.request('/api/comments', post({ song_id, author: 'Listener', body: '<b>Great intro</b>', image_url: image, timestamp_seconds: 7.8 }), noNetwork);
  const { comments } = await experience.request('/api/comments?song_id=' + song_id, undefined, noNetwork);
  assert.equal(comments[0].body, '<b>Great intro</b>');
  assert.equal(comments[0].image_url, image);
  assert.equal(comments[0].timestamp_seconds, 7);
  await experience.request('/api/plays', post({ song_id }), noNetwork);
  await experience.request('/api/ratings', post({ song_id, likeDelta: 1 }), noNetwork);
  const stats = await experience.request('/api/analytics', undefined, noNetwork);
  assert.deepEqual(stats.totals, { songs: 3, plays: 1, likes: 1 });
  assert.equal(stats.timeline.length, 30);
  assert.equal(stats.timeline.at(-1).count, 1);
  assert.equal(stats.stats[0].plays, 1);
});

test('demo rejects friends song IDs and non-image uploads without a live request', async () => {
  const experience = createExperience('/');
  await assert.rejects(experience.request('/api/comments?song_id=original-track', undefined, noNetwork), /not in the demo/);
  await assert.rejects(experience.request('/api/plays', post({ song_id: 'original-track' }), noNetwork), /not in the demo/);
  await assert.rejects(experience.request('/api/upload', post({ dataUrl: 'data:text/html;base64,aGVsbG8=' }), noNetwork), /Choose a JPEG/);
});

test('demo works in memory when storage is unavailable or saved data is invalid', async () => {
  for (const storage of [undefined, { getItem: () => 'bad json', setItem() {} }]) {
    const experience = createExperience('/', storage);
    const song_id = DEMO_SONGS[1].id;
    await experience.request('/api/ratings', post({ song_id, likeDelta: 1 }), noNetwork);
    assert.equal((await experience.request('/api/ratings?song_id=' + song_id, undefined, noNetwork)).likes, 1);
  }
});

test('friends requests preserve payloads and explicitly select the live API for every resource', async () => {
  const experience = createExperience('/jvhub', memoryStorage());
  for (const resource of ['songs', 'ratings', 'comments', 'plays', 'upload', 'analytics']) {
    const options = post({ song_id: 'original-track', body: 'hello' });
    const result = await experience.request('/api/' + resource + '?song_id=original-track', options, async (url, received) => {
      assert.equal(url, '/api/' + resource + '?song_id=original-track&audience=friends');
      assert.equal(received, options);
      return { live: true };
    });
    assert.deepEqual(result, { live: true });
  }
});

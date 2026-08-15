import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";

const BASE_URL = "http://localhost:3000";
const TEST_YT_URL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"; // Big Buck Bunny 60fps 4K - Official Blender Foundation short clip / trailer
const TEST_YOUTUBE_CHALLENGE_URL = "https://youtu.be/EJrkP6zf09g?si=GCDNUvVnzks4mOSk";
const TEST_YOUTUBE_MUSIC_URL = "https://music.youtube.com/watch?v=dQw4w9WgXcQ";
const TEST_INSTAGRAM_URL = "https://www.instagram.com/reels/C8-q0w9yW9F/"; // Public reel sample

async function runTests() {
  console.log("=== STARTING COMPREHENSIVE BACKEND & API TESTS ===\n");

  // 1. YouTube metadata extraction
  console.log("Test 1: YouTube metadata extraction (/api/media/info)...");
  const infoRes = await fetch(`${BASE_URL}/api/media/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: TEST_YT_URL }),
  });
  
  if (!infoRes.ok) {
    const err = await infoRes.text();
    throw new Error(`YouTube metadata extraction failed with HTTP ${infoRes.status}: ${err}`);
  }
  const info = await infoRes.json();
  console.log("✓ YouTube info fetched successfully:");
  console.log(`  Title: ${info.title}`);
  console.log(`  Uploader: ${info.uploader}`);
  console.log(`  Duration: ${info.duration}s (${info.durationLabel})`);
  console.log(`  Platform detected: ${info.platform}`);
  console.log(`  Video qualities found (${info.videoQualities.length}):`, info.videoQualities.map(q => q.label).join(", "));
  console.log(`  Audio qualities found (${info.audioQualities.length}):`, info.audioQualities.map(a => a.label).join(", "));

  if (!info.title || !info.videoQualities.length || !info.videoQualities.every(quality => quality.formatId)) {
    throw new Error("Invalid info structure returned from /api/media/info");
  }

  // Regression coverage for YouTube URLs that can trigger a server-side bot challenge.
  console.log("\nTest 1a: YouTube client fallback for a challenged public URL...");
  const challengedRes = await fetch(`${BASE_URL}/api/media/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: TEST_YOUTUBE_CHALLENGE_URL }),
  });
  if (!challengedRes.ok) {
    const err = await challengedRes.text();
    throw new Error(`Challenged YouTube URL failed with HTTP ${challengedRes.status}: ${err}`);
  }
  const challengedInfo = await challengedRes.json();
  console.log(`✓ Challenged URL fetched: Title="${challengedInfo.title}", qualities=${challengedInfo.videoQualities.length}`);
  if (!challengedInfo.title || !challengedInfo.videoQualities.length) {
    throw new Error("Challenged YouTube URL returned incomplete metadata");
  }

  console.log("\nTest 1b: YouTube Music metadata and audio formats...");
  const musicRes = await fetch(`${BASE_URL}/api/media/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: TEST_YOUTUBE_MUSIC_URL }),
  });
  if (!musicRes.ok) {
    const err = await musicRes.text();
    throw new Error(`YouTube Music URL failed with HTTP ${musicRes.status}: ${err}`);
  }
  const musicInfo = await musicRes.json();
  console.log(`✓ YouTube Music fetched: Title="${musicInfo.title}", audio formats=${musicInfo.audioQualities.length}`);
  if (musicInfo.platform !== "youtube" || !musicInfo.audioQualities.length) {
    throw new Error("YouTube Music did not return a downloadable audio format");
  }

  // 1c. Test Widescreen / Cinematic aspect ratio URL resolution mapping
  console.log("\nTest 1c: Widescreen resolution mapping for cinematic video...");
  const widescreenRes = await fetch(`${BASE_URL}/api/media/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://youtu.be/xwUz3tSlMZ4?si=5XV2aL2sygJqEHEY" }),
  });
  if (!widescreenRes.ok) {
    throw new Error(`Widescreen info failed with HTTP ${widescreenRes.status}`);
  }
  const wideInfo = await widescreenRes.json();
  const wideLabels = wideInfo.videoQualities.map(q => q.label);
  const wide1080 = wideInfo.videoQualities.find(q => q.height === 1080);
  const wide720 = wideInfo.videoQualities.find(q => q.height === 720);
  const wide360 = wideInfo.videoQualities.find(q => q.height === 360);
  console.log("✓ Widescreen video qualities:", wideLabels.join(", "));
  if (!wide1080?.formatId || !wide720?.formatId || !wide360?.formatId) {
    throw new Error(`Widescreen qualities not formatted cleanly: ${wideLabels.join(", ")}`);
  }

  // Count temporary directories before downloads
  const tempBefore = (await readdir(tmpdir())).filter(f => f.startsWith("cliptap-"));
  console.log(`\nTemporary directories before downloads: ${tempBefore.length}`);

  // 2. YouTube video download and 1080p regression coverage
  console.log("\nTest 2: Exact widescreen 1080p stream selection...");
  const startTimeVideo = Date.now();
  const videoRes = await fetch(`${BASE_URL}/api/media/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: wideInfo.webpageUrl,
      mediaType: "video",
      videoFormatId: wide1080.formatId,
      videoHeight: wide1080.height,
    }),
  });

  if (!videoRes.ok) {
    const err = await videoRes.text();
    throw new Error(`YouTube video download failed with HTTP ${videoRes.status}: ${err}`);
  }

  const videoDisposition = videoRes.headers.get("content-disposition");
  const videoType = videoRes.headers.get("content-type");
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
  const elapsedVideo = ((Date.now() - startTimeVideo) / 1000).toFixed(1);
  console.log(`✓ YouTube video downloaded in ${elapsedVideo}s!`);
  console.log(`  Content-Type: ${videoType}`);
  console.log(`  Content-Disposition: ${videoDisposition}`);
  console.log(`  Downloaded bytes: ${videoBuffer.length} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

  // This URL previously fell back to YouTube format 18 (360p, ~8 MB).
  if (videoBuffer.length < 10000 || (wide1080.estimatedSize && videoBuffer.length < wide1080.estimatedSize * 0.9)) {
    throw new Error(`Widescreen 1080p download was smaller than its selected source stream (${videoBuffer.length} < ${wide1080.estimatedSize}).`);
  }

  // 3. YouTube audio-to-MP3 download
  await new Promise(r => setTimeout(r, 1500));
  console.log("\nTest 3: YouTube audio download & MP3 extraction (/api/media/download - Audio)...");
  const startTimeAudio = Date.now();
  const audioRes = await fetch(`${BASE_URL}/api/media/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: wideInfo.webpageUrl,
      mediaType: "audio",
      audioFormatId: wideInfo.audioQualities[0]?.formatId,
      audioBitrate: wideInfo.audioQualities[0]?.bitrate,
    }),
  });

  if (!audioRes.ok) {
    const err = await audioRes.text();
    throw new Error(`YouTube audio download failed with HTTP ${audioRes.status}: ${err}`);
  }

  const audioDisposition = audioRes.headers.get("content-disposition");
  const audioType = audioRes.headers.get("content-type");
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  const elapsedAudio = ((Date.now() - startTimeAudio) / 1000).toFixed(1);
  console.log(`✓ YouTube audio downloaded in ${elapsedAudio}s!`);
  console.log(`  Content-Type: ${audioType}`);
  console.log(`  Content-Disposition: ${audioDisposition}`);
  console.log(`  Downloaded bytes: ${audioBuffer.length} (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

  if (audioBuffer.length < 10000 || !audioType?.includes("audio/mpeg")) {
    throw new Error("Audio file failed MP3 conversion or is suspiciously small.");
  }

  await new Promise(r => setTimeout(r, 1500));
  console.log("\nTest 3b: YouTube Music audio-to-MP3 download...");
  const musicAudioRes = await fetch(`${BASE_URL}/api/media/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: TEST_YOUTUBE_MUSIC_URL,
      mediaType: "audio",
      audioFormatId: musicInfo.audioQualities[0]?.formatId,
      audioBitrate: musicInfo.audioQualities[0]?.bitrate,
      title: musicInfo.title,
    }),
  });
  if (!musicAudioRes.ok) {
    const err = await musicAudioRes.text();
    throw new Error(`YouTube Music audio download failed with HTTP ${musicAudioRes.status}: ${err}`);
  }
  const musicAudioBuffer = Buffer.from(await musicAudioRes.arrayBuffer());
  console.log(`✓ YouTube Music audio downloaded (${(musicAudioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
  if (musicAudioBuffer.length < 10000 || !musicAudioRes.headers.get("content-type")?.includes("audio/mpeg")) {
    throw new Error("YouTube Music audio conversion failed or is suspiciously small.");
  }

  // 4. Resolution selection (360p)
  await new Promise(r => setTimeout(r, 1500));
  console.log("\nTest 4: Specific resolution selection (360p)...");
  const res360 = await fetch(`${BASE_URL}/api/media/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: wideInfo.webpageUrl,
      mediaType: "video",
      videoFormatId: wide360.formatId,
      videoHeight: wide360.height,
    }),
  });

  if (!res360.ok) {
    const err = await res360.text();
    throw new Error(`Resolution 360p download failed: ${err}`);
  }
  const buffer360 = Buffer.from(await res360.arrayBuffer());
  console.log(`✓ 360p video downloaded (${(buffer360.length / 1024 / 1024).toFixed(2)} MB)`);

  // 5. Instagram Reel test (if available / public extractor check)
  console.log("\nTest 5: Instagram URL analysis / error handling check...");
  const instaRes = await fetch(`${BASE_URL}/api/media/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: TEST_INSTAGRAM_URL }),
  });
  if (instaRes.ok) {
    const instaInfo = await instaRes.json();
    console.log(`✓ Instagram info fetched: Title="${instaInfo.title}", Platform=${instaInfo.platform}`);
  } else {
    const instaErr = await instaRes.json();
    console.log(`ℹ Instagram request handled gracefully: status=${instaRes.status}, error="${instaErr.error}"`);
  }

  // 6. Error handling tests
  console.log("\nTest 6: Error handling for invalid inputs...");
  const invalidUrlRes = await fetch(`${BASE_URL}/api/media/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "not-a-valid-url" }),
  });
  console.log(`  Invalid URL response status: ${invalidUrlRes.status} (expected 400 or 422)`);
  const invalidBody = await invalidUrlRes.json();
  console.log(`  Error message returned: "${invalidBody.error}"`);

  const emptyReq = await fetch(`${BASE_URL}/api/media/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  console.log(`  Empty download request status: ${emptyReq.status} (expected 400)`);

  // 7. Temporary-file cleanup check
  console.log("\nTest 7: Checking temporary file cleanup...");
  // Wait 1 second for stream close / rm handlers
  await new Promise(r => setTimeout(r, 1500));
  const tempAfter = (await readdir(tmpdir())).filter(f => f.startsWith("cliptap-"));
  console.log(`  Temporary directories remaining: ${tempAfter.length}`);
  if (tempAfter.length > tempBefore.length) {
    console.warn(`  Warning: ${tempAfter.length - tempBefore.length} temporary folder(s) were not cleaned up:`, tempAfter);
  } else {
    console.log("✓ All temporary download directories cleaned up completely!");
  }

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch(err => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  duplicateTechniqueVideoIds,
  extractYouTubeVideoId,
  findForumTechniqueVideo,
  FORUM_TECHNIQUE_VIDEOS,
  youtubeEmbedUrl,
} from "../src/lib/forum-technique-videos";

test("extrae identificadores de Shorts, enlaces cortos, watch y embed", () => {
  assert.equal(extractYouTubeVideoId("https://youtube.com/shorts/jwYEJRk5a_k?si=abc"), "jwYEJRk5a_k");
  assert.equal(extractYouTubeVideoId("https://youtu.be/P-8eFap4aUQ"), "P-8eFap4aUQ");
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=5CfFMqH4Z0E"), "5CfFMqH4Z0E");
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/embed/HjWwnW5kVCQ"), "HjWwnW5kVCQ");
});

test("rechaza dominios, texto e identificadores inválidos", () => {
  assert.equal(extractYouTubeVideoId("https://example.com/shorts/jwYEJRk5a_k"), "");
  assert.equal(extractYouTubeVideoId("no-es-un-video-valido"), "");
  assert.equal(extractYouTubeVideoId(null), "");
});

test("todos los derribes tienen un identificador reproducible sin cookies", () => {
  assert.equal(FORUM_TECHNIQUE_VIDEOS.length, 10);
  FORUM_TECHNIQUE_VIDEOS.forEach((video) => {
    assert.equal(extractYouTubeVideoId(video.sourceUrl), video.youtubeId);
    assert.match(youtubeEmbedUrl(video.youtubeId), /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  });
});

test("cada técnica conserva ahora un video distinto", () => {
  assert.deepEqual(duplicateTechniqueVideoIds(), []);
});

test("vincula el video individual aunque la técnica incluya una traducción", () => {
  assert.equal(findForumTechniqueVideo("Tani Otoshi (Caída en el valle)")?.id, "tani-otoshi");
  assert.equal(findForumTechniqueVideo("Harai goshi")?.youtubeId, "z6QykfA4lm8");
  assert.equal(findForumTechniqueVideo("Double Leg Takedown"), undefined);
});

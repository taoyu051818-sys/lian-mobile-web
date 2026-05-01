import { config } from "./config.js";

function addUid(url) {
  if (url.searchParams.has("_uid")) return url;
  url.searchParams.set("_uid", String(config.nodebbUid));
  return url;
}

function withNodebbUid(apiPath, uid) {
  const url = new URL(apiPath, config.nodebbBaseUrl);
  url.searchParams.set("_uid", String(uid || config.nodebbUid));
  return `${url.pathname}${url.search}`;
}

async function nodebbFetch(apiPath, options = {}) {
  const url = addUid(new URL(apiPath, config.nodebbBaseUrl));
  const headers = {
    accept: "application/json",
    connection: "close",
    ...options.headers
  };
  if (config.nodebbToken && !headers.authorization) {
    headers["x-api-token"] = config.nodebbToken;
  }

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (cause) {
    const error = new Error(`LIAN API connection failed: ${url.origin}${url.pathname} - ${cause.message || cause}`);
    error.status = 502;
    error.cause = cause;
    throw error;
  }
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message = data?.error || data?.message || text || `LIAN HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryApi(task, attempts = 3) {
  let lastError;
  for (let index = 0; index < Math.max(1, attempts); index += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (index < attempts - 1) await delay(450 * (index + 1));
    }
  }
  throw lastError;
}

async function fetchNodebbTopicIndex(maxPages = 8) {
  const pages = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const data = await retryApi(() => nodebbFetch(`/api/recent?page=${page}`));
    const topics = Array.isArray(data?.topics) ? data.topics : [];
    if (!topics.length) break;
    pages.push(data);
  }

  const seen = new Set();
  const topics = [];
  for (const page of pages) {
    for (const topic of page.topics || []) {
      if (!topic?.tid || seen.has(topic.tid)) continue;
      seen.add(topic.tid);
      topics.push(topic);
    }
  }
  return topics;
}

export { fetchNodebbTopicIndex, nodebbFetch, retryApi, withNodebbUid };

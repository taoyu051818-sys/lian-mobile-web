#!/usr/bin/env node
import assert from "node:assert/strict";
import { sanitizeHtml, stripHtml } from "../src/utils/html.ts";

const cases = [
  {
    name: "removes script blocks",
    input: "<p>Hello</p><script>alert(1)</script>",
    forbidden: ["<script", "alert(1)"],
  },
  {
    name: "removes inline event handlers",
    input: '<p onclick="alert(1)">Hello</p>',
    forbidden: ["onclick", "alert(1)"],
  },
  {
    name: "removes inline styles",
    input: '<p style="background:url(javascript:alert(1))">Hello</p>',
    forbidden: ["style=", "javascript:"],
  },
  {
    name: "removes javascript hrefs",
    input: '<a href="javascript:alert(1)">bad link</a>',
    forbidden: ["javascript:", "alert(1)"],
  },
  {
    name: "preserves safe links",
    input: '<a href="https://example.com" target="_blank">safe</a>',
    required: ["https://example.com", "safe"],
    forbidden: ["javascript:"],
  },
];

for (const testCase of cases) {
  const output = sanitizeHtml(testCase.input);
  for (const value of testCase.required || []) {
    assert.match(output, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${testCase.name}: expected ${value} in ${output}`);
  }
  for (const value of testCase.forbidden || []) {
    assert.doesNotMatch(output, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `${testCase.name}: did not expect ${value} in ${output}`);
  }
}

assert.equal(stripHtml("<p>Hello <strong>LIAN</strong></p>"), "Hello LIAN");

console.log("HTML sanitizer smoke tests passed.");

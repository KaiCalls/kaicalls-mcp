#!/usr/bin/env node
// Stdio bridge to the hosted KaiCalls MCP server (https://www.kaicalls.com/api/mcp).
//
// The hosted server is the real product; this bridge exists so stdio-only
// clients and container-based directories can run KaiCalls locally.
// - initialize, ping and tools/list answer without credentials.
// - tools/call forwards to the hosted server with KAICALLS_API_KEY
//   (create one at https://www.kaicalls.com/dashboard/settings/api-keys).
// No dependencies: Node 18+ only.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const ENDPOINT = process.env.KAICALLS_MCP_URL || 'https://www.kaicalls.com/api/mcp';
const API_KEY = process.env.KAICALLS_API_KEY || '';
const manifest = JSON.parse(readFileSync(new URL('./mcp.json', import.meta.url), 'utf8'));

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function remote(method, params, withKey) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (withKey && API_KEY) headers.authorization = `Bearer ${API_KEY}`;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  // Streamable HTTP may answer as SSE; take the last data line.
  const body = text.trimStart().startsWith('{')
    ? text
    : text
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .pop();
  return JSON.parse(body);
}

function fallbackTools() {
  return manifest.tools.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: { type: 'object' },
    annotations: t.annotations,
  }));
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return; // notifications need no reply
  try {
    if (method === 'initialize') {
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params?.protocolVersion || '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'kaicalls', version: manifest.serverInfo.version },
          instructions: manifest.serverInfo.description,
        },
      });
    }
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') {
      let tools;
      try {
        const out = await remote('tools/list', {}, false);
        tools = out?.result?.tools;
      } catch {
        tools = null;
      }
      return send({ jsonrpc: '2.0', id, result: { tools: tools?.length ? tools : fallbackTools() } });
    }
    if (method === 'tools/call') {
      if (!API_KEY) {
        return send({
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'Set KAICALLS_API_KEY to call KaiCalls tools. Create a key at https://www.kaicalls.com/dashboard/settings/api-keys.',
              },
            ],
          },
        });
      }
      const out = await remote('tools/call', params, true);
      return send({ jsonrpc: '2.0', id, ...(out.error ? { error: out.error } : { result: out.result }) });
    }
    return send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (err) {
    return send({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
    });
  }
}

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  handle(msg);
});

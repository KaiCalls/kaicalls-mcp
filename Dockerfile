# Runs the stdio bridge to the hosted KaiCalls MCP server.
# initialize and tools/list work without credentials; set KAICALLS_API_KEY to call tools.
FROM node:22-alpine
WORKDIR /app
COPY stdio-proxy.mjs mcp.json ./
ENTRYPOINT ["node", "stdio-proxy.mjs"]

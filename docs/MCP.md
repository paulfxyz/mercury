# Mercury as an MCP server

Mercury exposes its debate engine as a [Model Context Protocol](https://modelcontextprotocol.io) server, so an agent (Claude, Cursor, or any MCP client) can call a panel of models as a tool and get back one answer with a consensus score. Calls run on your own OpenRouter key.

- Endpoint: `POST /mcp` (Streamable HTTP, JSON responses, stateless). `GET /mcp` answers 405 because there is no server-initiated stream.
- Protocol versions: 2025-06-18, 2025-03-26 and 2024-11-05.
- Authentication: the same as the REST API (see [API.md](API.md#authentication)). On the public demo send `X-OpenRouter-Key`; on a self-hosted instance send `Authorization: Bearer <MERCURY_API_TOKEN>`, optionally with `X-OpenRouter-Key`.

## Tools

| Tool | What it does |
|---|---|
| `mercury_debate` | Runs a debate and returns the final answer, the consensus (0 to 1, self-reported by the models), the rounds and the cost. Arguments: `query` (required), `workflow` (`precision`, `budget` or a saved workflow), `models`, `roles`, `rounds`, `temperature`, `consensus_threshold`, `wait_seconds` (default 55, maximum 110). If it is still running when the wait ends, it returns the debate id with status `running`. |
| `mercury_get_debate` | Fetches a debate by id; `wait_seconds` waits for a running one; `include` is `none`, `rounds` or `responses`. |
| `mercury_list_debates` | Lists your recent debates. |
| `mercury_quick_answer` | One fast answer from a single low-cost model, with no debate. |
| `mercury_list_workflows` | Lists workflows and suggested panels. |

Most MCP clients time out tool calls after one to a few minutes. The default wait of 55 seconds suits a `budget` debate; for a `precision` debate expect the first call to return `running`, then call `mercury_get_debate` with the id.

## Client configuration

Clients that support remote MCP servers with custom headers:

```json
{
  "mcpServers": {
    "mercury": {
      "url": "https://demo.mercury.sh/mcp",
      "headers": { "X-OpenRouter-Key": "sk-or-v1-..." }
    }
  }
}
```

Self-hosted: use your own URL and `"headers": { "Authorization": "Bearer <MERCURY_API_TOKEN>" }`.

Claude Desktop and other stdio-only clients can use the `mcp-remote` bridge:

```json
{
  "mcpServers": {
    "mercury": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://demo.mercury.sh/mcp", "--header", "X-OpenRouter-Key: sk-or-v1-..."]
    }
  }
}
```

Client menus and file locations change between versions; check your client's documentation for where this JSON goes.

## Try it by hand

```bash
curl -s -X POST https://demo.mercury.sh/mcp -H "X-OpenRouter-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mercury_quick_answer","arguments":{"query":"What is 12*12?"}}}'
```

## A note on cost and trust

A debate with the `precision` workflow uses three frontier models for up to ten rounds. Give the agent a key with a credit limit, and prefer `budget` unless the question warrants more. The consensus score is a stopping signal, not a correctness guarantee.

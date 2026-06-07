# n8n MCP Server Setup

This optional setup lets an MCP-capable AI assistant manage a self-hosted n8n instance through the n8n API.

## Prerequisites

- Node.js 18 or newer
- A running self-hosted n8n instance
- An n8n API key
- An MCP client such as Claude Desktop

## Configure Claude Desktop

On Windows, edit:

```text
%APPDATA%\Claude\claude_desktop_config.json
```

Add or merge:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": [
        "-y",
        "@leonardsellem/n8n-mcp-server"
      ],
      "env": {
        "N8N_API_URL": "http://YOUR_N8N_HOST:5678/api/v1",
        "N8N_API_KEY": "your_n8n_api_key_here"
      }
    }
  }
}
```

Replace `YOUR_N8N_HOST` and `your_n8n_api_key_here`.

## Workflow Access

The MCP server can list workflows that the API key can see, but detailed reads and updates require workflow-level MCP access. In n8n, enable MCP access in the workflow settings for any workflow an assistant should inspect or update.

For the CRC automation cleanup, enable MCP access on:

```text
CRC - Report Queue
CRC - Manual Form
```

Those workflows should then be merged or replaced by one expansion-scoped workflow where manual intake and WarcraftLogs monitoring both feed the same queue.

## Troubleshooting

| Problem | Fix |
|---|---|
| MCP server does not load | Check `%APPDATA%\Claude\logs\mcp-server-n8n.log`. |
| `401 Unauthorized` | Regenerate or correct the n8n API key. |
| `ECONNREFUSED` | Confirm n8n is running and the URL/port is correct. |
| Workflow lists but details fail | Enable MCP access in that workflow's settings. |
| `npx` fails | Run `npx @leonardsellem/n8n-mcp-server --version` in a terminal. |

## Security

The MCP server can access your n8n API. Treat the API key like a password and do not commit client config files.

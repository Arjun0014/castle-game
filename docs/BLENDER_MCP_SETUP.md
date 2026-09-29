# BLENDER_MCP_SETUP.md

# Recommended Local Setup for Claude Code + Blender

There are multiple Blender MCP implementations.

For this project, use one consistent setup and do not run multiple Blender MCP bridges against the same Blender session at the same time.

Two reasonable choices exist:

1. Blender's official Lab MCP integration, recommended if using Blender 5.1+.
2. The widely used community `blender-mcp` package, which has a very direct Claude Code quickstart.

For simplicity, the steps below use the community package because the Claude Code commands are straightforward.

---

# Option A: Simple Claude Code Setup

## 1. Install Blender

Install Blender locally.

Keep the GUI running while Claude is actively controlling it.

Headless workflows can be created later, but the GUI connection is easier to debug during level production.

---

## 2. Install `uv`

On Windows PowerShell:

```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Close and reopen the terminal afterward if `uvx` is not immediately available.

Verify:

```powershell
uv --version
uvx --version
```

---

## 3. Register Blender MCP with Claude Code

Run:

```powershell
claude mcp add blender uvx blender-mcp
```

Then verify:

```powershell
claude mcp list
```

You should see a Blender MCP entry.

---

## 4. Install the Blender Add-on

Run:

```powershell
uvx blender-mcp install-addon
```

Then open Blender.

Go to:

```text
Edit
-> Preferences
-> Add-ons
```

Search for:

```text
Blender MCP
```

Enable:

```text
Interface: Blender MCP
```

If Blender was already open during installation, restart it if the add-on does not appear.

---

## 5. Start the Server Inside Blender

In Blender:

1. Open the 3D Viewport.
2. Press `N`.
3. Open the `BlenderMCP` tab.
4. Click `Start MCP Server`.

Keep Blender open.

---

## 6. Test from Claude Code

Start Claude Code in the game repository.

Ask:

```text
Use the Blender MCP connection. Inspect the currently open Blender scene and tell me the scene name, visible collections, and all objects in the scene. Do not modify anything.
```

If Claude can report the scene correctly, the connection works.

Then test a harmless edit:

```text
Using Blender MCP, add a cube named MCP_TEST at world position 0,0,2. Do not change anything else.
```

Verify it appears in Blender, then delete it.

---

# Option B: Blender Official Lab MCP

Blender now provides an official MCP Server project through Blender Lab.

The official Blender page currently requires Blender 5.1 or newer and an MCP add-on/server setup.

Official page:

`https://www.blender.org/lab/mcp-server/`

Install the Blender add-on from that page, configure its MCP server for a stdio-compatible client such as Claude Code, then start Blender and verify the connection.

If using the official integration, do not also run `uvx blender-mcp` unless you intentionally want a second separate server.

---

# How the Local Connection Works

```text
Claude Code
   |
   | MCP
   v
local MCP bridge
   |
   | local socket
   v
Blender add-on
   |
   v
Blender Python API / current .blend scene
```

Claude is not rendering the game inside the terminal.

It is issuing commands to the local Blender session.

---

# Practical Advice for This Project

## Keep Blender open

For interactive scene building, keep Blender open while Claude Code works.

## Save often

Ask Claude to save explicit `.blend` files after meaningful milestones.

Examples:

```text
assets/blender/modular_kit.blend
assets/blender/levels/floor_01.blend
```

Do not rely on one unsaved Blender session.

## Confirm the active file before major edits

Before modeling, have Claude report:

- current `.blend` path;
- active scene;
- collections;
- object count.

## Security

Blender MCP systems can execute generated Python in Blender.

Use the connection only in a project/workstation context you trust.

Do not give the Blender session access to unrelated sensitive files if unnecessary.

---

# Troubleshooting

## Claude says Blender tools are unavailable

Run:

```powershell
claude mcp list
```

If Blender is not listed, add it again.

Restart Claude Code after changing MCP configuration.

## Blender add-on is missing

Re-run:

```powershell
uvx blender-mcp install-addon
```

Restart Blender and enable the add-on in Preferences.

## Claude sees the MCP but cannot reach Blender

Check:

- Blender is open;
- the BlenderMCP add-on is enabled;
- the Blender MCP server has been started from the `N` sidebar;
- another MCP client is not already occupying the same connection/port.

## Changes happen in the wrong file

Before modeling, ask Claude to report the current Blender file path and active scene.

Save the intended project `.blend` first.

---

# Project Test Prompt

Once connected, use:

```text
Read CLAUDE.md and docs/CONTEXT.md first. Then inspect the open Blender scene through Blender MCP. Do not modify it yet. Report the current .blend path, scenes, collections, object count, material count, and whether the existing project assets are linked or imported. Update docs/CONTEXT.md with verified facts only.
```

# Blender mit Codex verbinden

Blender 5.2.1 LTS ist unter /Applications/Blender.app installiert.
Diese Anleitung verwendet das Community-Projekt ahujasid/blender-mcp. Nicht mit dem separaten Blender-Lab-Addon mischen.

Quellen:
- https://github.com/ahujasid/blender-mcp
- https://learn.chatgpt.com/docs/extend/mcp?surface=cli

1. uv installieren. Falls Homebrew vorhanden ist: `brew install uv`. Alternativ den offiziellen uv-Installer unter https://docs.astral.sh/uv/getting-started/installation/ verwenden.
2. Im Terminal: `uvx blender-mcp install-addon`
3. Blender neu öffnen. Edit → Preferences → Add-ons → nach „MCP for Blender“ suchen und aktivieren.
4. Im 3D-Fenster N drücken → MCP for Blender → Start MCP Server (je nach Addon-Version Connect to Claude).
5. Im Terminal: `codex mcp add blender --env DISABLE_TELEMETRY=true -- uvx blender-mcp`
6. Codex neu starten bzw. den Task neu öffnen, damit neue Tools geladen werden. Blender geöffnet lassen.
7. Prüfen lassen: „Lies über Blender-MCP die aktuelle Szene und nenne die Objekte.“ Erst nach erfolgreichem Szenenabruf ist die Verbindung verifiziert.

Falls Codex uvx nicht findet: `which uvx` im Terminal ausführen und im Registrierungsbefehl uvx durch den ausgegebenen absoluten Pfad ersetzen.

Kein API-Key für diese lokale Blender-Verbindung nötig. Keine optionalen Sketchfab-/Hyper3D-Dienste für unseren Einstieg aktivieren.

Aktueller Status: Anleitung vorbereitet; MCP nicht installiert oder verbunden. Community-Addon führt vom Assistenten erstellte Python-Befehle lokal in Blender aus.

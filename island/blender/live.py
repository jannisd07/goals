#!/usr/bin/env python3
"""Direkter Draht zum laufenden Blender über das blender-mcp Add-on (Port 9876).

  python3 island/blender/live.py info
  python3 island/blender/live.py exec  <datei.py>
  python3 island/blender/live.py shot  <ziel.png>

Läuft mit dem System-Python, braucht kein bpy. Der Code in <datei.py> wird
innerhalb von Blender ausgeführt; print-Ausgaben kommen zurück.
"""

import json
import socket
import sys

HOST, PORT = "127.0.0.1", 9876


def send(cmd_type, params=None, timeout=900):
    s = socket.create_connection((HOST, PORT), timeout=timeout)
    s.sendall(json.dumps({"type": cmd_type, "params": params or {}}).encode())
    buf = b""
    data = None
    while True:
        chunk = s.recv(1 << 16)
        if not chunk:
            break
        buf += chunk
        try:
            data = json.loads(buf.decode())
            break
        except ValueError:
            continue
    s.close()
    if data is None:
        raise RuntimeError("keine gültige Antwort: " + buf.decode()[:300])
    return data


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "info"
    if action == "info":
        print(json.dumps(send("get_scene_info"), indent=1))
    elif action == "exec":
        code = open(sys.argv[2]).read()
        r = send("execute_code", {"code": code})
        if r.get("status") != "success":
            print("FEHLER:", json.dumps(r, indent=1))
            sys.exit(1)
        print(r.get("result", {}).get("result", ""))
    elif action == "shot":
        r = send("get_viewport_screenshot", {"max_size": 1400, "filepath": sys.argv[2], "format": "png"})
        print(json.dumps(r)[:400])
    else:
        print(__doc__)


if __name__ == "__main__":
    main()

"""Tiny local SMTP sink for testing the enquiry handler. Never use in production.

Accepts any message on 127.0.0.1:<port> and saves it as an .eml file.
Usage: python tests/smtp-sink.py <port> <output-dir> [--reject] [--auth-log <file>]
With --reject, every message is refused (to test failure handling).
With --auth-log, AUTH PLAIN is offered and the decoded user and password are
appended to <file>, so tests can check what credentials the handler sends.
"""
import asyncio
import base64
import sys
import time
from pathlib import Path

port = int(sys.argv[1])
out = Path(sys.argv[2])
reject = "--reject" in sys.argv
auth_log = Path(sys.argv[sys.argv.index("--auth-log") + 1]) if "--auth-log" in sys.argv else None
out.mkdir(parents=True, exist_ok=True)


async def handle(reader, writer):
    def send(line):
        writer.write((line + "\r\n").encode())

    send("220 localhost test sink")
    await writer.drain()
    data_mode = False
    lines = []
    envelope = {"from": "", "to": []}
    while True:
        raw = await reader.readline()
        if not raw:
            break
        line = raw.decode("utf-8", "replace").rstrip("\r\n")
        if data_mode:
            if line == ".":
                data_mode = False
                name = out / f"{time.time_ns()}.eml"
                name.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8", newline="")
                lines = []
                send("250 OK queued")
            else:
                lines.append(line[1:] if line.startswith("..") else line)
            await writer.drain()
            continue
        cmd = line.upper()
        if cmd.startswith("EHLO"):
            send("250-localhost")
            send("250-8BITMIME")
            if auth_log:
                send("250-AUTH PLAIN")
            send("250 SIZE 52428800")
        elif cmd.startswith("AUTH PLAIN") and auth_log:
            payload = line.split(" ", 2)[2] if line.count(" ") >= 2 else ""
            if not payload:  # client waits for a 334 prompt, then sends the credentials
                send("334 ")
                await writer.drain()
                payload = (await reader.readline()).decode().strip()
            parts = base64.b64decode(payload).split(b"\0")
            with auth_log.open("a", encoding="utf-8") as fh:
                fh.write(parts[1].decode() + "\t" + parts[2].decode() + "\n")
            send("235 Authentication successful")
        elif cmd.startswith("HELO"):
            send("250 localhost")
        elif cmd.startswith("MAIL FROM"):
            envelope["from"] = line
            send("250 OK")
        elif cmd.startswith("RCPT TO"):
            if reject:
                send("550 Rejected by test sink")
            else:
                envelope["to"].append(line)
                send("250 OK")
        elif cmd == "DATA":
            data_mode = True
            send("354 End data with <CR><LF>.<CR><LF>")
        elif cmd == "QUIT":
            send("221 Bye")
            await writer.drain()
            break
        else:
            send("250 OK")
        await writer.drain()
    writer.close()


async def main():
    server = await asyncio.start_server(handle, "127.0.0.1", port)
    print(f"SMTP sink on {port}{' (rejecting)' if reject else ''}", flush=True)
    async with server:
        await server.serve_forever()


asyncio.run(main())

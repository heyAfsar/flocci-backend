#!/usr/bin/env python3
"""
Careers acceptance watcher (Flocci hiring drives).

Candidates accept a challenge by replying "I ACCEPT <REF>" to the official
mailbox. This long-running job polls that mailbox and, for every valid
acceptance, immediately:
  1. assigns the Talent assessment through the Careers Portal API with the
     candidate's own start deadline (START_WITHIN_HOURS from now),
  2. invites the candidate to the drive's workspace (central org identity,
     accept link on Projects), and
  3. sends a confirmation from the official address with the start deadline.

Each step is idempotent and recorded in STATE_FILE, so restarts and retries
never double-assign, re-issue (and thereby revoke) an invite, or re-send.

Runs on the VPS under pm2 (stdlib only):
  python3 scripts/careers-acceptance-watcher.py            # poll forever
  python3 scripts/careers-acceptance-watcher.py --once     # one pass
  python3 scripts/careers-acceptance-watcher.py --accept FLC-XXXX-XXXX
        # process an acceptance that arrived elsewhere (e.g. another inbox)

Config: WATCHER_ENV_FILE (KEY=VALUE lines) plus ROSTER_FILE, a JSON list of
{ref, email, name, product, sent_at} for the drive.
"""

import argparse
import email
import imaplib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr

HERE = os.path.dirname(os.path.abspath(__file__))
REF_RE = re.compile(r"\bI\s+ACCEPT\s+(FLC-[A-Z0-9]{4}-[A-Z0-9]{4})\b", re.I)
IST = timezone(timedelta(hours=5, minutes=30))


def load_env(path):
    env = {}
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


ENV = load_env(os.environ.get("WATCHER_ENV_FILE", os.path.join(HERE, "careers-watcher.env")))


def cfg(key, default=None):
    value = os.environ.get(key) or ENV.get(key) or default
    if value is None:
        sys.exit(f"[watcher] missing config {key}")
    return value


IMAP_USER = cfg("WATCH_IMAP_USER")
IMAP_PASS = cfg("WATCH_IMAP_PASS")
ROSTER_FILE = cfg("ROSTER_FILE")
STATE_FILE = cfg("STATE_FILE")
TALENT_PORTAL_URL = cfg("TALENT_PORTAL_URL", "http://127.0.0.1:5006/api/portal/v1")
TALENT_PORTAL_KEY = cfg("TALENT_PORTAL_KEY")
ASSESSMENT_ID = cfg("ASSESSMENT_ID")
START_WITHIN_HOURS = int(cfg("START_WITHIN_HOURS", "24"))
ACCEPT_WITHIN_HOURS = int(cfg("ACCEPT_WITHIN_HOURS", "48"))
ORG_IDENTITY_URL = cfg("ORG_IDENTITY_URL", "http://127.0.0.1:3207")
ORG_IDENTITY_SERVICE_KEY = cfg("ORG_IDENTITY_SERVICE_KEY")
ORG_ID = cfg("ORG_ID")
ORG_NAME = cfg("ORG_NAME", "Flocci Hiring Drive 2026")
ORG_ACTOR_USER_ID = cfg("ORG_ACTOR_USER_ID")
INVITE_ACCEPT_BASE = cfg("INVITE_ACCEPT_BASE", "https://projects.flocci.in")
NOTIFICATION_URL = cfg("NOTIFICATION_URL", "http://127.0.0.1:3201")
NOTIFICATION_SERVICE_KEY = cfg("NOTIFICATION_SERVICE_KEY", "")
REPLY_TO = cfg("REPLY_TO", IMAP_USER)
POLL_SECONDS = int(cfg("POLL_SECONDS", "60"))
SUBJECT_MATCH = cfg("SUBJECT_MATCH", "Round 1 challenge")


def log(msg):
    print(f"{datetime.now(timezone.utc).isoformat()} {msg}", flush=True)


def load_json(path, default):
    try:
        with open(path) as fh:
            return json.load(fh)
    except FileNotFoundError:
        return default


def save_state(state):
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(state, fh, indent=2, sort_keys=True)
    os.replace(tmp, STATE_FILE)


def http_json(url, body, headers):
    req = urllib.request.Request(
        url, json.dumps(body).encode(), {"Content-Type": "application/json", **headers}
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, json.load(res)
    except urllib.error.HTTPError as err:
        return err.code, {"error": err.read().decode(errors="replace")[:300]}


def parse_iso(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def fmt_ist(dt):
    return dt.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")


# ── Steps ────────────────────────────────────────────────────────────────────

def step_assign(rec, person):
    if rec.get("start_by"):
        return True
    status, res = http_json(
        f"{TALENT_PORTAL_URL}/assignments",
        {"email": person["email"], "assessment_id": ASSESSMENT_ID,
         "focus": person["product"], "start_within_hours": START_WITHIN_HOURS},
        {"X-Talent-Portal-Key": TALENT_PORTAL_KEY},
    )
    if status != 200:
        rec["last_error"] = f"assign {status} {res}"
        return False
    rec["assignment_id"] = res["assignment"]["id"]
    rec["start_by"] = res["assignment"]["start_by"]
    return True


def step_invite(rec, person):
    if rec.get("invite_id"):
        return True
    headers = {"X-Flocci-Service-Key": ORG_IDENTITY_SERVICE_KEY}
    status, res = http_json(
        f"{ORG_IDENTITY_URL}/v1/orgs/{ORG_ID}/invites",
        {"actor_user_id": ORG_ACTOR_USER_ID, "email": person["email"], "role": "member",
         "accept_base": INVITE_ACCEPT_BASE, "app_id": "work-apps"},
        headers,
    )
    if status != 201:
        rec["last_error"] = f"invite {status} {res}"
        return False
    rec["invite_id"] = res["invite"]["id"]
    return True


def confirmation_html(person, ref, start_by):
    name = person["name"]
    product = person["product"]
    deadline = fmt_ist(start_by)
    card = ("background:#fff;border:1px solid #e6e8eb;border-left:4px solid {c};border-radius:10px;"
            "padding:16px 18px;margin:0 0 14px")
    label = ("font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;"
             "margin-bottom:8px;color:{c}")
    return f"""<div style="background:#f5f6f8;padding:20px 10px;font:15px/1.55 Arial,Helvetica,sans-serif;color:#1f2328"><div style="max-width:620px;margin:0 auto">
<div style="font-size:12px;font-weight:bold;letter-spacing:1px;color:#5b6270">FLOCCI TECHNOLOGIES, ROUND 1</div>
<div style="font-size:23px;font-weight:bold;margin:6px 0">You're in, {name}</div>
<p style="color:#5b6270;margin:0 0 16px">We have your acceptance for <b>{ref}</b>. Your challenge on <b>{product}</b> is now live on your dashboard.</p>
<div style="background:#fff4f2;border:2px solid #d93025;border-radius:12px;padding:18px 20px;margin:0 0 16px">
<div style="{label.format(c='#b3261e')}">Press Start before</div>
<div style="font:bold 21px Menlo,Consolas,monospace;color:#b3261e">{deadline}</div>
<div style="font-size:14px;margin-top:8px">That is 24 hours from your acceptance. If you have not pressed Start by then, you are automatically disqualified.</div></div>
<div style="{card.format(c='#7c3aed')}"><div style="{label.format(c='#7c3aed')}">Your workspace invite</div>
<p style="margin:0">We have just invited <b>{person['email']}</b> to the <b>{ORG_NAME}</b> workspace. Look for the email titled <i>[Flocci] You've been invited to {ORG_NAME}</i> and open its link to join. That is where your Projects board and your private Library space for the report live.</p></div>
<div style="{card.format(c='#ea580c')}"><div style="{label.format(c='#ea580c')}">Next steps</div>
<ol style="margin:0;padding-left:20px"><li>Accept the workspace invite.</li>
<li>Sign in at <a href="https://flocci.in">flocci.in</a> with <b>{person['email']}</b> and open <a href="https://flocci.in/dashboard">your dashboard</a>.</li>
<li>Press <b>Start</b> before {deadline}. You then have 72 hours to submit.</li></ol></div>
<p>Questions? Reply to this email.</p><p>Afsar<br><span style="color:#5b6270">Founder, Flocci Technologies</span></p></div></div>"""


def step_confirm(rec, person, ref):
    if rec.get("confirmed_at"):
        return True
    headers = {"X-Flocci-Service-Key": NOTIFICATION_SERVICE_KEY} if NOTIFICATION_SERVICE_KEY else {}
    status, res = http_json(
        f"{NOTIFICATION_URL}/v1/email/send",
        {"app_id": "flocci-careers", "recipient_contact": person["email"],
         "subject": f"Confirmed: your Flocci Round 1 challenge is live ({ref})",
         "html": confirmation_html(person, ref, parse_iso(rec["start_by"])),
         "reply_to": REPLY_TO, "idempotency_key": f"careers-accept-confirm-{ref}"},
        headers,
    )
    if status != 200 or res.get("status") not in ("sent", "delivered"):
        rec["last_error"] = f"confirm {status} {res}"
        return False
    rec["confirmed_at"] = datetime.now(timezone.utc).isoformat()
    return True


def process(ref, accepted_at, sender, roster, state, source):
    person = roster.get(ref)
    if not person:
        log(f"[watcher] unknown ref {ref} from {sender} ({source})")
        return
    done = state.get(ref, {})
    if done.get("confirmed_at") or done.get("rejected"):
        return
    if source == "mailbox" and sender != person["email"].lower():
        # Only the candidate's own address can accept by mail; anything else waits for --accept.
        mismatch = state.setdefault("_sender_mismatch", {})
        if mismatch.get(ref) != sender:
            mismatch[ref] = sender
            log(f"[watcher] {ref} reply from {sender}, expected {person['email']}; needs manual --accept")
            save_state(state)
        return
    rec = state.setdefault(ref, {"email": person["email"]})
    rec.setdefault("accepted_at", accepted_at.isoformat())
    rec.setdefault("source", source)
    sent_at = parse_iso(person["sent_at"])
    if accepted_at - sent_at > timedelta(hours=ACCEPT_WITHIN_HOURS):
        rec["rejected"] = "accepted after the reply window"
        log(f"[watcher] {ref} late acceptance, not processed")
        save_state(state)
        return
    ok = step_assign(rec, person) and step_invite(rec, person) and step_confirm(rec, person, ref)
    if ok:
        rec.pop("last_error", None)
        log(f"[watcher] {ref} {person['email']} assigned, invited, confirmed; start_by {rec['start_by']}")
    else:
        log(f"[watcher] {ref} incomplete, will retry: {rec.get('last_error')}")
    save_state(state)


# ── Mailbox ──────────────────────────────────────────────────────────────────

def reply_text(msg):
    """Plain text of the reply, without the quoted original."""
    part_text = ""
    for part in msg.walk():
        if part.get_content_type() == "text/plain" and not part.get_filename():
            payload = part.get_payload(decode=True) or b""
            part_text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
            break
    if not part_text:
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True) or b""
                part_text = re.sub(r"<[^>]+>", " ", payload.decode(part.get_content_charset() or "utf-8", errors="replace"))
                part_text = re.split(r"wrote:", part_text, maxsplit=1)[0]
                break
    lines = []
    for line in part_text.splitlines():
        if line.lstrip().startswith(">") or re.match(r"^\s*On .+wrote:\s*$", line):
            break
        lines.append(line)
    return "\n".join(lines)


def poll_mailbox(roster, state):
    box = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=60)
    try:
        box.login(IMAP_USER, IMAP_PASS)
        box.select("INBOX", readonly=True)
        typ, data = box.search(None, "X-GM-RAW", f'"newer_than:7d subject:({SUBJECT_MATCH})"')
        if typ != "OK":
            return
        for num in data[0].split():
            typ, msg_data = box.fetch(num, "(RFC822)")
            if typ != "OK" or not msg_data or not msg_data[0]:
                continue
            msg = email.message_from_bytes(msg_data[0][1])
            sender = parseaddr(msg.get("From", ""))[1].lower()
            auto = (msg.get("Auto-Submitted") or "no").lower() != "no"
            if auto or sender == IMAP_USER.lower() or re.match(r"(mailer-daemon|postmaster|no-?reply)", sender):
                continue
            match = REF_RE.search(reply_text(msg))
            if not match:
                continue
            ref = match.group(1).upper()
            try:
                accepted_at = email.utils.parsedate_to_datetime(msg.get("Date")).astimezone(timezone.utc)
            except Exception:
                accepted_at = datetime.now(timezone.utc)
            process(ref, accepted_at, sender, roster, state, "mailbox")
    finally:
        try:
            box.logout()
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--accept", help="process a REF accepted outside the watched mailbox")
    parser.add_argument("--at", help="ISO time the acceptance arrived (with --accept)")
    args = parser.parse_args()

    roster = {p["ref"]: p for p in load_json(ROSTER_FILE, [])}
    state = load_json(STATE_FILE, {})

    if args.accept:
        at = parse_iso(args.at) if args.at else datetime.now(timezone.utc)
        process(args.accept.upper(), at, None, roster, state, "manual")
        print(json.dumps(state.get(args.accept.upper()), indent=2))
        return

    log(f"[watcher] watching {IMAP_USER} for {len(roster)} candidates every {POLL_SECONDS}s")
    while True:
        try:
            poll_mailbox(roster, state)
        except Exception as exc:  # keep the job alive across mailbox or network blips
            log(f"[watcher] poll failed: {exc!r}")
        if args.once:
            return
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

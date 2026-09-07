# Consent Tracker

A small real-time, consent-based mobile location tracker.

## Requirements

- Node.js 18+
- A modern browser with geolocation support

## Run

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## How it works

1. On Device A, choose **Share my location**.
2. Give the generated 8-character session ID to the viewer.
3. On Device A, press **Start sharing** and explicitly allow browser location permission.
4. On Device B, enter the session ID and choose **View location**.
5. Device B receives location updates through the server, so the devices do not need to be on the same Wi-Fi.

## Important deployment note

Browser geolocation normally requires a secure context (HTTPS) when deployed. `localhost` is treated as a secure context for local development.

This project intentionally does not provide hidden tracking, phone-number tracking, spyware, or a mechanism to bypass location permission.

## Production hardening

Before public deployment, add authentication, HTTPS, rate limiting, persistent storage if needed, session expiry, access controls, and server-side validation. For a production system, do not rely on an unguessable session ID alone for authorization.

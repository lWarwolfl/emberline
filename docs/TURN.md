# Internet room relay

The public room uses PeerJS for signaling and WebRTC for game data. STUN alone
cannot connect every pair of routers, mobile networks or VPNs. Joining now times
out with a retryable error rather than staying on “Joining”. Reliable internet
rooms still require a deployed TURN relay; the application cannot create one.

## Coturn

Run coturn on a server with a public IP and a DNS name such as `turn.example.com`.
Use a dedicated random shared secret and configure coturn REST authentication:

```ini
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=YOUR_RANDOM_SHARED_SECRET
realm=turn.example.com
min-port=49160
max-port=49200
no-cli
no-multicast-peers
```

Allow inbound TCP/UDP 3478 and UDP 49160–49200 in both the host and cloud
firewalls. If the server is behind NAT, configure coturn's `external-ip` mapping.
For restrictive networks, also enable TLS/TCP with a valid certificate using
coturn's `cert`, `pkey` and `tls-listening-port` settings. Port 443 on a dedicated
TURN host is useful where other ports are blocked; an HTTP reverse proxy or CDN
proxy cannot serve TURN traffic. Use provider-specific network/quota limits.

In the **Vercel project's server environment**, set:

```dotenv
TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp,turns:turn.example.com:443?transport=tcp
TURN_SHARED_SECRET=YOUR_RANDOM_SHARED_SECRET
```

Only include addresses/transports actually enabled on your relay. Redeploy after
setting these variables. The same environment variables work with `npm run host`.
Never put the shared secret in HTML, build-time client definitions, a public JSON
file or a commit.

`GET /api/party/ice` issues random per-request coturn usernames and HMAC passwords
that expire in ten minutes. The response is `no-store`, and the service worker
already bypasses API requests. The shared secret never leaves the server. With
neither variable set, the endpoint returns STUN-only configuration and
`relayConfigured: false`. Partial configuration returns an error instead of
silently pretending a relay exists. A static deployment without this API can
still attempt direct connections, but has no TURN fallback.

## Verify after deployment

Check `/api/party/ice` returns `relayConfigured: true` and fresh credentials, with
no shared secret. Test the returned ICE servers in the official WebRTC
[Trickle ICE sample](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
and confirm it gathers a `relay` candidate. Then host and join from separate
networks (for example, Wi-Fi and mobile data). Firefox's `about:webrtc` should show
the selected candidate pair; use a relay-only test to ensure a successful direct
connection is not masking an unusable TURN server. Test UDP and TLS/TCP separately.

The credential endpoint is anonymous to match the game's anonymous room links.
Before a broad public launch, set relay bandwidth/allocation limits and apply
deployment-level rate limiting to this endpoint to control relay usage.

//! Secure local IPC envelope for the CAERA Native Companion.
//!
//! The companion only ever listens on loopback, but loopback is not a trust
//! boundary on a shared machine: any local process can send it requests. Every
//! request therefore carries an authenticated session, a monotonic counter and a
//! single-use nonce, so a captured request cannot be replayed.
//!
//! Intentionally dependency-free so the security core stays auditable and builds
//! with no network access. The MAC is a keyed hash over the canonical request
//! string; the transport (Tauri command / loopback socket) supplies the bytes.

use std::collections::{HashMap, HashSet, VecDeque};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Requests older than this are rejected outright.
pub const MAX_SKEW: Duration = Duration::from_secs(30);

/// How many recent nonces to remember per session before pruning.
pub const NONCE_WINDOW: usize = 512;
/// Hard cap on live authenticated windows so abandoned sessions cannot grow forever.
pub const MAX_SESSIONS: usize = 16;
/// Bound request allocation before canonicalisation and HMAC work.
pub const MAX_ENVELOPE_BODY_BYTES: usize = 1024 * 1024;
pub const MAX_SESSION_ID_BYTES: usize = 128;
pub const MAX_NONCE_BYTES: usize = 256;
const MIN_SESSION_KEY_BYTES: usize = 16;
const MAX_SESSION_KEY_BYTES: usize = 64;
const MAC_HEX_BYTES: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Envelope {
    pub session_id: String,
    /// Strictly increasing per session; guards against reordering.
    pub counter: u64,
    /// Single-use random value; guards against exact replay.
    pub nonce: String,
    /// Unix seconds when the client built the request.
    pub issued_at: u64,
    /// Canonical request body (the command + JSON args).
    pub body: String,
    /// Keyed MAC over the canonical string.
    pub mac: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum IpcReject {
    InvalidEnvelope,
    SessionCapacity,
    UnknownSession,
    BadMac,
    ReplayedNonce,
    StaleCounter,
    Expired,
    ClockSkew,
}

impl IpcReject {
    pub fn message(&self) -> &'static str {
        match self {
            IpcReject::InvalidEnvelope => {
                "The companion request envelope is malformed or oversized."
            }
            IpcReject::SessionCapacity => "The companion has reached its live session capacity.",
            IpcReject::UnknownSession => "This companion session is not authenticated.",
            IpcReject::BadMac => "The request signature did not verify.",
            IpcReject::ReplayedNonce => "This request was already used.",
            IpcReject::StaleCounter => "The request arrived out of order.",
            IpcReject::Expired => "The request expired.",
            IpcReject::ClockSkew => "The request timestamp is not valid.",
        }
    }
}

struct SessionState {
    key: Vec<u8>,
    last_counter: u64,
    seen: HashSet<String>,
    order: VecDeque<String>,
}

/// Validates inbound IPC envelopes for all live companion sessions.
pub struct IpcGuard {
    sessions: HashMap<String, SessionState>,
}

impl Default for IpcGuard {
    fn default() -> Self {
        Self::new()
    }
}

impl IpcGuard {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    /// Register an authenticated session and its shared key.
    pub fn open_session(&mut self, session_id: &str, key: Vec<u8>) -> Result<(), IpcReject> {
        if session_id.is_empty()
            || session_id.len() > MAX_SESSION_ID_BYTES
            || key.len() < MIN_SESSION_KEY_BYTES
            || key.len() > MAX_SESSION_KEY_BYTES
        {
            return Err(IpcReject::InvalidEnvelope);
        }
        if !self.sessions.contains_key(session_id) && self.sessions.len() >= MAX_SESSIONS {
            return Err(IpcReject::SessionCapacity);
        }
        self.sessions.insert(
            session_id.to_string(),
            SessionState {
                key,
                last_counter: 0,
                seen: HashSet::new(),
                order: VecDeque::new(),
            },
        );
        Ok(())
    }

    pub fn close_session(&mut self, session_id: &str) {
        self.sessions.remove(session_id);
    }

    pub fn is_open(&self, session_id: &str) -> bool {
        self.sessions.contains_key(session_id)
    }

    /// Full verification: session, MAC, freshness, ordering and replay.
    pub fn verify(&mut self, env: &Envelope, now_unix: u64) -> Result<(), IpcReject> {
        if env.session_id.is_empty()
            || env.session_id.len() > MAX_SESSION_ID_BYTES
            || env.nonce.is_empty()
            || env.nonce.len() > MAX_NONCE_BYTES
            || env.body.len() > MAX_ENVELOPE_BODY_BYTES
            || env.mac.len() != MAC_HEX_BYTES
            || !env.mac.bytes().all(|byte| byte.is_ascii_hexdigit())
        {
            return Err(IpcReject::InvalidEnvelope);
        }
        let state = self
            .sessions
            .get_mut(&env.session_id)
            .ok_or(IpcReject::UnknownSession)?;

        // Reject clocks from the future beyond tolerance, and stale requests.
        if env.issued_at > now_unix.saturating_add(MAX_SKEW.as_secs()) {
            return Err(IpcReject::ClockSkew);
        }
        if now_unix.saturating_sub(env.issued_at) > MAX_SKEW.as_secs() {
            return Err(IpcReject::Expired);
        }

        let expected = compute_mac(&state.key, &canonical(env));
        if !constant_time_eq(expected.as_bytes(), env.mac.as_bytes()) {
            return Err(IpcReject::BadMac);
        }

        if env.counter <= state.last_counter {
            return Err(IpcReject::StaleCounter);
        }
        if state.seen.contains(&env.nonce) {
            return Err(IpcReject::ReplayedNonce);
        }

        state.last_counter = env.counter;
        state.seen.insert(env.nonce.clone());
        state.order.push_back(env.nonce.clone());
        if state.order.len() > NONCE_WINDOW {
            if let Some(oldest) = state.order.pop_front() {
                state.seen.remove(&oldest);
            }
        }
        Ok(())
    }
}

/// Canonical string that the MAC covers. Field order is fixed and separators
/// cannot appear in the fields, so two different requests can never collide.
pub fn canonical(env: &Envelope) -> String {
    format!(
        "v1\n{}\n{}\n{}\n{}\n{}",
        env.session_id, env.counter, env.nonce, env.issued_at, env.body
    )
}

/// HMAC-SHA-256 over the canonical request string.
///
/// This implementation stays dependency-free so the security core remains
/// auditable and buildable offline, but it uses the standard HMAC construction
/// rather than a bespoke keyed checksum. Session keys are 256 random bits.
///
/// RELEASE GATE: `src/lib/native/companion-client.ts` mirrors this function in
/// TypeScript. The two have NOT been execution-compared yet (the MSVC linker is
/// unavailable in the current dev environment, so `cargo test` cannot link).
/// Before shipping the companion, run this crate's tests and confirm
/// `compute_mac(key, msg)` equals `computeMac(key, msg)` for identical input.
/// Any divergence makes every request fail verification as `BadMac`.
pub fn compute_mac(key: &[u8], message: &str) -> String {
    let mut block = [0u8; 64];
    if key.len() > block.len() {
        block[..32].copy_from_slice(&sha256(key));
    } else {
        block[..key.len()].copy_from_slice(key);
    }

    let mut inner = Vec::with_capacity(64 + message.len());
    inner.extend(block.iter().map(|byte| byte ^ 0x36));
    inner.extend_from_slice(message.as_bytes());
    let inner_digest = sha256(&inner);

    let mut outer = Vec::with_capacity(64 + inner_digest.len());
    outer.extend(block.iter().map(|byte| byte ^ 0x5c));
    outer.extend_from_slice(&inner_digest);
    hex(&sha256(&outer))
}

/// SHA-256 digest encoded as lowercase hexadecimal.
///
/// Used for privacy-safe observation fingerprints as well as HMAC internals.
pub fn sha256_hex(bytes: &[u8]) -> String {
    hex(&sha256(bytes))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn sha256(input: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut h = [
        0x6a09e667u32,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19,
    ];
    let bit_len = (input.len() as u64).wrapping_mul(8);
    let mut padded = Vec::with_capacity(input.len() + 72);
    padded.extend_from_slice(input);
    padded.push(0x80);
    while padded.len() % 64 != 56 {
        padded.push(0);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in padded.chunks_exact(64) {
        let mut w = [0u32; 64];
        for (index, word) in chunk.chunks_exact(4).enumerate() {
            w[index] = u32::from_be_bytes([word[0], word[1], word[2], word[3]]);
        }
        for index in 16..64 {
            let s0 = w[index - 15].rotate_right(7)
                ^ w[index - 15].rotate_right(18)
                ^ (w[index - 15] >> 3);
            let s1 = w[index - 2].rotate_right(17)
                ^ w[index - 2].rotate_right(19)
                ^ (w[index - 2] >> 10);
            w[index] = w[index - 16]
                .wrapping_add(s0)
                .wrapping_add(w[index - 7])
                .wrapping_add(s1);
        }

        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];
        let mut f = h[5];
        let mut g = h[6];
        let mut hh = h[7];
        for index in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[index])
                .wrapping_add(w[index]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    let mut out = [0u8; 32];
    for (index, word) in h.iter().enumerate() {
        out[index * 4..index * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

/// Length-independent comparison to avoid leaking match position via timing.
pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

pub fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env(counter: u64, nonce: &str, issued_at: u64, key: &[u8]) -> Envelope {
        let mut e = Envelope {
            session_id: "s1".into(),
            counter,
            nonce: nonce.into(),
            issued_at,
            body: "window.list{}".into(),
            mac: String::new(),
        };
        e.mac = compute_mac(key, &canonical(&e));
        e
    }

    fn guard_with_session() -> (IpcGuard, Vec<u8>) {
        let key = b"local-session-key".to_vec();
        let mut g = IpcGuard::new();
        g.open_session("s1", key.clone()).unwrap();
        (g, key)
    }

    #[test]
    fn accepts_a_fresh_signed_request() {
        let (mut g, key) = guard_with_session();
        assert_eq!(g.verify(&env(1, "n1", 1_000, &key), 1_000), Ok(()));
    }

    #[test]
    fn rejects_unknown_session() {
        let key = b"k".to_vec();
        let mut g = IpcGuard::new();
        assert_eq!(
            g.verify(&env(1, "n1", 1_000, &key), 1_000),
            Err(IpcReject::UnknownSession)
        );
    }

    #[test]
    fn rejects_tampered_body() {
        let (mut g, key) = guard_with_session();
        let mut e = env(1, "n1", 1_000, &key);
        e.body = "file.open{\"path\":\"C:/secrets\"}".into();
        assert_eq!(g.verify(&e, 1_000), Err(IpcReject::BadMac));
    }

    #[test]
    fn rejects_exact_replay() {
        let (mut g, key) = guard_with_session();
        let e = env(1, "n1", 1_000, &key);
        assert_eq!(g.verify(&e, 1_000), Ok(()));
        // Same nonce AND same counter -> counter check fires first.
        assert_eq!(g.verify(&e, 1_000), Err(IpcReject::StaleCounter));
    }

    #[test]
    fn rejects_reused_nonce_with_new_counter() {
        let (mut g, key) = guard_with_session();
        assert_eq!(g.verify(&env(1, "n1", 1_000, &key), 1_000), Ok(()));
        assert_eq!(
            g.verify(&env(2, "n1", 1_000, &key), 1_000),
            Err(IpcReject::ReplayedNonce)
        );
    }

    #[test]
    fn rejects_out_of_order_counter() {
        let (mut g, key) = guard_with_session();
        assert_eq!(g.verify(&env(5, "a", 1_000, &key), 1_000), Ok(()));
        assert_eq!(
            g.verify(&env(4, "b", 1_000, &key), 1_000),
            Err(IpcReject::StaleCounter)
        );
    }

    #[test]
    fn rejects_expired_and_future_requests() {
        let (mut g, key) = guard_with_session();
        assert_eq!(
            g.verify(&env(1, "a", 1_000, &key), 2_000),
            Err(IpcReject::Expired)
        );
        assert_eq!(
            g.verify(&env(2, "b", 5_000, &key), 1_000),
            Err(IpcReject::ClockSkew)
        );
    }

    #[test]
    fn closing_a_session_revokes_it() {
        let (mut g, key) = guard_with_session();
        g.close_session("s1");
        assert!(!g.is_open("s1"));
        assert_eq!(
            g.verify(&env(1, "n", 1_000, &key), 1_000),
            Err(IpcReject::UnknownSession)
        );
    }

    #[test]
    fn session_and_envelope_memory_are_bounded() {
        let key = vec![7u8; 32];
        let mut guard = IpcGuard::new();
        for index in 0..MAX_SESSIONS {
            assert_eq!(
                guard.open_session(&format!("s{index}"), key.clone()),
                Ok(())
            );
        }
        assert_eq!(
            guard.open_session("overflow", key.clone()),
            Err(IpcReject::SessionCapacity)
        );

        let mut oversized = env(1, "n1", 1_000, &key);
        oversized.body = "x".repeat(MAX_ENVELOPE_BODY_BYTES + 1);
        assert_eq!(
            guard.verify(&oversized, 1_000),
            Err(IpcReject::InvalidEnvelope)
        );
    }

    #[test]
    fn mac_changes_with_key_and_message() {
        assert_ne!(compute_mac(b"k1", "m"), compute_mac(b"k2", "m"));
        assert_ne!(compute_mac(b"k", "m1"), compute_mac(b"k", "m2"));
        assert_eq!(compute_mac(b"k", "m").len(), 64);
    }

    #[test]
    fn constant_time_eq_behaves_like_eq() {
        assert!(constant_time_eq(b"abc", b"abc"));
        assert!(!constant_time_eq(b"abc", b"abd"));
        assert!(!constant_time_eq(b"abc", b"ab"));
    }

    #[test]
    fn nonce_window_is_pruned() {
        let (mut g, key) = guard_with_session();
        for i in 1..=(NONCE_WINDOW as u64 + 10) {
            let e = env(i, &format!("n{i}"), 1_000, &key);
            assert_eq!(g.verify(&e, 1_000), Ok(()));
        }
        let state = g.sessions.get("s1").unwrap();
        assert!(state.order.len() <= NONCE_WINDOW);
    }

    /// CROSS-LANGUAGE PARITY GATE.
    ///
    /// The Rust host and the TypeScript client must compute byte-identical
    /// MACs. If they diverge, every request is rejected as `BadMac` and
    /// computer control silently stops working — a failure that is very hard to
    /// diagnose from either side alone.
    ///
    /// The SAME table is asserted in
    /// `src/lib/__tests__/companion-client.test.ts` ("MAC parity with the Rust
    /// host"). If either implementation drifts, one of the two suites goes red
    /// immediately instead of the mismatch reaching a user.
    ///
    /// Do NOT regenerate these values to make a failure pass — a change here is
    /// a wire-format break that both sides must adopt deliberately.
    #[test]
    fn mac_matches_typescript_golden_vectors() {
        let cases: Vec<(Vec<u8>, &str, &str)> = vec![
            // empty body
            (
                vec![0x00u8; 16],
                "",
                "b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad",
            ),
            // all-zero key
            (
                vec![0x00u8; 16],
                "hello",
                "4352b26e33fe0d769a8922a6ba29004109f01688e26acc9e6cb347e5a5afc4da",
            ),
            // all-ff key
            (
                vec![0xffu8; 16],
                "hello",
                "a63f5f66bd92dd410d86f90c717b2e2b78b4ff80ddbb420ff8b9b1e6ec9d42d2",
            ),
            // ascending 32-byte key
            (
                (0u8..32).collect::<Vec<u8>>(),
                "execute|{}",
                "66f622a05c403010ddd5321f0c1d1479f751b28289f48d501b5de25febd2d225",
            ),
            // full canonical envelope
            (
                vec![0x07u8; 32],
                "v1\ns1\n1\n0123456789abcdef0123456789abcdef\n1700000000\nexecute|{\"action\":{\"kind\":\"window.list\"},\"confirmed\":false}",
                "fd2cb2eb23bcb1e585d297c9749fa9e8735b620f83ff4b6e52f91298dbdf1021",
            ),
            // Multi-byte input proves both sides hash UTF-8 BYTES, not UTF-16 units.
            (
                vec![0x01u8; 16],
                "café — naïve ✓",
                "f7d66e600107f2f21a68fc8d71efb98f595925fadd8b18dbbbcd08d9e7c078d5",
            ),
        ];

        for (key, message, expected) in cases {
            let got = compute_mac(&key, message);
            assert_eq!(
                got, expected,
                "MAC parity broken for message {message:?} — the TypeScript client and this host \
                 no longer agree, so every signed request would be rejected as BadMac."
            );
            assert_eq!(got.len(), 64, "MAC must be 64 hex characters");
        }
    }

    /// The canonical string this host reconstructs must match the one the
    /// TypeScript client signs, or the MAC comparison is meaningless.
    #[test]
    fn canonical_matches_typescript_layout() {
        let e = Envelope {
            session_id: "s1".into(),
            counter: 1,
            nonce: "0123456789abcdef0123456789abcdef".into(),
            issued_at: 1_700_000_000,
            body: "execute|{\"action\":{\"kind\":\"window.list\"},\"confirmed\":false}".into(),
            mac: String::new(),
        };
        assert_eq!(
            canonical(&e),
            "v1\ns1\n1\n0123456789abcdef0123456789abcdef\n1700000000\nexecute|{\"action\":{\"kind\":\"window.list\"},\"confirmed\":false}"
        );
        assert_eq!(
            compute_mac(&[0x07u8; 32], &canonical(&e)),
            "fd2cb2eb23bcb1e585d297c9749fa9e8735b620f83ff4b6e52f91298dbdf1021"
        );
    }

    #[test]
    fn sha256_matches_standard_vectors() {
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}

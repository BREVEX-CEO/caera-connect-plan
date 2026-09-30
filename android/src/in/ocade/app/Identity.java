package in.ocade.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;

/**
 * This phone's identity in OCADE: one P-256 key made and kept inside Android's
 * own key store (it never leaves the phone and cannot be copied off it), an
 * id OCADE gives it, and nothing else. Every request is signed exactly as the
 * Device Agent signs (`jarvis-runtime/ocade_protocol.json`, shipped in assets).
 */
final class Identity {
    static final String VERSION = "0.1.0";
    private static final String ALIAS = "ocade-device";

    final Context context;
    final SharedPreferences prefs;
    private final JSONObject protocol;
    private long lastStamp;

    Identity(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences("ocade", Context.MODE_PRIVATE);
        this.protocol = readProtocol(this.context);
    }

    private static JSONObject readProtocol(Context context) {
        try (InputStream in = context.getAssets().open("ocade_protocol.json")) {
            return new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("The OCADE protocol is missing from this build", e);
        }
    }

    String server() {
        return prefs.getString("server", "https://ocade.in");
    }

    String deviceId() {
        return prefs.getString("deviceId", null);
    }

    boolean connected() {
        return deviceId() != null && prefs.getBoolean("approved", false) && key() != null;
    }

    /** Waiting for the person to approve this phone in OCADE. */
    boolean waiting() {
        return deviceId() != null && !prefs.getBoolean("approved", false);
    }

    void setServer(String server) {
        prefs.edit().putString("server", server.replaceAll("/+$", "")).apply();
    }

    void approved() {
        prefs.edit().putBoolean("approved", true).apply();
    }

    /** What OCADE shows next to its Connect button, so the person can tell it is this phone. */
    String fingerprint() {
        return prefs.getString("fingerprint", "");
    }

    /** Everything this phone keeps for OCADE is removed: the key and the id. */
    void forget() {
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            store.deleteEntry(ALIAS);
        } catch (Exception ignored) {
            // nothing was there
        }
        String server = server();
        boolean asked = prefs.getBoolean("askedNotifications", false);
        // What belongs to the connection goes; what Android was already asked stays true.
        prefs.edit().clear().putString("server", server).putBoolean("askedNotifications", asked).apply();
    }

    private PrivateKey key() {
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            return (PrivateKey) store.getKey(ALIAS, null);
        } catch (Exception e) {
            return null;
        }
    }

    private PublicKey freshKey() throws Exception {
        forget();
        KeyPairGenerator generator =
                KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
        generator.initialize(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build());
        return generator.generateKeyPair().getPublic();
    }

    static String b64url(byte[] data) {
        return Base64.encodeToString(data, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    static String fingerprint(String publicText) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(publicText.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (int i = 0; i < 8; i++) hex.append(String.format("%02X", digest[i]));
        return hex.substring(0, 4) + "-" + hex.substring(4, 8) + "-" + hex.substring(8, 12) + "-"
                + hex.substring(12, 16);
    }

    /** Ask OCADE to connect this phone. Returns {url, fingerprint} for the person to approve. */
    String[] enroll(String name) throws Exception {
        PublicKey key = freshKey();
        String publicText = b64url(key.getEncoded());
        JSONObject body = new JSONObject()
                .put("publicKey", publicText)
                .put("name", name)
                .put("platform", "Android " + Build.VERSION.RELEASE)
                .put("kind", "android")
                .put("softwareVersion", VERSION);
        Reply reply = post(protocol.getJSONObject("paths").getString("enroll"), body, 30_000);
        if (reply.status != 200) {
            throw new IllegalStateException(reply.body.optString("error", "refused"));
        }
        String print = fingerprint(publicText);
        prefs.edit()
                .putString("deviceId", reply.body.getString("deviceId"))
                .putBoolean("approved", false)
                .putString("fingerprint", print)
                .apply();
        return new String[] {server() + reply.body.getString("approve"), print};
    }

    Reply exchange(JSONObject body) throws Exception {
        return post(protocol.getJSONObject("paths").getString("exchange"), body, 40_000);
    }

    static final class Reply {
        final int status;
        final JSONObject body;

        Reply(int status, JSONObject body) {
            this.status = status;
            this.body = body;
        }
    }

    /** One signed request. Timestamps only ever increase, so a captured request cannot be replayed. */
    synchronized Reply post(String path, JSONObject json, int timeoutMs) throws Exception {
        byte[] raw = json.toString().getBytes(StandardCharsets.UTF_8);
        String device = deviceId() == null ? "-" : deviceId();
        lastStamp = Math.max(System.currentTimeMillis(), lastStamp + 1);
        JSONObject signing = protocol.getJSONObject("signing");
        String canonical = String.join("\n",
                signing.getString("prefix"),
                String.valueOf(protocol.getInt("version")),
                "POST", path, device, String.valueOf(lastStamp), hexSha256(raw));
        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(key());
        signer.update(canonical.getBytes(StandardCharsets.UTF_8));
        JSONObject headers = protocol.getJSONObject("headers");

        HttpURLConnection connection = (HttpURLConnection) new URL(server() + path).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(timeoutMs);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("User-Agent", "OCADE-Android/" + VERSION);
        connection.setRequestProperty(headers.getString("device"), device);
        connection.setRequestProperty(headers.getString("protocol"), String.valueOf(protocol.getInt("version")));
        connection.setRequestProperty(headers.getString("timestamp"), String.valueOf(lastStamp));
        connection.setRequestProperty(headers.getString("signature"), b64url(rawSignature(signer.sign())));
        try (OutputStream out = connection.getOutputStream()) {
            out.write(raw);
        }
        int status = connection.getResponseCode();
        InputStream in = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String text = in == null ? "" : new String(readAll(in), StandardCharsets.UTF_8);
        connection.disconnect();
        return new Reply(status, text.isEmpty() ? new JSONObject() : new JSONObject(text));
    }

    /** DER (what Java makes) to the raw r||s WebCrypto verifies. */
    static byte[] rawSignature(byte[] der) {
        int offset = 3;
        int rLength = der[offset++];
        byte[] r = new byte[rLength];
        System.arraycopy(der, offset, r, 0, rLength);
        offset += rLength + 1;
        int sLength = der[offset++];
        byte[] s = new byte[sLength];
        System.arraycopy(der, offset, s, 0, sLength);
        byte[] out = new byte[64];
        copyFixed(new BigInteger(1, r).toByteArray(), out, 0);
        copyFixed(new BigInteger(1, s).toByteArray(), out, 32);
        return out;
    }

    private static void copyFixed(byte[] value, byte[] out, int at) {
        int skip = Math.max(0, value.length - 32);
        int length = value.length - skip;
        System.arraycopy(value, skip, out, at + 32 - length, length);
    }

    static String hexSha256(byte[] data) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(data);
        StringBuilder hex = new StringBuilder();
        for (byte b : digest) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int read;
        while ((read = in.read(chunk)) > 0) buffer.write(chunk, 0, read);
        return buffer.toByteArray();
    }
}

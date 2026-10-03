package in.ocade.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * OCADE's wake model on the phone: exactly what jarvis-runtime/ocade_wake.py does in
 * numpy — the same log-mel features and the same small network, read from the same
 * bundled weights (wake/ocade_wake_v1.npz, checked against its manifest's SHA-256).
 * Plain Java with no Android classes, so it is proved against numpy on a desktop JDK.
 */
public final class WakeModel {
    public static final int SAMPLE_RATE = 16000, FRAME = 400, HOP = 160, NFFT = 512, MELS = 40;
    public static final int WINDOW_SAMPLES = 25600, STEP_SAMPLES = 1600;
    public static final int WINDOW_FRAMES = 1 + (WINDOW_SAMPLES - FRAME) / HOP;
    static final double FMIN = 60.0, FMAX = 7600.0;
    static final String[] LAYERS = {"c1", "c2", "c3", "c4"};

    private final Map<String, float[]> w = new HashMap<>();
    private final Map<String, int[]> shapes = new HashMap<>();
    private final float[][] filters = melFilters();
    private final float[] window = new float[FRAME];
    final float threshold;
    private final int[] dilations = new int[4];

    /** The model, only if its bytes are the ones the manifest names. */
    public WakeModel(byte[] npz, String sha256) throws IOException {
        if (!hex(digest(npz)).equals(sha256)) throw new IOException("The wake model is damaged");
        try (ZipInputStream zip = new ZipInputStream(new java.io.ByteArrayInputStream(npz))) {
            for (ZipEntry entry; (entry = zip.getNextEntry()) != null; ) {
                readNpy(entry.getName().replace(".npy", ""), readAll(zip));
            }
        }
        threshold = w.get("threshold")[0];
        float[] d = w.get("dilations");
        for (int i = 0; i < 4; i++) dilations[i] = Math.round(d[i]);
        for (int i = 0; i < FRAME; i++) window[i] = (float) (0.5 - 0.5 * Math.cos(2 * Math.PI * i / FRAME));
    }

    // -- features -------------------------------------------------------------------

    static float[][] melFilters() {
        double lo = 2595 * Math.log10(1 + FMIN / 700), hi = 2595 * Math.log10(1 + FMAX / 700);
        double[] edges = new double[MELS + 2];
        for (int i = 0; i < edges.length; i++) {
            double mel = lo + (hi - lo) * i / (MELS + 1);
            edges[i] = 700 * (Math.pow(10, mel / 2595) - 1);
        }
        float[][] f = new float[MELS][NFFT / 2 + 1];
        for (int m = 0; m < MELS; m++) {
            for (int b = 0; b <= NFFT / 2; b++) {
                double hz = (double) b * SAMPLE_RATE / NFFT;
                double rising = (hz - edges[m]) / (edges[m + 1] - edges[m]);
                double falling = (edges[m + 2] - hz) / (edges[m + 2] - edges[m + 1]);
                f[m][b] = (float) Math.max(0, Math.min(rising, falling));
            }
        }
        return f;
    }

    /** samples in [-1, 1] at 16 kHz -> [frames][MELS] log-mel energies. */
    public float[][] logMel(float[] samples) {
        int count = 1 + (samples.length - FRAME) / HOP;
        float[][] out = new float[Math.max(count, 0)][MELS];
        double[] re = new double[NFFT], im = new double[NFFT];
        for (int t = 0; t < count; t++) {
            java.util.Arrays.fill(re, 0);
            java.util.Arrays.fill(im, 0);
            for (int i = 0; i < FRAME; i++) re[i] = samples[t * HOP + i] * window[i];
            fft(re, im);
            for (int m = 0; m < MELS; m++) {
                double sum = 0;
                for (int b = 0; b <= NFFT / 2; b++) {
                    float g = filters[m][b];
                    if (g != 0) sum += g * (re[b] * re[b] + im[b] * im[b]);
                }
                out[t][m] = (float) Math.log((float) sum + 1e-6f);
            }
        }
        return out;
    }

    static void fft(double[] re, double[] im) {
        int n = re.length;
        for (int i = 1, j = 0; i < n; i++) {
            int bit = n >> 1;
            for (; (j & bit) != 0; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                double t = re[i]; re[i] = re[j]; re[j] = t;
                t = im[i]; im[i] = im[j]; im[j] = t;
            }
        }
        for (int len = 2; len <= n; len <<= 1) {
            double angle = -2 * Math.PI / len;
            for (int i = 0; i < n; i += len) {
                for (int k = 0; k < len / 2; k++) {
                    double c = Math.cos(angle * k), s = Math.sin(angle * k);
                    int a = i + k, b = i + k + len / 2;
                    double xr = re[b] * c - im[b] * s, xi = re[b] * s + im[b] * c;
                    re[b] = re[a] - xr; im[b] = im[a] - xi;
                    re[a] += xr; im[a] += xi;
                }
            }
        }
    }

    // -- the network ------------------------------------------------------------------

    /** features [WINDOW_FRAMES][MELS] -> probability the window holds the phrase. */
    public float score(float[][] features) {
        int frames = features.length;
        float[] mean = w.get("mean"), std = w.get("std");
        float[][] x = new float[frames][MELS];
        for (int t = 0; t < frames; t++)
            for (int m = 0; m < MELS; m++) x[t][m] = (features[t][m] - mean[m]) / std[m];
        for (int l = 0; l < 4; l++) x = conv(x, LAYERS[l], dilations[l]);
        int channels = x[0].length;
        float[] pooled = new float[channels];
        java.util.Arrays.fill(pooled, Float.NEGATIVE_INFINITY);
        for (float[] row : x) for (int c = 0; c < channels; c++) pooled[c] = Math.max(pooled[c], row[c]);
        float[] hidden = dense(pooled, "f1", true);
        float logit = dense(hidden, "f2", false)[0];
        return (float) (1 / (1 + Math.exp(-logit)));
    }

    private float[][] conv(float[][] x, String name, int dilation) {
        float[] weight = w.get(name + ".weight"), bias = w.get(name + ".bias");
        int[] shape = shapes.get(name + ".weight");
        int cout = shape[0], cin = shape[1], k = shape[2], frames = x.length;
        int pad = dilation * (k - 1) / 2;
        float[][] out = new float[frames][cout];
        for (int t = 0; t < frames; t++) {
            for (int o = 0; o < cout; o++) {
                float sum = bias[o];
                for (int i = 0; i < k; i++) {
                    int at = t + i * dilation - pad;
                    if (at < 0 || at >= frames) continue;
                    float[] row = x[at];
                    int base = o * cin * k + i;
                    for (int c = 0; c < cin; c++) sum += weight[base + c * k] * row[c];
                }
                out[t][o] = Math.max(0, sum);
            }
        }
        return out;
    }

    private float[] dense(float[] x, String name, boolean relu) {
        float[] weight = w.get(name + ".weight"), bias = w.get(name + ".bias");
        int outs = bias.length, ins = x.length;
        float[] out = new float[outs];
        for (int o = 0; o < outs; o++) {
            float sum = bias[o];
            for (int i = 0; i < ins; i++) sum += weight[o * ins + i] * x[i];
            out[o] = relu ? Math.max(0, sum) : sum;
        }
        return out;
    }

    // -- the bundled file -------------------------------------------------------------

    private void readNpy(String name, byte[] bytes) throws IOException {
        ByteBuffer buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        buffer.position(8);
        int headerLength = buffer.getShort() & 0xffff;
        String header = new String(bytes, 10, headerLength, java.nio.charset.StandardCharsets.US_ASCII);
        buffer.position(10 + headerLength);
        java.util.regex.Matcher shapeAt = java.util.regex.Pattern.compile("'shape': \\(([^)]*)\\)").matcher(header);
        if (!shapeAt.find()) throw new IOException("Unreadable weight shape in " + name);
        String shapeText = shapeAt.group(1).replace(" ", "");
        int[] shape = shapeText.isEmpty() ? new int[0]
                : java.util.Arrays.stream(shapeText.split(",")).filter(s -> !s.isEmpty())
                        .mapToInt(Integer::parseInt).toArray();
        int size = 1;
        for (int s : shape) size *= s;
        float[] values = new float[size];
        if (header.contains("'<f4'")) {
            for (int i = 0; i < size; i++) values[i] = buffer.getFloat();
        } else if (header.contains("'<i4'")) {
            for (int i = 0; i < size; i++) values[i] = buffer.getInt();
        } else {
            throw new IOException("Unexpected weight type in " + name);
        }
        w.put(name, values);
        shapes.put(name, shape);
    }

    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] chunk = new byte[1 << 14];
        for (int n; (n = in.read(chunk)) > 0; ) out.write(chunk, 0, n);
        return out.toByteArray();
    }

    static byte[] digest(byte[] bytes) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(bytes);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder();
        for (byte b : bytes) out.append(String.format("%02x", b));
        return out.toString();
    }
}

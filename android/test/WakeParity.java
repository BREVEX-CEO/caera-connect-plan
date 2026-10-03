import in.ocade.app.WakeModel;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * Prints the phone model's score for each window in a file of float32 windows, so a
 * test can hold it against the Device Agent's numpy scores for the same audio.
 *   java WakeParity model.npz <sha256> windows.f32
 */
public final class WakeParity {
    public static void main(String[] args) throws Exception {
        WakeModel model = new WakeModel(Files.readAllBytes(Paths.get(args[0])), args[1]);
        byte[] raw = Files.readAllBytes(Paths.get(args[2]));
        ByteBuffer buffer = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN);
        int windows = raw.length / 4 / WakeModel.WINDOW_SAMPLES;
        for (int n = 0; n < windows; n++) {
            float[] audio = new float[WakeModel.WINDOW_SAMPLES];
            for (int i = 0; i < audio.length; i++) audio[i] = buffer.getFloat();
            System.out.println(model.score(model.logMel(audio)));
        }
    }
}

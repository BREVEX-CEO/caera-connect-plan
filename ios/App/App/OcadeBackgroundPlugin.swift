import Capacitor
import CryptoKit
import Foundation

/**
 The OCADE background companion, on iOS.

 WHY THIS IS A PLUGIN AND NOT A LOOPBACK SERVER. On a desktop the companion is a
 separate process and the page reaches it over 127.0.0.1. Inside this shell the
 companion IS this app, and loopback is not merely unnecessary — it is
 impossible: capacitor.config.json serves the application over https with
 cleartext and mixed content disabled and `limitsNavigationsToAppBoundDomains`
 set, so the web view blocks a request to http://127.0.0.1 before anything can
 answer. The bridge reaches this class through Capacitor instead; the protocol
 is otherwise identical, method for endpoint, and
 docs/OCADE_BACKGROUND_COMPANION_PROTOCOL.md governs both.

 WHY A BACKGROUND URLSession. It is the only iOS mechanism that keeps
 transferring once the app is suspended or terminated: the system takes the
 download over, finishes it, and relaunches the app to hand back the file. That
 is the whole benefit a handoff exists to buy — a tab can promise to resume when
 the person returns, and this can promise the model will already be there.

 WHAT THIS DELIBERATELY DOES NOT DO

 It does not decide whether the artifact is genuine. It reports the digest it
 computed and the website compares it with the one in its own committed
 catalogue before anything is activated. Being part of the same application does
 not make this the judge of its own work.

 It does not substitute a source of its own: the website's ordered ladder is
 worked in order, so a failover here lands where a failover in the browser would.

 It does not start a second transfer for a version already in flight. The job
 registry is in UserDefaults rather than in memory, because the process this
 class lives in is exactly the process iOS is free to terminate — and a registry
 that died with it would let the next launch start the same gigabyte again.
 */
@objc(OcadeBackgroundPlugin)
public class OcadeBackgroundPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OcadeBackgroundPlugin"
    public let jsName = "OcadeBackground"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "identity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "progress", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uninstall", returnType: CAPPluginReturnPromise),
    ]

    /// The protocol version in the document above. Anything else the web side refuses.
    private static let protocolVersion = 1
    private static let store = "ocade.background.jobs"
    private static let directoryName = "ocade-intelligence"

    private let transfers = OcadeBackgroundTransfers.shared

    // MARK: - identity

    @objc func identity(_ call: CAPPluginCall) {
        call.resolve([
            "product": "ocade-companion",
            "protocol": Self.protocolVersion,
            "platform": "ios",
            /*
             The truth about THIS install. A build whose background session
             cannot be created offers nothing the tab does not already have, and
             the website must keep the work rather than hand it somewhere it
             would stall.
             */
            "backgroundTransfer": transfers.isAvailable,
        ])
    }

    // MARK: - prepare

    @objc func prepare(_ call: CAPPluginCall) {
        guard let version = call.getString("version"),
              let sha256 = call.getString("sha256"),
              let sources = call.getArray("sources") as? [String],
              let first = sources.first
        else {
            call.reject("prepare needs a version, a digest and at least one source")
            return
        }

        /*
         A version already in flight returns the job it already has. Returning a
         new one would be the two-downloads defect the protocol's first rule
         exists to prevent, arrived at from the native side instead of the web
         one.
         */
        if let existing = transfers.jobId(forVersion: version) {
            call.resolve(["jobId": existing])
            return
        }

        guard let url = URL(string: first) else {
            call.reject("the first source is not a usable address")
            return
        }

        let jobId = transfers.start(
            version: version,
            sha256: sha256,
            sources: sources,
            sourceIndex: 0,
            url: url,
            destination: Self.artifactURL(version: version)
        )
        guard let jobId else {
            call.reject("the download could not be started")
            return
        }
        call.resolve(["jobId": jobId])
    }

    // MARK: - progress

    @objc func progress(_ call: CAPPluginCall) {
        guard let jobId = call.getString("jobId") else {
            call.reject("progress needs a jobId")
            return
        }
        guard let job = transfers.job(jobId) else {
            call.resolve(["phase": "idle", "version": "", "receivedBytes": 0, "totalBytes": nil])
            return
        }

        let file = Self.artifactURL(version: job.version)
        if transfers.isFinished(jobId), FileManager.default.fileExists(atPath: file.path) {
            /*
             Hashed only now. A digest reported before the artifact is whole
             would be compared against the published one and rejected, so
             reporting one early is worse than reporting none — it turns a
             working transfer into a failed handoff.
             */
            let attributes = try? FileManager.default.attributesOfItem(atPath: file.path)
            let size = (attributes?[.size] as? NSNumber)?.intValue ?? 0
            var result: [String: Any] = [
                "phase": "complete",
                "version": job.version,
                "receivedBytes": size,
                "totalBytes": size,
            ]
            if let digest = Self.digest(of: file) { result["sha256"] = digest }
            result["artifactUrl"] = bridge?.portablePath(fromLocalURL: file)?.absoluteString ?? file.absoluteString
            call.resolve(result)
            return
        }

        if let failure = transfers.failure(jobId) {
            if transfers.advanceToNextSource(jobId) {
                call.resolve([
                    "phase": "downloading",
                    "version": job.version,
                    "receivedBytes": 0,
                    "totalBytes": job.totalBytes as Any,
                ])
                return
            }
            call.resolve([
                "phase": "failed",
                "version": job.version,
                "receivedBytes": job.receivedBytes,
                "totalBytes": job.totalBytes as Any,
                "reason": failure,
            ])
            return
        }

        call.resolve([
            "phase": "downloading",
            "version": job.version,
            "receivedBytes": job.receivedBytes,
            "totalBytes": job.totalBytes as Any,
        ])
    }

    // MARK: - cancel and uninstall

    @objc func cancel(_ call: CAPPluginCall) {
        guard let jobId = call.getString("jobId") else {
            call.resolve(["ok": false])
            return
        }
        call.resolve(["ok": transfers.cancel(jobId)])
    }

    @objc func uninstall(_ call: CAPPluginCall) {
        transfers.cancelEverything()

        var removed = true
        let directory = Self.artifactDirectory()
        if FileManager.default.fileExists(atPath: directory.path) {
            do {
                try FileManager.default.removeItem(at: directory)
            } catch {
                removed = false
            }
        }

        /*
         The job registry goes too, and ONLY the job registry. "Remove OCADE
         Intelligence" and "delete my account" are different requests, so
         conversations, preferences and every other store this app keeps are
         left exactly as they were.
         */
        UserDefaults.standard.removeObject(forKey: Self.store)
        call.resolve(["ok": removed])
    }

    // MARK: - files

    /// One directory, so uninstall can be complete without guessing at names.
    static func artifactDirectory() -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = support.appendingPathComponent(directoryName, isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    static func artifactURL(version: String) -> URL {
        artifactDirectory().appendingPathComponent("\(version).gguf")
    }

    /// SHA-256, streamed so a gigabyte never sits in memory at once.
    static func digest(of url: URL) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        defer { try? handle.close() }
        var hasher = SHA256()
        while true {
            guard let chunk = try? handle.read(upToCount: 1 << 16), !chunk.isEmpty else { break }
            hasher.update(data: chunk)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }
}

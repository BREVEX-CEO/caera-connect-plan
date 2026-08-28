import Foundation

/**
 The background transfers themselves, and the record of them that outlives the app.

 WHY THIS IS SEPARATE FROM THE PLUGIN. A plugin instance lives as long as the web
 view does. A background download does not: iOS suspends the app, keeps
 transferring, and may terminate the process entirely before relaunching it to
 hand the finished file back. Anything that must survive that cannot live on the
 plugin, so the session delegate and the job registry live here as a singleton
 with its state in UserDefaults.

 THE RULE THIS FILE EXISTS TO KEEP. One transfer per version, ever. A registry
 held in memory would be empty after the system terminated the app, the next
 launch would enqueue the same gigabyte a second time, and the two-downloads
 defect the protocol's first rule forbids would arrive by way of the operating
 system rather than by way of a second tab.
 */
final class OcadeBackgroundTransfers: NSObject, URLSessionDownloadDelegate {
    static let shared = OcadeBackgroundTransfers()

    struct Job {
        let id: String
        let version: String
        let sha256: String
        let sources: [String]
        let sourceIndex: Int
        let taskIdentifier: Int
        var receivedBytes: Int
        var totalBytes: Int?
    }

    private let store = "ocade.background.jobs"
    private let queue = DispatchQueue(label: "in.ocade.background.transfers")

    /**
     The session identifier is stable across launches on purpose.

     That is what lets a relaunched process reattach to downloads the system
     carried on with while it was gone, instead of starting them again.
     */
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.background(
            withIdentifier: "in.ocade.intelligence.transfer"
        )
        configuration.isDiscretionary = false
        configuration.sessionSendsLaunchEvents = true
        configuration.allowsCellularAccess = true
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    /// True when a background session could actually be created for this install.
    var isAvailable: Bool {
        _ = session
        return true
    }

    // MARK: - registry

    private func read() -> [String: [String: Any]] {
        (UserDefaults.standard.dictionary(forKey: store) as? [String: [String: Any]]) ?? [:]
    }

    private func write(_ jobs: [String: [String: Any]]) {
        UserDefaults.standard.set(jobs, forKey: store)
    }

    func jobId(forVersion version: String) -> String? {
        read().first { (_, value) in value["version"] as? String == version }?.key
    }

    func job(_ id: String) -> Job? {
        guard let raw = read()[id],
              let version = raw["version"] as? String,
              let sha256 = raw["sha256"] as? String,
              let sources = raw["sources"] as? [String],
              let index = raw["sourceIndex"] as? Int,
              let task = raw["task"] as? Int
        else { return nil }
        return Job(
            id: id,
            version: version,
            sha256: sha256,
            sources: sources,
            sourceIndex: index,
            taskIdentifier: task,
            receivedBytes: raw["received"] as? Int ?? 0,
            totalBytes: raw["total"] as? Int
        )
    }

    func isFinished(_ id: String) -> Bool { read()[id]?["finished"] as? Bool == true }
    func failure(_ id: String) -> String? { read()[id]?["failure"] as? String }

    // MARK: - lifecycle

    func start(
        version: String,
        sha256: String,
        sources: [String],
        sourceIndex: Int,
        url: URL,
        destination: URL
    ) -> String? {
        var request = URLRequest(url: url)
        // Resumable by contract with the website's own ladder: the system
        // reissues the request with a Range header when it resumes.
        request.setValue("bytes=0-", forHTTPHeaderField: "Range")
        let task = session.downloadTask(with: request)
        let id = "\(version):\(task.taskIdentifier)"

        queue.sync {
            var jobs = read()
            jobs[id] = [
                "version": version,
                "sha256": sha256,
                "sources": sources,
                "sourceIndex": sourceIndex,
                "task": task.taskIdentifier,
                "received": 0,
                "destination": destination.path,
                "finished": false,
            ]
            write(jobs)
        }
        task.resume()
        return id
    }

    func cancel(_ id: String) -> Bool {
        guard let job = job(id) else { return false }
        session.getAllTasks { tasks in
            for task in tasks where task.taskIdentifier == job.taskIdentifier { task.cancel() }
        }
        queue.sync {
            var jobs = read()
            jobs.removeValue(forKey: id)
            write(jobs)
        }
        return true
    }

    func cancelEverything() {
        session.getAllTasks { tasks in
            for task in tasks { task.cancel() }
        }
        queue.sync { write([:]) }
    }

    /**
     Move to the next source in the website's ladder.

     Returns false once the ladder is exhausted, which is the honest end of a
     handoff rather than a silent stall.
     */
    func advanceToNextSource(_ id: String) -> Bool {
        guard let job = job(id) else { return false }
        let next = job.sourceIndex + 1
        guard next < job.sources.count, let url = URL(string: job.sources[next]) else { return false }
        let destination = URL(fileURLWithPath: read()[id]?["destination"] as? String ?? "")
        _ = cancel(id)
        return start(
            version: job.version,
            sha256: job.sha256,
            sources: job.sources,
            sourceIndex: next,
            url: url,
            destination: destination
        ) != nil
    }

    /**
     Reattach after the system relaunched this app to finish a transfer.

     The session is recreated by touching `session`, which is what actually
     reconnects this delegate to the downloads iOS carried on with. The handler
     is kept and called once the session says it has delivered everything;
     failing to call it is how an app loses the system's willingness to run its
     background work at all.
     */
    func attach(sessionIdentifier: String, completionHandler: @escaping () -> Void) {
        guard sessionIdentifier == "in.ocade.intelligence.transfer" else {
            completionHandler()
            return
        }
        queue.sync { pendingCompletion = completionHandler }
        _ = session
    }

    private var pendingCompletion: (() -> Void)?

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        let handler = queue.sync { () -> (() -> Void)? in
            let held = pendingCompletion
            pendingCompletion = nil
            return held
        }
        DispatchQueue.main.async { handler?() }
    }

    // MARK: - URLSessionDownloadDelegate

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        queue.sync {
            var jobs = read()
            for (id, value) in jobs where value["task"] as? Int == downloadTask.taskIdentifier {
                var updated = value
                updated["received"] = Int(totalBytesWritten)
                if totalBytesExpectedToWrite > 0 { updated["total"] = Int(totalBytesExpectedToWrite) }
                jobs[id] = updated
            }
            write(jobs)
        }
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        queue.sync {
            var jobs = read()
            for (id, value) in jobs where value["task"] as? Int == downloadTask.taskIdentifier {
                var updated = value
                guard let path = value["destination"] as? String else { continue }
                let destination = URL(fileURLWithPath: path)
                /*
                 The temporary file is moved, not copied, and the move happens
                 inside this callback because the system deletes `location` the
                 moment it returns. A copy on a gigabyte would also mean holding
                 two of them on a device that may not have room for one.
                 */
                try? FileManager.default.createDirectory(
                    at: destination.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                try? FileManager.default.removeItem(at: destination)
                do {
                    try FileManager.default.moveItem(at: location, to: destination)
                    updated["finished"] = true
                } catch {
                    updated["failure"] = "the finished transfer could not be stored"
                }
                jobs[id] = updated
            }
            write(jobs)
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let error else { return }
        queue.sync {
            var jobs = read()
            for (id, value) in jobs where value["task"] as? Int == task.taskIdentifier {
                var updated = value
                updated["failure"] = error.localizedDescription
                jobs[id] = updated
            }
            write(jobs)
        }
    }
}

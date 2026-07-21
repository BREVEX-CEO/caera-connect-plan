/**
 * Browser Only resume content storage — persisted to encrypted IndexedDB via
 * the shared StorageAdapter. Keys are `resume-version:<versionId>` under the
 * "resumes" data class.
 */
import { indexedDbAdapter } from "@/lib/storage/indexeddb-adapter";
import type { ResumeContent } from "./madee-resume-types";

const KEY = (versionId: string) => `resume-version:${versionId}`;

export async function saveLocalResumeContent(versionId: string, content: ResumeContent) {
  await indexedDbAdapter.put("resumes", KEY(versionId), content);
}

export async function loadLocalResumeContent(
  versionId: string,
): Promise<ResumeContent | null> {
  const rec = await indexedDbAdapter.get<ResumeContent>("resumes", KEY(versionId));
  return rec?.value ?? null;
}

export async function deleteLocalResumeContent(versionId: string) {
  await indexedDbAdapter.delete("resumes", KEY(versionId));
}

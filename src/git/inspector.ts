import { simpleGit } from "simple-git";
import type { DefaultLogFields, ListLogLine } from "simple-git";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GitCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
}

export interface GitBranchInfo {
  branch: string;
  recentCommits: GitCommitInfo[];
}

export type GitContext =
  | { type: "commit"; data: GitCommitInfo; diff: string }
  | { type: "branch"; data: GitBranchInfo; diff: string };

// ── Diff helpers ───────────────────────────────────────────────────────────

const MAX_DIFF_CHARS = 12_000;

/** Trunca un diff largo indicando cuánto se omitió */
function truncateDiff(diff: string, max = MAX_DIFF_CHARS): string {
  if (diff.length <= max) return diff;
  const head = diff.slice(0, max);
  const omitted = diff.length - max;
  return `${head}\n\n... [diff truncado: ${omitted} caracteres adicionales omitidos] ...`;
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getCommitInfo(repoPath: string, sha: string): Promise<GitContext> {
  const git = simpleGit(repoPath);

  try {
    // Metadata
    const logOutput = await git.show([
      "--no-patch",
      "--format=%H%n%h%n%s%n%an%n%ad",
      "--date=short",
      sha,
    ]);
    const lines = logOutput.trim().split("\n");

    const data: GitCommitInfo = {
      sha: lines[0]?.trim() ?? sha,
      shortSha: lines[1]?.trim() ?? sha.slice(0, 7),
      message: lines[2]?.trim() ?? "",
      author: lines[3]?.trim() ?? "",
      date: lines[4]?.trim() ?? "",
    };

    // Unified diff (without binary hunks)
    const rawDiff = await git.show(["--unified=3", "--no-color", "--diff-filter=ACMRT", sha]);
    const diff = truncateDiff(rawDiff);

    return { type: "commit", data, diff };
  } catch (err) {
    throw new Error(
      `No se pudo obtener el commit ${sha} en ${repoPath}. ` +
      `Verifica que GIT_REPO_PATH es correcto y que el SHA existe.\nDetalle: ${String(err)}`
    );
  }
}

export async function getBranchInfo(
  repoPath: string,
  branchName: string,
  maxCommits = 10
): Promise<GitContext> {
  const git = simpleGit(repoPath);

  try {
    const log = await git.log<DefaultLogFields>([`--max-count=${maxCommits}`, branchName]);

    const recentCommits: GitCommitInfo[] = log.all.map(
      (entry: DefaultLogFields & ListLogLine) => ({
        sha: entry.hash,
        shortSha: entry.hash.slice(0, 7),
        message: entry.message,
        author: entry.author_name,
        date: entry.date,
      })
    );

    // Diff of the last N commits against their base
    let diff = "";
    try {
      const count = Math.min(maxCommits, log.all.length);
      if (count > 0) {
        const rawDiff = await git.diff([
          `HEAD~${count}`,
          "HEAD",
          "--unified=3",
          "--no-color",
          "--diff-filter=ACMRT",
        ]);
        diff = truncateDiff(rawDiff);
      }
    } catch {
      // Shallow clone or single commit — continue without diff
    }

    return { type: "branch", data: { branch: branchName, recentCommits }, diff };
  } catch (err) {
    throw new Error(
      `No se pudo obtener la rama "${branchName}" en ${repoPath}. ` +
      `Verifica GIT_REPO_PATH y GIT_DEFAULT_BRANCH.\nDetalle: ${String(err)}`
    );
  }
}

import { simpleGit } from "simple-git";
import type { DefaultLogFields, ListLogLine } from "simple-git";

export interface GitCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
}

export interface GitBranchInfo {
  branch: string;
  recentCommits: GitCommitInfo[];
  filesChanged: string[];
}

export async function getCommitInfo(
  repoPath: string,
  sha: string
): Promise<GitCommitInfo> {
  const git = simpleGit(repoPath);

  try {
    const log = await git.show([
      "--stat",
      "--format=%H%n%h%n%s%n%an%n%ad",
      "--date=short",
      sha,
    ]);

    const lines = log.split("\n");
    const fullSha = lines[0]?.trim() ?? sha;
    const shortSha = lines[1]?.trim() ?? sha.slice(0, 7);
    const message = lines[2]?.trim() ?? "";
    const author = lines[3]?.trim() ?? "";
    const date = lines[4]?.trim() ?? "";

    // Extract changed files from --stat output (lines after the blank line)
    const statStart = lines.findIndex((l: string) => l.trim() === "") + 1;
    const filesChanged = lines
      .slice(statStart)
      .filter((l: string) => l.includes("|"))
      .map((l: string) => l.trim().split("|")[0]?.trim() ?? "")
      .filter((f: string) => f.length > 0);

    return { sha: fullSha, shortSha, message, author, date, filesChanged };
  } catch (err) {
    throw new Error(
      `No se pudo obtener el commit ${sha} en ${repoPath}. Verifica que GIT_REPO_PATH es correcto y que el SHA existe.\nDetalle: ${String(err)}`
    );
  }
}

export async function getBranchInfo(
  repoPath: string,
  branchName: string,
  maxCommits = 10
): Promise<GitBranchInfo> {
  const git = simpleGit(repoPath);

  try {
    const log = await git.log<DefaultLogFields>([
      `--max-count=${maxCommits}`,
      `${branchName}`,
    ]);

    const recentCommits: GitCommitInfo[] = log.all.map((entry: DefaultLogFields & ListLogLine) => ({
      sha: entry.hash,
      shortSha: entry.hash.slice(0, 7),
      message: entry.message,
      author: entry.author_name,
      date: entry.date,
      filesChanged: [],
    }));

    // Get files changed in the last N commits
    let filesChanged: string[] = [];
    try {
      const count = Math.min(maxCommits, log.all.length);
      if (count > 0) {
        const diffStat = await git.diffSummary([`HEAD~${count}`, "HEAD"]);
        filesChanged = diffStat.files.map((f) => f.file);
      }
    } catch {
      // If diff fails (e.g. shallow clone or single commit), continue without file list
    }

    return { branch: branchName, recentCommits, filesChanged };
  } catch (err) {
    throw new Error(
      `No se pudo obtener información de la rama "${branchName}" en ${repoPath}. Verifica GIT_REPO_PATH y GIT_DEFAULT_BRANCH.\nDetalle: ${String(err)}`
    );
  }
}

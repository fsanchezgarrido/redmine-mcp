import fs from "node:fs";
import path from "node:path";

export function writeReport(
  issueId: number,
  content: string,
  outputDir: string
): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `redmine-${issueId}.md`;
  const filePath = path.join(outputDir, fileName);

  fs.writeFileSync(filePath, content, "utf-8");

  return filePath;
}

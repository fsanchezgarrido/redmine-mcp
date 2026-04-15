import type { RedmineIssue } from "../redmine/types.js";
import type { GitContext } from "./sections.js";
import {
  sectionHeader,
  sectionIssueNumber,
  sectionSubject,
  sectionDescription,
  sectionCloseDate,
  sectionAnalysis,
  sectionDesign,
  sectionDataModel,
  sectionUserManagement,
  sectionConfigManagement,
  sectionChangeControl,
  sectionTests,
} from "./sections.js";

export function buildReport(issue: RedmineIssue, git?: GitContext): string {
  const sections = [
    sectionHeader(issue),
    sectionIssueNumber(issue),
    sectionSubject(issue),
    sectionDescription(issue),
    sectionCloseDate(issue),
    sectionAnalysis(issue, git),
    sectionDesign(issue, git),
    sectionDataModel(issue, git),
    sectionUserManagement(issue, git),
    sectionConfigManagement(issue, git),
    sectionChangeControl(issue),
    sectionTests(issue),
  ];

  return sections.join("\n---\n\n");
}

export interface RedmineRef {
  id: number;
  name: string;
}

export interface CustomField {
  id: number;
  name: string;
  value: string | string[] | null;
}

export interface Journal {
  id: number;
  user: RedmineRef;
  notes: string;
  created_on: string;
  details: JournalDetail[];
}

export interface JournalDetail {
  property: string;
  name: string;
  old_value: string | null;
  new_value: string | null;
}

export interface Changeset {
  revision: string;
  user: RedmineRef | null;
  comments: string;
  committed_on: string;
}

export interface Attachment {
  id: number;
  filename: string;
  filesize: number;
  content_type: string;
  description: string;
  created_on: string;
  author: RedmineRef;
}

export interface Relation {
  id: number;
  issue_id: number;
  issue_to_id: number;
  relation_type: string;
  delay: number | null;
}

export interface RedmineIssue {
  id: number;
  project: RedmineRef;
  tracker: RedmineRef;
  status: RedmineRef;
  priority: RedmineRef;
  author: RedmineRef;
  assigned_to?: RedmineRef;
  fixed_version?: RedmineRef;
  subject: string;
  description: string;
  start_date: string | null;
  due_date: string | null;
  done_ratio: number;
  estimated_hours: number | null;
  custom_fields?: CustomField[];
  created_on: string;
  updated_on: string;
  closed_on: string | null;
  journals?: Journal[];
  changesets?: Changeset[];
  attachments?: Attachment[];
  relations?: Relation[];
}

export interface RedmineIssueResponse {
  issue: RedmineIssue;
}

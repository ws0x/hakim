/**
 * Notion Database Definitions for Hakim Reading OS
 */

export interface NotionDatabaseSpec {
  name: string;
  description: string;
  properties: Record<string, unknown>;
}

export const NOTION_DATABASES: Record<string, NotionDatabaseSpec> = {
  books: {
    name: "Books",
    description: "Your reading library and books",
    properties: {
      Title: { title: {} },
      "Source Title": { rich_text: {} },
      "Hakim Book ID": { rich_text: {} },
      ASIN: { rich_text: {} },
      Author: { rich_text: {} },
      Cover: { files: {} },
      "Kindle URL": { url: {} },
      "Last Annotated": { date: {} },
      "Reading Status": {
        select: {
          options: [
            { name: "To Read", color: "gray" },
            { name: "Reading", color: "blue" },
            { name: "Finished", color: "green" },
            { name: "Paused", color: "orange" },
          ],
        },
      },
      Rating: { number: { format: "number" } },
      "Synthesis Status": {
        select: {
          options: [
            { name: "Not Started", color: "gray" },
            { name: "Drafted", color: "yellow" },
            { name: "Approved", color: "green" },
          ],
        },
      },
    },
  },
  highlights: {
    name: "Highlights",
    description: "Exact quotations and notes from Kindle",
    properties: {
      Name: { title: {} },
      "Hakim Annotation ID": { rich_text: {} },
      Quote: { rich_text: {} },
      "Kindle Note": { rich_text: {} },
      Location: { number: {} },
      Page: { number: {} },
      Chapter: { rich_text: {} },
      Color: {
        select: {
          options: [
            { name: "yellow", color: "yellow" },
            { name: "blue", color: "blue" },
            { name: "pink", color: "pink" },
            { name: "orange", color: "orange" },
          ],
        },
      },
      "Process Status": {
        select: {
          options: [
            { name: "Inbox", color: "red" },
            { name: "Processed", color: "green" },
            { name: "Discarded", color: "gray" },
          ],
        },
      },
      Importance: {
        select: {
          options: [
            { name: "Low", color: "gray" },
            { name: "Medium", color: "blue" },
            { name: "High", color: "orange" },
            { name: "Essential", color: "red" },
          ],
        },
      },
      "My Interpretation": { rich_text: {} },
      Agreement: {
        select: {
          options: [
            { name: "Agree", color: "green" },
            { name: "Unsure", color: "yellow" },
            { name: "Disagree", color: "red" },
          ],
        },
      },
      "Suggested Claim": { rich_text: {} },
      "AI Locked": { checkbox: {} },
    },
  },
  concepts: {
    name: "Concepts",
    description: "Core themes, mental models, and definitions",
    properties: {
      Name: { title: {} },
      "Working Definition": { rich_text: {} },
      "My Understanding": { rich_text: {} },
      Status: {
        select: {
          options: [
            { name: "Emerging", color: "yellow" },
            { name: "Active", color: "blue" },
            { name: "Stable", color: "green" },
            { name: "Challenged", color: "red" },
          ],
        },
      },
      "Mastery Score": { number: {} },
      "Last Reviewed": { date: {} },
    },
  },
  insights: {
    name: "Insights",
    description: "Synthesized claims and original thinking",
    properties: {
      Title: { title: {} },
      Claim: { rich_text: {} },
      "Explanation in My Words": { rich_text: {} },
      Evidence: { rich_text: {} },
      "My Position": { rich_text: {} },
      Confidence: { number: {} },
      Stage: {
        select: {
          options: [
            { name: "AI Draft", color: "yellow" },
            { name: "Reviewing", color: "blue" },
            { name: "Approved", color: "green" },
          ],
        },
      },
    },
  },
  learningPaths: {
    name: "Learning Paths",
    description: "Curricula and domain mastery tracks",
    properties: {
      Name: { title: {} },
      Priority: {
        select: {
          options: [
            { name: "Primary", color: "red" },
            { name: "Secondary", color: "blue" },
            { name: "Light", color: "gray" },
          ],
        },
      },
      Purpose: { rich_text: {} },
      "Weekly Review Day": {
        select: {
          options: [
            { name: "Monday", color: "blue" },
            { name: "Friday", color: "green" },
            { name: "Sunday", color: "purple" },
          ],
        },
      },
    },
  },
  reviews: {
    name: "Reviews",
    description: "Active recall and synthesis examinations",
    properties: {
      Name: { title: {} },
      "Review Type": {
        select: {
          options: [
            { name: "Daily Recall", color: "blue" },
            { name: "Weekly Synthesis", color: "purple" },
            { name: "Book Completion", color: "green" },
          ],
        },
      },
      "Scheduled Date": { date: {} },
      "Completed Date": { date: {} },
      "Recall Score": { number: {} },
    },
  },
  applications: {
    name: "Applications",
    description: "Real-world actions, experiments, and outcome tracking",
    properties: {
      Name: { title: {} },
      Hypothesis: { rich_text: {} },
      "Planned Action": { rich_text: {} },
      "Target Date": { date: {} },
      "Actual Result": { rich_text: {} },
      Outcome: {
        select: {
          options: [
            { name: "Validated", color: "green" },
            { name: "Invalidated", color: "red" },
            { name: "Inconclusive", color: "yellow" },
          ],
        },
      },
    },
  },
};

import type { Book, Annotation, AnnotationUserState } from "@hakim/domain";

export interface NotionPageProperties {
  [key: string]: unknown;
}

export class NotionReconciler {
  public static mapBookToNotionProperties(book: Book): NotionPageProperties {
    return {
      Title: {
        title: [{ text: { content: book.displayTitle } }],
      },
      "Source Title": {
        rich_text: [{ text: { content: book.sourceTitle } }],
      },
      "Hakim Book ID": {
        rich_text: [{ text: { content: book.id } }],
      },
      ASIN: book.asin
        ? { rich_text: [{ text: { content: book.asin } }] }
        : undefined,
      Author: {
        rich_text: [{ text: { content: book.author } }],
      },
      "Kindle URL": book.sourceUrl
        ? { url: book.sourceUrl }
        : undefined,
      "Last Annotated": book.lastAnnotatedAt
        ? { date: { start: book.lastAnnotatedAt } }
        : undefined,
    };
  }

  public static mapHighlightToNotionProperties(
    annotation: Annotation,
    userState?: AnnotationUserState
  ): NotionPageProperties {
    const props: NotionPageProperties = {
      Name: {
        title: [{ text: { content: annotation.rawText.substring(0, 80) + (annotation.rawText.length > 80 ? "..." : "") } }],
      },
      "Hakim Annotation ID": {
        rich_text: [{ text: { content: annotation.id } }],
      },
      Quote: {
        rich_text: [{ text: { content: annotation.rawText.substring(0, 2000) } }],
      },
      Color: {
        select: { name: annotation.color || "yellow" },
      },
    };

    if (annotation.sourceNote) {
      props["Kindle Note"] = {
        rich_text: [{ text: { content: annotation.sourceNote.substring(0, 2000) } }],
      };
    }

    if (annotation.locationStart !== undefined) {
      props["Location"] = { number: annotation.locationStart };
    }

    if (annotation.page !== undefined) {
      props["Page"] = { number: annotation.page };
    }

    if (annotation.chapter) {
      props["Chapter"] = {
        rich_text: [{ text: { content: annotation.chapter } }],
      };
    }

    // Set initial user state if present
    if (userState) {
      if (userState.processStatus) {
        const nameMap: Record<string, string> = { inbox: "Inbox", processed: "Processed", discarded: "Discarded" };
        props["Process Status"] = { select: { name: nameMap[userState.processStatus] || "Inbox" } };
      }
      if (userState.importance) {
        const impMap: Record<string, string> = { low: "Low", medium: "Medium", high: "High", essential: "Essential" };
        props["Importance"] = { select: { name: impMap[userState.importance] || "Medium" } };
      }
      if (userState.agreement) {
        const agreeMap: Record<string, string> = { agree: "Agree", unsure: "Unsure", disagree: "Disagree" };
        props["Agreement"] = { select: { name: agreeMap[userState.agreement] || "Agree" } };
      }
      if (userState.personalInterpretation) {
        props["My Interpretation"] = {
          rich_text: [{ text: { content: userState.personalInterpretation } }],
        };
      }
    }

    return props;
  }
}

import { describe, it, expect } from "vitest";
import { AmazonNotebookClient, CaptchaDetectedError, SessionExpiredError } from "../background/amazon-client.js";

describe("Hakim Browser Extension - Amazon Client", () => {
  const client = new AmazonNotebookClient("read.amazon.com");

  const mockMultiBookHtml = `
    <html>
      <body>
        <div id="kp-notebook-library">
          <div class="kp-notebook-library-each" id="asin_B00ZUX90S4">
            <h2 class="kp-notebook-searchable">Designing Data-Intensive Applications</h2>
            <p class="kp-notebook-searchable kp-notebook-metadata">By: Martin Kleppmann</p>
          </div>
          <div class="kp-notebook-library-each" id="asin_B01862ES3A">
            <h2 class="kp-notebook-searchable">The Daily Stoic</h2>
            <p class="kp-notebook-searchable kp-notebook-metadata">By: Ryan Holiday</p>
          </div>
          <div class="kp-notebook-library-each" id="asin_B07D23CFGR">
            <h2 class="kp-notebook-searchable">Atomic Habits</h2>
            <p class="kp-notebook-searchable kp-notebook-metadata">By: James Clear</p>
          </div>
        </div>
        <h3 class="kcp-notebook-title">Designing Data-Intensive Applications (Kindle Edition)</h3>
        <p class="kcp-notebook-author">Kleppmann, Martin</p>
        <div id="kp-notebook-annotations">
          <div class="kp-notebook-row-separator kp-notebook-highlight-yellow">
            <span id="annotationHighlightHeader">Highlight (Yellow) | Location 120</span>
            <span id="highlight">Reliability means continuing to work correctly even when things go wrong.</span>
          </div>
          <div class="kp-notebook-row-separator kp-notebook-highlight-blue">
            <span id="annotationHighlightHeader">Highlight (Blue) | Location 340</span>
            <span id="highlight">Scalability describes a system's ability to cope with increased load.</span>
            <span id="note">Crucial definition for scaling architectures.</span>
          </div>
        </div>
      </body>
    </html>
  `;

  it("extracts all multiple books from Kindle Cloud library sidebar without truncating", () => {
    const list = client.extractLibraryBookList(mockMultiBookHtml);
    expect(list.length).toBe(3);
    
    expect(list[0]?.asin).toBe("B00ZUX90S4");
    expect(list[0]?.title).toBe("Designing Data-Intensive Applications");
    expect(list[0]?.author).toBe("Martin Kleppmann");

    expect(list[1]?.asin).toBe("B01862ES3A");
    expect(list[1]?.title).toBe("The Daily Stoic");
    expect(list[1]?.author).toBe("Ryan Holiday");

    expect(list[2]?.asin).toBe("B07D23CFGR");
    expect(list[2]?.title).toBe("Atomic Habits");
    expect(list[2]?.author).toBe("James Clear");
  });

  it("parses Amazon Cloud Notebook HTML into normalized RawImportBook structures", () => {
    const book = client.parseNotebookHtml(mockMultiBookHtml, "B00ZUX90S4");
    expect(book.asin).toBe("B00ZUX90S4");
    expect(book.sourceTitle).toBe("Designing Data-Intensive Applications");
    expect(book.author).toBe("Martin Kleppmann");
    expect(book.annotations.length).toBe(2);

    const annot1 = book.annotations[0]!;
    expect(annot1.rawText).toContain("Reliability means continuing to work correctly");
    expect(annot1.color).toBe("yellow");
    expect(annot1.locationStart).toBe(120);

    const annot2 = book.annotations[1]!;
    expect(annot2.rawText).toContain("Scalability describes a system's ability");
    expect(annot2.sourceNote).toBe("Crucial definition for scaling architectures.");
    expect(annot2.color).toBe("blue");
    expect(annot2.locationStart).toBe(340);
  });

  it("detects Amazon CAPTCHA pages and throws CaptchaDetectedError", () => {
    const captchaHtml = "<html><body>Enter the characters you see below to continue. validateCaptcha</body></html>";
    expect(() => client.parseNotebookHtml(captchaHtml)).toThrow(CaptchaDetectedError);
  });

  it("detects expired Amazon signin redirects and throws SessionExpiredError", () => {
    const signinHtml = "<html><body><form action='https://amazon.com/ap/signin'>Sign In</form></body></html>";
    expect(() => client.parseNotebookHtml(signinHtml)).toThrow(SessionExpiredError);
  });

  it("preserves decoded source punctuation and spacing in raw highlight text", () => {
    const html = `
      <h3 class="kcp-notebook-title">Arabic and English</h3>
      <p class="kcp-notebook-author">Example Author</p>
      <div id="kp-notebook-annotations">
        <div class="kp-notebook-row-separator kp-notebook-highlight-yellow">
          <span id="annotationHighlightHeader">Highlight | Location 10</span>
          <span id="highlight">“Exact”  spacing &amp; punctuation — محفوظة</span>
        </div>
      </div>`;

    const parsed = client.parseNotebookHtml(html, "B001RAW001");
    expect(parsed.annotations[0]?.rawText).toBe("“Exact”  spacing & punctuation — محفوظة");
  });
});

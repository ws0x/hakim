import { describe, it, expect } from "vitest";
import { AmazonNotebookClient } from "../background/amazon-client.js";

describe("Hakim Extension - End-to-End Kindle Cloud Multi-Book & Pagination Engine", () => {
  const client = new AmazonNotebookClient("read.amazon.com");

  // Multi-book sidebar fixture
  const multiBookSidebarHtml = `
    <html>
      <body>
        <div id="kp-notebook-library">
          <div class="kp-notebook-library-each" id="asin_B001">
            <h2 class="kp-notebook-searchable">Clean Code: A Handbook of Agile Software Craftsmanship</h2>
            <p class="kp-notebook-metadata">By: Robert C. Martin</p>
          </div>
          <div class="kp-notebook-library-each" id="asin_B002">
            <h2 class="kp-notebook-searchable">The Pragmatic Programmer</h2>
            <p class="kp-notebook-metadata">By: Andrew Hunt, David Thomas</p>
          </div>
          <div class="kp-notebook-library-each" id="asin_B003">
            <h2 class="kp-notebook-searchable">Thinking, Fast and Slow</h2>
            <p class="kp-notebook-metadata">By: Daniel Kahneman</p>
          </div>
        </div>
      </body>
    </html>
  `;

  // Page 1 for Book 1 with Next Page Token
  const book1Page1Html = `
    <html>
      <body>
        <h3 class="kcp-notebook-title">Clean Code (Kindle Edition)</h3>
        <p class="kcp-notebook-author">Martin, Robert C.</p>
        <div id="kp-notebook-annotations">
          <div class="kp-notebook-row-separator kp-notebook-highlight-yellow">
            <span id="annotationHighlightHeader">Highlight (Yellow) | Location 100</span>
            <span id="highlight">Even bad code can function. But if code isn't clean, it can bring a development organization to its knees.</span>
          </div>
          <div class="kp-notebook-row-separator kp-notebook-highlight-blue">
            <span id="annotationHighlightHeader">Highlight (Blue) | Location 250</span>
            <span id="highlight">Clean code is simple and direct. Clean code never obscures the designer's intent.</span>
            <span id="note">Fundamental law of software readability.</span>
          </div>
          <input type="hidden" id="kp-notebook-annotations-token" value="token_page_2" />
          <input type="hidden" id="kp-notebook-annotations-next-page-start" value="15" />
        </div>
      </body>
    </html>
  `;

  // Page 2 for Book 1 (Final page, no token)
  const book1Page2Html = `
    <html>
      <body>
        <h3 class="kcp-notebook-title">Clean Code (Kindle Edition)</h3>
        <p class="kcp-notebook-author">Martin, Robert C.</p>
        <div id="kp-notebook-annotations">
          <div class="kp-notebook-row-separator kp-notebook-highlight-pink">
            <span id="annotationHighlightHeader">Highlight (Pink) | Location 400</span>
            <span id="highlight">Leave the campground cleaner than you found it. The Boy Scout Rule.</span>
          </div>
        </div>
      </body>
    </html>
  `;

  it("discovers all 3 books from the library sidebar", () => {
    const books = client.extractLibraryBookList(multiBookSidebarHtml);
    expect(books.length).toBe(3);
    expect(books[0]?.asin).toBe("B001");
    expect(books[0]?.title).toBe("Clean Code: A Handbook of Agile Software Craftsmanship");
    expect(books[1]?.asin).toBe("B002");
    expect(books[1]?.title).toBe("The Pragmatic Programmer");
    expect(books[2]?.asin).toBe("B003");
    expect(books[2]?.title).toBe("Thinking, Fast and Slow");
  });

  it("extracts page 1 highlights and identifies pagination continuation tokens", () => {
    const page1 = client.parseNotebookHtml(book1Page1Html, "B001", "Clean Code", "Robert C. Martin");
    expect(page1.annotations.length).toBe(2);
    expect(page1.annotations[0]?.rawText).toContain("Even bad code can function");
    expect(page1.annotations[0]?.color).toBe("yellow");
    expect(page1.annotations[1]?.rawText).toContain("Clean code is simple and direct");
    expect(page1.annotations[1]?.sourceNote).toBe("Fundamental law of software readability.");
    expect(page1.annotations[1]?.color).toBe("blue");

    // Token extraction verification
    const tokenMatch = book1Page1Html.match(/id="kp-notebook-annotations-token"[^>]*value="([^"]+)"/i);
    const startMatch = book1Page1Html.match(/id="kp-notebook-annotations-next-page-start"[^>]*value="([^"]+)"/i);
    expect(tokenMatch?.[1]).toBe("token_page_2");
    expect(startMatch?.[1]).toBe("15");
  });

  it("extracts page 2 highlights and identifies terminal page", () => {
    const page2 = client.parseNotebookHtml(book1Page2Html, "B001", "Clean Code", "Robert C. Martin");
    expect(page2.annotations.length).toBe(1);
    expect(page2.annotations[0]?.rawText).toContain("The Boy Scout Rule");
    expect(page2.annotations[0]?.color).toBe("pink");

    const tokenMatch = book1Page2Html.match(/id="kp-notebook-annotations-token"[^>]*value="([^"]+)"/i);
    expect(tokenMatch).toBeNull();
  });
});

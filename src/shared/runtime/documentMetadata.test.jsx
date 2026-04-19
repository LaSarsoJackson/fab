import { syncDocumentMetadata } from "./documentMetadata";

describe("document metadata helpers", () => {
  const originalTitle = document.title;
  const originalHead = document.head.innerHTML;

  beforeEach(() => {
    document.title = "";
    document.head.innerHTML = `
      <meta name="description" content="" />
      <meta property="og:title" content="" />
      <meta property="og:description" content="" />
      <meta property="og:url" content="" />
      <meta name="twitter:title" content="" />
      <meta name="twitter:description" content="" />
    `;
  });

  afterAll(() => {
    document.title = originalTitle;
    document.head.innerHTML = originalHead;
  });

  test("updates the shared document and social metadata tags together", () => {
    syncDocumentMetadata({
      title: "Packet Title",
      description: "Packet description",
      url: "https://example.com/#/packet",
    });

    expect(document.title).toBe("Packet Title");
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      "Packet description"
    );
    expect(document.head.querySelector('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Packet Title"
    );
    expect(document.head.querySelector('meta[property="og:description"]')).toHaveAttribute(
      "content",
      "Packet description"
    );
    expect(document.head.querySelector('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://example.com/#/packet"
    );
    expect(document.head.querySelector('meta[name="twitter:title"]')).toHaveAttribute(
      "content",
      "Packet Title"
    );
    expect(document.head.querySelector('meta[name="twitter:description"]')).toHaveAttribute(
      "content",
      "Packet description"
    );
  });

  test("leaves missing tags alone instead of throwing", () => {
    document.head.innerHTML = "";

    expect(() => {
      syncDocumentMetadata({
        title: "Fallback Title",
        description: "Fallback description",
        url: "https://example.com",
      });
    }).not.toThrow();

    expect(document.title).toBe("Fallback Title");
  });
});

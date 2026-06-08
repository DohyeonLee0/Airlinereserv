export type ChatSection = {
  title: string;
  source: string;
  body: string;
};

function stripLeadingHeading(content: string, title: string): string {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.match(/^#{1,3}\s+/)) {
    const heading = lines[0].replace(/^#{1,3}\s+/, "").trim();
    if (heading.toLowerCase() === title.toLowerCase()) {
      return lines.slice(1).join("\n").trim();
    }
  }
  return content.trim();
}

function retrievalIntro(query: string): string {
  const q = query.toLowerCase();
  if (/cancel|refund|취소|환불/.test(q)) {
    return "You can manage cancellations from My Bookings. Key rules:";
  }
  if (/password|demo|login|account|비밀번호|계정|로그인/.test(q)) {
    return "Here are the demo account details:";
  }
  if (/admin|staff|supervisor|role|권한|역할/.test(q)) {
    return "Here is how staff roles and permissions differ:";
  }
  if (/book|seat|flight|예약|항공|좌석/.test(q)) {
    return "Here is how booking works in this app:";
  }
  if (/dashboard|report|master|대시보드/.test(q)) {
    return "Here is what you can do in the staff dashboard:";
  }
  return "Here's what I found:";
}

export function buildRetrievalReply(
  query: string,
  chunks: Array<{ title: string; source: string; content: string }>
): { intro: string; sections: ChatSection[] } {
  if (chunks.length === 0) {
    return {
      intro:
        "I couldn't find relevant information. Try asking about demo accounts, roles, bookings, or the dashboard.",
      sections: []
    };
  }

  const sections = chunks.map((chunk) => ({
    title: chunk.title,
    source: chunk.source.replace(/\.md$/i, ""),
    body: stripLeadingHeading(chunk.content, chunk.title)
  }));

  return { intro: retrievalIntro(query), sections };
}

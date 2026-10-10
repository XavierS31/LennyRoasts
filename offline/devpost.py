"""Parse public Devpost pages into seed records (plan section 4.4).

Pure functions over HTML strings; fetching lives in collect.py. Team member names
and other personal details are never extracted.
"""
import html
import re

SECTION_KEYS = [
    ("inspiration", "inspiration"),
    ("what it does", "what_it_does"),
    ("how we built it", "how_we_built_it"),
    ("how i built it", "how_we_built_it"),
    ("challenges we ran into", "challenges_we_ran_into"),
    ("challenges i ran into", "challenges_we_ran_into"),
    ("accomplishments", "accomplishments"),
    ("what we learned", "what_we_learned"),
    ("what i learned", "what_we_learned"),
    ("what's next", "whats_next"),
    ("what’s next", "whats_next"),
    ("whats next", "whats_next"),
]
TEXT_FIELDS = ["inspiration", "what_it_does", "how_we_built_it", "challenges_we_ran_into",
               "accomplishments", "what_we_learned", "whats_next"]


def html_to_text(fragment):
    """Visible text with paragraph and list breaks kept as newlines."""
    fragment = re.sub(r"(?is)<(script|style|iframe).*?</\1>", "", fragment)
    fragment = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>|</pre>", "\n", fragment)
    fragment = re.sub(r"(?i)<li[^>]*>", "- ", fragment)
    text = html.unescape(re.sub(r"<[^>]+>", "", fragment))
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in text.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def parse_prize_filters(page):
    """Prize checkboxes on <hackathon>.devpost.com/project-gallery: [{id, name}]."""
    pattern = r'name="prize_filter\[prizes\]\[\]"[^>]*value="(\d+)"[^>]*/?>\s*([^<]+)</label>'
    return [{"id": int(pid), "name": html.unescape(name).strip()} for pid, name in re.findall(pattern, page)]


def parse_search_results(page):
    """Projects on one submissions/search page: [{url, name, tagline, winner_badge}]."""
    out = []
    for chunk in page.split('class="block-wrapper-link fade link-to-software" href="')[1:]:
        url = chunk.split('"', 1)[0]
        name = re.search(r"<h5>(.*?)</h5>", chunk, re.S)
        tagline = re.search(r'<p class="small tagline">(.*?)</p>', chunk, re.S)
        out.append({
            "url": url,
            "name": html_to_text(name.group(1)) if name else "",
            "tagline": html_to_text(tagline.group(1)) if tagline else "",
            "winner_badge": 'alt="Winner"' in chunk,
        })
    return out


def _section_key(heading):
    heading = heading.strip().lower()
    for prefix, key in SECTION_KEYS:
        if heading.startswith(prefix):
            return key
    return None


def parse_project(page):
    """A project page as {submission fields, built_with, submitted_to, prize_won, unmapped_headings}.

    submitted_to lists hackathon names from the sidebar; prize_won lists the
    "Winner" labels exactly as shown, which are the only reliable award source.
    """
    title = re.search(r'<h1 id="app-title">(.*?)</h1>', page, re.S)
    after_title = page[title.end():] if title else page
    tagline = re.search(r'<p class="large">(.*?)</p>', after_title, re.S)
    details = page.split('id="app-details-left"', 1)[-1].split('id="built-with"', 1)[0]
    parts = re.split(r"<h2>(.*?)</h2>", details, flags=re.S)
    sections = {key: "" for key in TEXT_FIELDS}
    unmapped = []
    for heading, body in zip(parts[1::2], parts[2::2]):
        heading = html_to_text(heading)
        key = _section_key(heading)
        if key is None:
            unmapped.append(heading)
            continue
        text = html_to_text(body)
        sections[key] = f"{sections[key]}\n\n{text}".strip() if sections[key] else text
    built = page.split('id="built-with"', 1)[-1].split("</ul>", 1)[0] if 'id="built-with"' in page else ""
    built_with = list(dict.fromkeys(html_to_text(tag).lower()
                                    for tag in re.findall(r'<span class="cp-tag[^"]*">(.*?)</span>', built, re.S)))
    sidebar = page.split('id="submissions"', 1)[-1].split('id="app-team"', 1)[0] if 'id="submissions"' in page else ""
    submitted_to = [html_to_text(name) for name in
                    re.findall(r'<div class="software-list-content">\s*<p>\s*<a [^>]*>(.*?)</a>', sidebar, re.S)]
    prize_won = [html_to_text(prize) for prize in
                 re.findall(r'<span class="winner[^"]*">\s*Winner\s*</span>(.*?)</li>', sidebar, re.S)]
    return {
        "name": html_to_text(title.group(1)) if title else "",
        "tagline": html_to_text(tagline.group(1)) if tagline else "",
        **sections,
        "built_with": built_with,
        "submitted_to": submitted_to,
        "prize_won": prize_won,
        "unmapped_headings": unmapped,
    }

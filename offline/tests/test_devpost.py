from offline import devpost

PROJECT_PAGE = """
<h1 id="app-title">Fraud &amp; Friends</h1>
<p class="large">
  Spot odd card swipes early.
</p>
<div class="large-9 columns" id="app-details-left">
<div id="gallery"><iframe src="video"></iframe></div>
<div>
<h2>Inspiration</h2><p>Scams hurt students.</p>
<h2>What it does</h2><p>Flags unusual transactions.</p><ul><li>Alerts</li><li>Charts</li></ul>
<h2>How I built it</h2><p>Python and SQL.<br>Streamlit UI.</p>
<h2>Challenges we ran into</h2><p>Thresholds.</p>
<h2>Accomplishments that we're proud of</h2><p>It runs.</p>
<h2>What we learned</h2><p>SQL joins.</p>
<h2>What&#39;s next for Fraud &amp; Friends</h2><p>Use ML.</p>
<h2>Demo Notes</h2><p>Ignored.</p>
</div>
<div id="built-with"><h2>Built With</h2>
<ul class="no-bullet inline-list"><li><span class="cp-tag">Python</span></li>
<li><span class="cp-tag recognized-tag"><a href="x">sql</a></span></li></ul></div>
</div>
<div id="submissions" class="section"><ul>
<li><div class="software-list-content"><p>
<a href="https://shellhacks2024.devpost.com/">ShellHacks 2024</a></p>
<ul class="no-bullet"><li>
<span class="winner label radius small all-caps">Winner</span>
BNY AI-powered Financial Fraud Detection System
</li></ul></div></li></ul></div>
<section id="app-team"><a class="user-profile-link" href="u">Private Person</a></section>
"""

SEARCH_PAGE = """
<a class="block-wrapper-link fade link-to-software" href="https://devpost.com/software/a">
<h5>Alpha</h5><p class="small tagline">First one</p></a>
<a class="block-wrapper-link fade link-to-software" href="https://devpost.com/software/b">
<h5>Beta</h5><p class="small tagline">Second</p>
<img alt="Winner" class="winner" src="ribbon.png" /> Winner</a>
"""

GALLERY_PAGE = """
<label class="checkbox"><input type="checkbox" name="prize_filter[prizes][]" id="filter_prize_x" value="79317" />BNY Fraud</label>
<label class="checkbox"><input type="checkbox" name="prize_filter[prizes][]" id="filter_prize_y" value="79210" />[MLH] Best Domain</label>
"""


def test_project_page_maps_sections_tags_and_awards():
    parsed = devpost.parse_project(PROJECT_PAGE)
    assert parsed["name"] == "Fraud & Friends"
    assert parsed["tagline"] == "Spot odd card swipes early."
    assert parsed["what_it_does"] == "Flags unusual transactions.\n- Alerts\n- Charts"
    assert parsed["how_we_built_it"] == "Python and SQL.\nStreamlit UI."
    assert parsed["whats_next"] == "Use ML."
    assert parsed["built_with"] == ["python", "sql"]
    assert parsed["submitted_to"] == ["ShellHacks 2024"]
    assert parsed["prize_won"] == ["BNY AI-powered Financial Fraud Detection System"]
    assert parsed["unmapped_headings"] == ["Demo Notes"]
    assert "Private Person" not in str(parsed)


def test_search_results_and_prize_filters():
    assert devpost.parse_search_results(SEARCH_PAGE) == [
        {"url": "https://devpost.com/software/a", "name": "Alpha", "tagline": "First one", "winner_badge": False},
        {"url": "https://devpost.com/software/b", "name": "Beta", "tagline": "Second", "winner_badge": True},
    ]
    assert devpost.parse_prize_filters(GALLERY_PAGE) == [
        {"id": 79317, "name": "BNY Fraud"}, {"id": 79210, "name": "[MLH] Best Domain"}]

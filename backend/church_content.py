import json

from database import get_connection

# Defaults shown on the public site when admins have not saved custom content.
# Stored per-section in the church_content table, with the section name as the
# primary key and content held as a JSON string.
DEFAULT_CONTENT = {
    "about_us": "Mt. Olivet Methodist Church is a vibrant and growing faith community located in the heart of Esuekyir. Established with a vision to spread the love of Christ, the church has been a beacon of hope, faith, and service for generations. We are committed to nurturing disciples, building families, and transforming our community through the power of the Gospel. Our doors are open to all who seek a deeper relationship with God and a meaningful connection with others. At Mt. Olivet, you will find a warm and welcoming congregation dedicated to worship, prayer, and the study of God's Word.",
    "mission": "To make disciples of Jesus Christ, nurture believers, and reach the world with God's love.",
    "vision": "A Christ-centred community where everyone is empowered to serve.",
    "values": "Prayer, Scripture, fellowship, and the love of Christ.",
}

DEFAULT_ORGANISATIONS = [
    {"title": "Women's Fellowship", "subtitle": "Sisterhood in Christ", "description": "A community of women gathering for prayer, bible study, and mutual support. They organize events that nurture spiritual growth and foster strong bonds among women in the church."},
    {"title": "Men's Fellowship", "subtitle": "Building Godly Men", "description": "A fellowship dedicated to helping men grow in their faith, leadership, and responsibility. They meet regularly for bible study, mentorship, and community service."},
    {"title": "Youth Fellowship", "subtitle": "Raising Next Generation", "description": "A vibrant group of young people passionate about God and making a difference. Through Bible study, outreach, and fun activities, they grow together in faith and purpose."},
    {"title": "Student Fellowship", "subtitle": "Campus for Christ", "description": "Supporting students in their academic and spiritual journey. They provide a platform for fellowship, prayer, and outreach within campuses and the community."},
    {"title": "Choir", "subtitle": "Ministry Through Music", "description": "The Mt. Olivet Methodist Church Choir leads the congregation in worship through soul-stirring music. They minister at Sunday services, special events, and community outreach programs."},
    {"title": "Evangelism Team", "subtitle": "Winning Souls for Christ", "description": "A passionate team dedicated to spreading the Gospel through outreach programs, house-to-house evangelism, and community events. They bring hope to the lost and needy."},
    {"title": "Harvest Committee", "subtitle": "Thanksgiving & Giving", "description": "Responsible for organizing the annual harvest festival and other fundraising activities that support the church's mission and community projects."},
    {"title": "Media Team", "subtitle": "Spreading the Word Digitally", "description": "The Media Team manages audio, visual, and online platforms to broadcast the church's services and events. They ensure the message reaches beyond the four walls."},
]

DEFAULT_ACTIVITIES = [
    {"title": "Sunday Worship", "subtitle": "Weekly Main Service", "description": "Join us every Sunday for a powerful time of worship, prayer, and the preaching of God's Word. Our services are designed to uplift your spirit and draw you closer to God."},
    {"title": "Bible Study", "subtitle": "Midweek Word", "description": "Every Wednesday, we gather for an in-depth study of the Scriptures. It's a time for learning, asking questions, and growing in your understanding of God's Word."},
    {"title": "Prayer Meetings", "subtitle": "Power in Unity", "description": "Join us on Fridays for intercessory prayer. We believe in the power of collective prayer to bring about transformation in our lives, families, and community."},
    {"title": "Youth Ministry", "subtitle": "Next Gen Faith", "description": "Our youth ministry meets every Saturday to engage young people with relevant Bible teaching, mentorship, and fun activities that build character and faith."},
    {"title": "Choir Practice", "subtitle": "Perfecting Praise", "description": "Choir rehearsals are held twice a week to prepare soul-lifting music for Sunday services and special events. New voices are always welcome."},
    {"title": "Outreach", "subtitle": "Love in Action", "description": "We regularly organize outreach programs to serve the needy, visit the sick, and share the love of Christ with the wider community through acts of kindness."},
    {"title": "Sunday School", "subtitle": "Training in Truth", "description": "Every Sunday, children and teens are taught the Word of God in an age-appropriate and engaging way. We nurture young minds to know and love Jesus."},
    {"title": "Family Life", "subtitle": "Stronger Together", "description": "Our family life ministry organizes seminars, counseling sessions, and events that strengthen marriages and families, helping them thrive in today's world."},
]

DEFAULT_BASICS = [
    {"title": "About Us", "content": DEFAULT_CONTENT["about_us"]},
    {"title": "Mission", "content": DEFAULT_CONTENT["mission"]},
    {"title": "Vision", "content": DEFAULT_CONTENT["vision"]},
    {"title": "Values", "content": DEFAULT_CONTENT["values"]},
]

DEFAULT_CHURCH_NAME = "Mt.Olivet Methodist Church"
DEFAULT_TAGLINE = "Growing Together in Faith, Hope, and Love"

DEFAULT_SOCIAL = {"phone": "", "whatsapp": "", "email": "", "facebook": "", "tiktok": ""}


def get_church_content(section_name):
    # Read a section's saved JSON blob from the DB; returns None if unset.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT content FROM church_content WHERE section_name = %s", (section_name,))
        row = cur.fetchone()
        conn.close()
        if row:
            return json.loads(row["content"])
    except Exception:
        pass
    return None


def save_church_content(section_name, data):
    # Upsert a section: INSERT the JSON blob or UPDATE it if the section exists.
    content_json = json.dumps(data)
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO church_content (section_name, content) VALUES (%s, %s) "
            "ON DUPLICATE KEY UPDATE content = %s",
            (section_name, content_json, content_json),
        )
        conn.close()
    except Exception:
        pass


def get_about_us():
    return get_church_content("about_us") or DEFAULT_CONTENT["about_us"]


def get_mission():
    return get_church_content("mission") or DEFAULT_CONTENT["mission"]


def get_vision():
    return get_church_content("vision") or DEFAULT_CONTENT["vision"]


def get_values():
    return get_church_content("values") or DEFAULT_CONTENT["values"]


def get_organisations():
    return get_church_content("organisations") or DEFAULT_ORGANISATIONS


def get_activities():
    return get_church_content("activities") or DEFAULT_ACTIVITIES


def save_about_us(text):
    save_church_content("about_us", text)


def save_mission(text):
    save_church_content("mission", text)


def save_vision(text):
    save_church_content("vision", text)


def save_values(text):
    save_church_content("values", text)


def save_organisations(items):
    save_church_content("organisations", items)


def save_activities(items):
    save_church_content("activities", items)


def get_basics():
    # The "basics" section is a list of {title, content, images}. Saved rows get
    # an empty images array backfilled for frontend compatibility.
    data = get_church_content("basics")
    if data:
        return [{"images": [], **b} for b in data]
    basics = [
        {"title": "About Us", "content": get_about_us()},
        {"title": "Mission", "content": get_mission()},
        {"title": "Vision", "content": get_vision()},
        {"title": "Values", "content": get_values()},
    ]
    save_basics(basics)
    return [{"images": [], **b} for b in basics]


def save_basics(items):
    save_church_content("basics", items)


def get_church_name():
    return get_church_content("church_name") or DEFAULT_CHURCH_NAME


def save_church_name(name):
    save_church_content("church_name", name)


def get_church_tagline():
    return get_church_content("church_tagline") or DEFAULT_TAGLINE


def save_church_tagline(tagline):
    save_church_content("church_tagline", tagline)


def get_church_logo():
    # Logo is stored as a base64 data URL in the church_logo section.
    return get_church_content("church_logo")


def save_church_logo(base64_str):
    save_church_content("church_logo", base64_str)


def get_social():
    # Social links object; falls back to the default empty link set.
    data = get_church_content("social")
    if data and isinstance(data, dict):
        return data
    return dict(DEFAULT_SOCIAL)


def save_social(data):
    if not isinstance(data, dict):
        return
    save_church_content("social", data)


def get_public_content():
    # Aggregated payload for the public-facing website (minus admin-only data).
    return {
        "church_name": get_church_name(),
        "tagline": get_church_tagline(),
        "basics": get_basics(),
        "organisations": get_public_organisations(),
        "activities": get_activities(),
        "logo": get_church_logo(),
        "social": get_social(),
        "upcoming_events": [],
        "announcements": [],
    }


def get_public_organisations():
    # Static default organisations, then augmented with live ministries (with
    # their events and picture galleries) from the ministries table.
    orgs = list(get_organisations())
    try:
        from ministries import get_all_ministries, get_ministry_events, get_ministry_pictures
        for m in get_all_ministries():
            orgs.append({
                "title": m.get("name") or "Organisation",
                "subtitle": "Church Organisation",
                "description": m.get("description") or "",
                "ministry_id": m.get("id"),
                "events": get_ministry_events(m.get("id")),
                "pictures": get_ministry_pictures(m.get("id")),
            })
    except Exception:
        pass
    return orgs

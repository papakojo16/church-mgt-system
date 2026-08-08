import json
import os

# Persists the site-wide default theme name in a JSON file at the project root,
# so the chosen color survives restarts without touching the database.
CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "theme_default.json")

# Built-in Material color palettes; each entry is a fixed 5-shade set plus a
# seed color and a background tint derived from that hue.
ALL_COLORS = [
    {"name": "Blue", "seed": "#2196f3", "dark": "#1565c0", "medium": "#1e88e5", "highlight": "#42a5f5", "light": "#90caf9", "bg": "#e3f2fd"},
    {"name": "Indigo", "seed": "#3f51b5", "dark": "#1a237e", "medium": "#303f9f", "highlight": "#5c6bc0", "light": "#9fa8da", "bg": "#e8eaf6"},
    {"name": "Teal", "seed": "#009688", "dark": "#00695c", "medium": "#00796b", "highlight": "#26a69a", "light": "#80cbc4", "bg": "#e0f2f1"},
    {"name": "Green", "seed": "#4caf50", "dark": "#2e7d32", "medium": "#43a047", "highlight": "#66bb6a", "light": "#a5d6a7", "bg": "#e8f5e9"},
    {"name": "Purple", "seed": "#9c27b0", "dark": "#6a1b9a", "medium": "#8e24aa", "highlight": "#ab47bc", "light": "#ce93d8", "bg": "#f3e5f5"},
    {"name": "Red", "seed": "#f44336", "dark": "#c62828", "medium": "#e53935", "highlight": "#ef5350", "light": "#ef9a9a", "bg": "#ffebee"},
    {"name": "Orange", "seed": "#ff9800", "dark": "#e65100", "medium": "#fb8c00", "highlight": "#ffa726", "light": "#ffcc80", "bg": "#fff3e0"},
    {"name": "Cyan", "seed": "#00bcd4", "dark": "#00838f", "medium": "#00acc1", "highlight": "#26c6da", "light": "#80deea", "bg": "#e0f7fa"},
    {"name": "Deep Purple", "seed": "#673ab7", "dark": "#4527a0", "medium": "#5e35b1", "highlight": "#7e57c2", "light": "#b39ddb", "bg": "#ede7f6"},
    {"name": "Pink", "seed": "#e91e63", "dark": "#ad1457", "medium": "#d81b60", "highlight": "#ec407a", "light": "#f48fb1", "bg": "#fce4ec"},
    {"name": "Amber", "seed": "#ffc107", "dark": "#ff8f00", "medium": "#ffb300", "highlight": "#ffca28", "light": "#ffe082", "bg": "#fff8e1"},
    {"name": "Lime", "seed": "#cddc39", "dark": "#9e9d24", "medium": "#c0ca33", "highlight": "#d4e157", "light": "#e6ee9c", "bg": "#f9fbe7"},
    {"name": "Light Blue", "seed": "#03a9f4", "dark": "#0277bd", "medium": "#039be5", "highlight": "#29b6f6", "light": "#81d4fa", "bg": "#e1f5fe"},
    {"name": "Deep Orange", "seed": "#ff5722", "dark": "#bf360c", "medium": "#f4511e", "highlight": "#ff7043", "light": "#ffab91", "bg": "#fbe9e7"},
    {"name": "Brown", "seed": "#795548", "dark": "#4e342e", "medium": "#6d4c41", "highlight": "#8d6e63", "light": "#bcaaa4", "bg": "#efebe9"},
    {"name": "Blue Grey", "seed": "#607d8b", "dark": "#37474f", "medium": "#546e7a", "highlight": "#78909c", "light": "#b0bec5", "bg": "#eceff1"},
]

DEFAULT_COLOR = "Blue"


def _load_default():
    # Read the saved default color name; falls back to Blue on any error.
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {"name": DEFAULT_COLOR}


def _save_default(data):
    # Persist the default color name; failures are ignored (theme still works
    # with the in-memory default for this process).
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(data, f)
    except Exception:
        pass


def _get_color_info(name):
    # Look up a palette by its display name; unknown names fall back to the
    # first palette (Blue) so the UI never receives an empty theme.
    for entry in ALL_COLORS:
        if entry["name"] == name:
            return entry
    return ALL_COLORS[0]


def get_default_theme_name():
    return _load_default().get("name", DEFAULT_COLOR)


def set_default_theme(color_name):
    _save_default({"name": color_name})


def get_theme_colors(name=None):
    if name is None:
        name = get_default_theme_name()
    return _get_color_info(name)

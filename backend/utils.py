# Keys that must never leave the server (e.g. in API responses).
_sensitive_keys = {"password_hash"}


def strip_sensitive(data):
    # Recursively (dicts only) drop sensitive fields before returning user data
    # to the client.
    if isinstance(data, dict):
        return {k: v for k, v in data.items() if k not in _sensitive_keys}
    return data


def role_display_name(role):
    # Maps internal role codes to user-facing titles used across the UI.
    mapping = {
        "pastor": "Reverend",
        "admin": "Steward",
        "finance": "Finance Officer",
    }
    return mapping.get(role, role.title())

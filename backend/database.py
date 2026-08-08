import socket

import pymysql
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

# Tracks whether the last DB connectivity probe succeeded (also mutated in init_db).
_online_status = {"is_online": True}


def _connect():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
        connect_timeout=5,
    )


def get_connection():
    # Serverless-friendly connection handling: every call opens a fresh
    # connection which the caller must close with conn.close(). This works on
    # short-lived serverless processes (e.g. Vercel Functions) as well as
    # long-lived uvicorn workers, where one connection per request is fine.
    return _connect()


def is_online():
    # Cheap TCP probe to the MySQL port (faster than a full login handshake).
    try:
        sock = socket.create_connection((DB_HOST, DB_PORT), timeout=3)
        sock.close()
        _online_status["is_online"] = True
        return True
    except Exception:
        _online_status["is_online"] = False
        return False


def get_online_status():
    return _online_status["is_online"]


def init_db():
    # Idempotent schema bootstrap: create the database, every table, and any
    # columns added after the original deploy. Failures are caught per-step so
    # older schemas can migrate incrementally without aborting the whole run.
    if not is_online():
        return
    try:
        conn = pymysql.connect(
            host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD,
            charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor, autocommit=True,
        )
        cur = conn.cursor()
        # Connect without a DB first so we can create the database itself.
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        conn.close()

        conn = get_connection()
        cur = conn.cursor()
        cur.execute(f"USE `{DB_NAME}`")

        # Core user/login table; `role` drives authorization (admin/member/finance/pastor).
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(80) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(120),
            full_name VARCHAR(150) NOT NULL,
            role ENUM('admin','member','finance','pastor') DEFAULT 'member',
            phone VARCHAR(20),
            date_joined DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            must_change_password BOOLEAN DEFAULT FALSE
        )
        """)

        # Per-member profile record, one-to-one with users via user_id.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNIQUE NOT NULL,
            address TEXT,
            date_of_birth DATE,
            gender ENUM('Male','Female','Other'),
            family_name VARCHAR(100),
            baptism_date DATE,
            membership_date DATE DEFAULT (CURRENT_DATE),
            profile_photo VARCHAR(255),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Small group tables: groups_t (name is a reserved word, hence the suffix)
        # and the many-to-many group_members join referencing users as members.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS groups_t (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            leader_id INT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS group_members (
            group_id INT NOT NULL,
            member_id INT NOT NULL,
            joined_date DATE DEFAULT (CURRENT_DATE),
            PRIMARY KEY (group_id, member_id),
            FOREIGN KEY (group_id) REFERENCES groups_t(id) ON DELETE CASCADE,
            FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Donations (income). member_id is nullable so anonymous/"All Members"
        # donations are allowed; category is the tithe/offering etc. bucket.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS donations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            member_id INT NULL,
            amount DECIMAL(12,2) NOT NULL,
            category ENUM('Tithe','Offering','Project Fund','Harvest','Grace Box','Welfare','Other','Donations','Appeals','MDF','Building Fund','Pledge') DEFAULT 'Tithe',
            donation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            payment_method ENUM('Cash','Mobile Money','Bank Transfer','Card','Check') DEFAULT 'Cash',
            reference VARCHAR(100),
            notes TEXT,
            FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Expenses (outgoings); approved_by records who authorized the spend.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            amount DECIMAL(12,2) NOT NULL,
            category VARCHAR(80) NOT NULL,
            description TEXT,
            expense_date DATE DEFAULT (CURRENT_DATE),
            approved_by INT,
            receipt VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """)

        # Announcements: priority ranks how they're ordered; date_expires
        # hides stale announcements after a given date.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS announcements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            author_id INT NOT NULL,
            priority ENUM('Low','Normal','High','Urgent') DEFAULT 'Normal',
            is_active BOOLEAN DEFAULT TRUE,
            date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
            date_expires DATE,
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Events: single, multi-day (via end_date) or recurring (is_recurring
        # + recurrence_rule stores the weekday); optional ministry_id added later.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            event_date DATETIME NOT NULL,
            end_date DATETIME,
            location VARCHAR(200),
            created_by INT NOT NULL,
            is_recurring BOOLEAN DEFAULT FALSE,
            recurrence_rule VARCHAR(100),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Ministries: `roles` stores a JSON array of allowed role names.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS ministries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            leader_id INT,
            roles TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL
        )
        """)
        # Idempotent migrations for columns that were added after the initial
        # schema; failures are ignored since the column may already exist.
        try:
            cur.execute("ALTER TABLE ministries ADD COLUMN roles TEXT")
        except Exception:
            pass

        try:
            cur.execute("ALTER TABLE users ADD COLUMN username VARCHAR(80) UNIQUE")
        except Exception:
            pass

        try:
            cur.execute("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE")
        except Exception:
            pass

        # Many-to-many: members of a ministry, each with a role within it.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS ministry_members (
            ministry_id INT NOT NULL,
            member_id INT NOT NULL,
            role VARCHAR(50) DEFAULT 'Member',
            joined_date DATE DEFAULT (CURRENT_DATE),
            PRIMARY KEY (ministry_id, member_id),
            FOREIGN KEY (ministry_id) REFERENCES ministries(id) ON DELETE CASCADE,
            FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Ministry gallery: images stored as base64 in a LONGTEXT column.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS ministry_pictures (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ministry_id INT NOT NULL,
            image LONGTEXT NOT NULL,
            caption VARCHAR(200),
            created_by INT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ministry_id) REFERENCES ministries(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """)

        # Aggregate attendance per service date; unique_date enforces one row
        # per service date (re-inserting updates the same record).
        cur.execute("""
        CREATE TABLE IF NOT EXISTS weekly_attendance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            service_date DATE NOT NULL,
            adult_male INT DEFAULT 0,
            adult_female INT DEFAULT 0,
            child_male INT DEFAULT 0,
            child_female INT DEFAULT 0,
            note TEXT,
            recorded_by INT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_date (service_date),
            FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """)

        # Per-member attendance for events/services; status is Present/Absent/etc.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            member_id INT NOT NULL,
            event_id INT,
            service_date DATE,
            status VARCHAR(20) DEFAULT 'Present',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        )
        """)

        # Idempotent migration: ensure the head-count columns exist on the
        # weekly_attendance table for installs created before they were added.
        for col in ["adult_male", "adult_female", "child_male", "child_female"]:
            try:
                cur.execute(f"ALTER TABLE weekly_attendance ADD COLUMN {col} INT DEFAULT 0 AFTER service_date")
            except Exception:
                pass

        # Remove a legacy column that was dropped from the model.
        try:
            cur.execute("ALTER TABLE donations DROP COLUMN head_count")
        except Exception:
            pass

        # Re-normalize the category enum to match the current supported list.
        cur.execute("""
            ALTER TABLE donations MODIFY COLUMN category 
            ENUM('Tithe','Offering','Project Fund','Harvest','Grace Box','Welfare','Other','Donations','Appeals','MDF','Building Fund','Pledge') DEFAULT 'Tithe'
        """)

        # Anonymous donations must be allowed, so member_id is nullable.
        cur.execute("ALTER TABLE donations MODIFY COLUMN member_id INT NULL")

        # Records which user deleted which donation receipt, so each user only
        # "deletes" a receipt for themselves (per-user soft deletion).
        cur.execute("""
        CREATE TABLE IF NOT EXISTS receipt_deletions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            donation_id INT NOT NULL,
            user_id INT NOT NULL,
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_donation_user (donation_id, user_id),
            FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # Audit trail of user actions for admin review.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            action VARCHAR(50) NOT NULL,
            category VARCHAR(50) NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
        """)

        # Editable website content: section_name is the key and content holds
        # JSON (or plain text), so admins can edit public-facing sections.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS church_content (
            section_name VARCHAR(50) PRIMARY KEY,
            content LONGTEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
        """)

        # Schema upgrades that check for column existence instead of swallowing
        # errors, because these add NEW functionality (not just fixes).
        cur.execute("SHOW COLUMNS FROM events LIKE 'end_date'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE events ADD COLUMN end_date DATETIME AFTER event_date")

        cur.execute("SHOW COLUMNS FROM events LIKE 'ministry_id'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE events ADD COLUMN ministry_id INT NULL AFTER created_by")

        cur.execute("SHOW COLUMNS FROM announcements LIKE 'bible_reading'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE announcements ADD COLUMN bible_reading TEXT AFTER content")

        cur.execute("SHOW COLUMNS FROM announcements LIKE 'preacher'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE announcements ADD COLUMN preacher VARCHAR(150) AFTER bible_reading")

        # Sunday service program: preacher + Bible reading for each service date.
        cur.execute("""
        CREATE TABLE IF NOT EXISTS service_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            service_date DATE NOT NULL,
            preacher VARCHAR(150),
            bible_reading TEXT,
            created_by INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        conn.close()
        _online_status["is_online"] = True
    except Exception:
        # Any schema failure marks the DB offline so the health endpoint can report it.
        _online_status["is_online"] = False

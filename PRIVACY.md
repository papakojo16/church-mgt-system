# Privacy Policy — Mt. Olivet Methodist Church Management System

**Last updated:** 2026-08-22

This policy explains how the Mt. Olivet Methodist Church management system ("the
System", "we", "us") collects, uses, stores and protects personal information. By
creating an account you consent to the practices described here.

## Who is responsible

The System is operated by Mt. Olivet Methodist Church for the administration of its
congregation and finances. For any privacy request, contact the church
administrator via the contact details published on the church website or in person
at the church office.

## Data we collect

When you or an administrator create a member record, we may store:

- **Identity:** full name, username, gender, family name, date of birth, baptism date, membership date.
- **Contact details:** email address and phone number, and postal address.
- **Account data:** login credentials (stored only as salted bcrypt hashes — your plaintext password is never stored).
- **Financial data:** donation and tithe records, expense approvals, and receipts linked to your member profile.
- **Activity data:** audit logs of actions performed in the System (e.g. record creation, edits).
- **Consent record:** whether and when you accepted this Privacy Policy.

## Why we collect it (purpose)

- To manage church membership and communicate with members.
- To record and acknowledge donations, tithes and offerings.
- To administer church events, ministries, announcements and attendance.
- To comply with financial record-keeping obligations.
- To secure the System and prevent fraud or abuse.

## Legal basis

We process this information on the bases of **legitimate interests** (church
administration), **contractual necessity** (providing the services you request), and
your **consent** (for optional contact details and where required by applicable data
protection law, including the Ghana Data Protection Act, 2012 and, where relevant,
the EU General Data Protection Regulation).

## How we protect it

- Passwords are hashed with bcrypt; plaintext passwords are never stored.
- Database queries are parameterised to prevent injection.
- Access to personal and financial data is restricted by role-based permissions (member, pastor, finance officer, administrator).
- API access requires an authenticated, rotating token; sessions can be revoked.
- The production database is hosted by a third-party provider (TiDB Cloud). Database
  credentials are stored server-side and are not included in client applications.

## Data sharing

We do **not** sell or rent personal data. Information is shared only:

- Within the church leadership/administration roles necessary to perform church functions.
- With our hosting/infrastructure provider strictly for operating the System.
- Where required by law or a valid legal process.

## Your rights

Subject to applicable law, you may:

- Request access to the personal data we hold about you.
- Request correction of inaccurate or outdated data.
- Request deletion (erasure) of your personal data, subject to legal retention obligations for financial records.
- Withdraw consent at any time, where processing is based on consent.

To exercise these rights, contact the church administrator. You may also lodge a
complaint with the relevant data protection authority.

## Data retention

We keep personal data only as long as necessary for the purposes above or as required
by law. Financial transaction records may be retained for the period mandated by
tax/charity and data-protection law even after a membership ends.

## Cookies and local storage

The System stores your session token and refresh token in your browser's local
storage to keep you logged in, and cached public content for offline use. No tracking
cookies are used for advertising.

## Children's data

Where a member is a minor, their data is collected and used only for the church
administrative purposes described above, typically provided by a parent or guardian.

## Changes to this policy

We may update this policy from time to time. Material changes will be communicated
through the System or the church's usual channels.

## Contact

Questions about this policy or your personal data should be directed to the Mt. Olivet
Methodist Church administrator.

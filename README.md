# SGS SOLUTION — Full-stack Solar Care Platform

Solar-first green/yellow website for solar installation, maintenance plans, customer accounts, service claims, CCTV services, employee work updates, admin operations, payments, and notifications.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript (responsive, animated green/yellow UI)
- Backend: Node.js + Express REST API
- Database: SQLite (`better-sqlite3`) in this supplied project archive
- Authentication: bcrypt password hashing + signed JWT sessions + role checks
- Uploads: Multer (JPG/PNG/WEBP work-photo upload, configurable size limit)
- Payments: Razorpay Orders + signature verification + webhook support; offline payment confirmation and admin verification
- Notifications: in-app records, SMTP email + Meta WhatsApp Cloud API attempts, admin mirroring, delivery logs, retry/backoff scheduler, manual retry API, monthly reminder scheduler

## Run locally (Windows)
1. Install **Node.js 20 LTS or newer** from https://nodejs.org/.
2. Extract this folder to a normal writable location, such as `C:\SGS-SOLUTION-Full-Stack`.
3. Open that folder in VS Code.
4. In the VS Code terminal run:
   ```bash
   npm install
   ```
5. Copy `.env.example` to a new file named `.env`.
6. In `.env`, set a long random `JWT_SECRET`, and set the first admin details (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Change the sample admin password before using the app. The admin is created on first startup if no admin exists.
7. Start the server:
   ```bash
   npm start
   ```
8. Open http://localhost:3000. On Windows, after configuring `.env`, you can also double-click `start-windows.bat`.

Development mode: `npm run dev`. Syntax check: `npm run check`.

## Login and portals
- Customers: use **Customer login** or **Create account** on the main page.
- Employee: open the ☰ menu → **Employee login**. Admin creates employee accounts.
- Partner: use **Become a Solar Partner** from the menu or the homepage partner section. Submit the application and wait for admin approval, then use **Partner login**. Approved partners get a referral code/link, referral tracking and assigned service tickets.
- Admin: open the ☰ menu → **Admin login**. Use the email/password you configured in `.env`.
- There is deliberately no public admin or employee registration endpoint.

## Payment setup
### Razorpay online payment
Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in `.env`. Configure the Razorpay webhook URL as:
`https://YOUR-DOMAIN/api/payments/razorpay/webhook`
Subscribe to `payment.captured`. Keep test keys enabled until test payments and webhooks are verified. Do not use live keys until business/KYC approval and production testing are complete.

### Offline payment
A customer can record a cash/UPI/bank-transfer/offline payment and then confirm that payment. The admin must verify that funds were actually received before plan credits are activated. The employee recording the payment must never be the only verifier if a stronger separation of duties is required.

## Email setup
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Email delivery is skipped until SMTP is configured. Review the `notifications` table / admin notification log for delivery status.

## WhatsApp setup
Configure Meta WhatsApp Cloud API values:
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_API_VERSION`
- `WHATSAPP_ADMIN_NUMBER` (international format digits, e.g. country code + number)

Customer-initiated notifications use text messages in this starter. Business-initiated messages outside the customer-service window generally require approved WhatsApp message templates and consent. The current helper can be extended to named, approved templates. Do not message customers without appropriate consent. Photo upload alerts to the admin include a URL to the uploaded proof image.

## Central notification and retry system
- Important account, partner, payment, plan and service events are saved in the notification log.
- The server attempts customer/recipient email and WhatsApp delivery when contact details are present, and mirrors customer/partner/employee events to the configured admin email and admin WhatsApp number.
- Failed external deliveries are retained with error details and retried automatically every five minutes using increasing delays (up to five attempts). Admins can inspect delivery status with `GET /api/admin/notifications/delivery-status` and retry a failed item with `POST /api/admin/notifications/:id/retry`.
- Provider credentials are required for actual external delivery. Without SMTP, email delivery will be recorded as failed; without Meta WhatsApp credentials and an admin number, WhatsApp delivery cannot be sent. No software can guarantee delivery if a provider, network, recipient address, or WhatsApp policy blocks it.
- Use an official WhatsApp Business Platform setup, approved templates for business-initiated messages when required, and obtain customer consent before sending WhatsApp notifications. Test with real provider credentials before launch.

## Monthly reminders
A cron job runs daily at 10:15 AM India time. It sends a reminder to customers with a selected plan only when their last monthly reminder was at least 30 days ago. Configure SMTP/WhatsApp if you need external delivery; in-app records are always stored.

## Partner application and referrals
- Public partner application form collects name, phone, email, city/area, partner type, business name, experience, password, and contact consent.
- Applications start as `pending`; partner login is blocked until admin approval. Admin reviews/approves/rejects applications under **Admin → Employees & partners**.
- Approved partners have a referral code and shareable URL, and a partner dashboard with referrals and commission status. Customer registration accepts an optional referral code. Referral status becomes `Eligible` after the referred customer has a payment verified.
- The starter currently uses a configurable-by-code illustrative ₹300 referral commission; confirm the actual commercial terms with SGS SOLUTION before production.

## Main API routes
- `GET /api/health`, `GET /api/plans`, `GET /api/appointments/availability?date=YYYY-MM-DD`, `POST /api/appointments`
- `POST /api/partners/register`; `GET /api/partner/dashboard`; `PATCH /api/admin/partners/:id/status`
- `POST /api/auth/register`, `/api/auth/login`; `GET /api/auth/me`; `POST /api/auth/change-password`
- `GET /api/customer/dashboard`; `POST /api/customer/select-plan`, `/checkout`, `/offline-payment`, `/tickets`
- `POST /api/customer/payments/:id/confirm`
- `POST /api/payments/razorpay/verify`, `/api/payments/razorpay/webhook`
- `GET /api/employee/dashboard`; `POST /api/employee/tickets/:id/update` (multipart photo upload)
- `GET /api/admin/overview`; `POST /api/admin/admins`; `POST /api/admin/employees`; `POST /api/admin/tickets/:id/assign`; `POST /api/admin/payments/:id/verify`; `PATCH /api/admin/appointments/:id/status`; `POST /api/admin/notifications`; `GET /api/admin/export`

## Database and uploads
- This supplied archive still uses SQLite. MongoDB Atlas has not yet been migrated into this codebase; do not assume setting `MONGODB_URI` alone switches databases.
- SQLite database: `data/sgs-solution.sqlite` (created automatically)
- Uploaded proof photos: `uploads/`
- Back up both locations regularly. For production, prefer private object storage for work photos and serve them through authenticated/authorized routes instead of public static URLs.

## Before production launch
This is a complete starter implementation, but external services cannot be activated without the client's own credentials and domain. Before launch:
1. Use HTTPS, a persistent server, a strong secret, secure backups, and a process manager.
2. Set `NODE_ENV=production`, configure SMTP/WhatsApp/Razorpay, and verify callbacks end to end.
3. Add a privacy notice and terms, customer consent for WhatsApp, payment/refund policies, and data retention rules.
4. Protect uploaded images behind authorization/private storage, scan uploads, and set a backup/retention policy.
5. Test the entire payment flow in Razorpay test mode and test role permissions on multiple accounts.
6. Configure a real domain in `APP_URL`; localhost links only work on the same machine.

## Plans preserved
- Essential — ₹599 — 1 illustrative service credit
- Solar Care 360 — ₹999 — 3 illustrative service credits
- Premium — ₹1,499 — 5 illustrative service credits
- Capacity plans — ₹999 (up to 3 kW), ₹1,299 (up to 5 kW), ₹1,599 (up to 8 kW), ₹1,999 (up to 10 kW)

Credit quantities are configurable defaults from the prototype and should be confirmed with SGS SOLUTION before taking live payments. Prices are in INR.

## Green-Yellow frontend backend integration

The Green-Yellow homepage (`public/index.html`) now loads `public/backend-integration.js`. This keeps the visual design while connecting customer registration/login, partner and employee login, admin login, plan selection, service tickets, offline/online payment flows, partner applications, and solar consultation enquiries to the existing Express + SQLite API.

- Start locally with `npm start` (or `start-windows.bat`) and open the URL printed by the server, normally `http://localhost:3000`.
- The private `.env` file is intentionally not included in the project archive. Configure `JWT_SECRET` and the first admin account as described in `.env.example` before deployment.
- Razorpay checkout only works after valid `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and any required webhook configuration are set in `.env`. Offline payment requests are stored as pending and must be verified by an administrator after the funds are actually received.
- Email and WhatsApp delivery only work when their provider credentials are configured. Enquiries are stored in SQLite and visible in the admin dashboard.
- Do not deploy with the example admin password or a weak `JWT_SECRET`.

## Dedicated appointment page
The public booking form is available at `/booking.html`. It uses a responsive single-column layout on phones, a scrollable full-page form (not a clipped modal), touch-friendly date/time slots, required-field validation, optional email contact, live availability lookup, and posts to `POST /api/appointments`. Appointment requests are saved in the `appointments` table; active slots are protected by a unique database index so simultaneous submissions cannot double-book the same date/time. Admins can confirm, complete, or cancel appointments in the admin dashboard; status updates notify registered customers or guest contact details when provider credentials are configured.

## Account creation and administrator security

- Customers can create an account from `public/customer-login.html` using **New customer? Create an account**. Customer registration is public; it can only create the `customer` role.
- Partners can apply from `public/partner-login.html`. Partner applications require admin approval before partner login is enabled.
- Admin accounts cannot self-register from the public login screen. Configure the first administrator using `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` in the server `.env` before the first launch (the seed only runs when there is no admin in the database).
- Once signed in, an administrator can use **Create Another Administrator** in `public/admin.html`. The API requires the current admin's password and enforces a 12-character minimum for the new admin password. The endpoint is protected by admin authentication and role checks.
- Do not commit `.env` or share production credentials. Create the first admin with a unique strong password, then sign in and create any additional admins from the protected portal.

### Account URLs
- Customer: `/customer-login.html`
- Partner application/login: `/partner-login.html`
- Admin: `/admin.html`

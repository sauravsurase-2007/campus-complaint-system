# 🎓 Cloud-Based Campus Complaint Management System

A serverless complaint portal for a college campus. Students raise and track complaints; admins review, update status and leave remarks; everyone is notified by email.

**Stack:** plain HTML/CSS/JS (no build step) · Amazon S3 · Cognito · API Gateway (HTTP API) · Lambda (Node.js) · DynamoDB · SNS · AWS SAM (Infrastructure as Code)

## Features

| Feature | How it works |
|---|---|
| Student / Admin login | Cognito User Pool. Students self-sign-up with email verification; admins are users in the `Admins` group |
| Submit complaints | Student form → `POST /complaints` |
| Students see only their own | Lambda queries DynamoDB with the `sub` from the verified token – never from client input |
| Admin manages all | `GET /complaints` (all), `PUT /complaints/{id}` (status + remark) – admin only |
| Statuses | Pending, In Progress, Resolved, Rejected (Rejected requires a remark) |
| Admin remarks + history | Every change is appended to a `history` timeline shown to the student |
| Student notification | SNS email on every status/remark change |
| Admin notification | SNS email on every new complaint |
| Dashboards | Student and Admin pages with live counters, filters and search |
| Role-based security | API Gateway JWT authorizer + role check inside Lambda (see *Security*) |

## Architecture

```
Browser (S3 static site)
   │  sign in / sign up                 ┌──────────────┐
   ├──────────────────────────────────► │   Cognito    │  ID token (JWT, groups)
   │                                    └──────────────┘
   │  Authorization: Bearer <ID token>
   ▼
API Gateway (HTTP API, JWT authorizer) ──► Lambda ──► DynamoDB (complaints + GSI by student)
                                             └──────► SNS  (admin topic, student topic)
```

## Project structure

```
campus-complaint-system/
├── template.yaml            # SAM: ALL AWS resources (Cognito, DynamoDB, SNS, API, Lambda, S3)
├── samconfig.toml           # SAM defaults
├── backend/                 # Lambda code (Node.js, zero npm dependencies)
│   └── src/ index.js  auth.js  db.js  notify.js  validate.js  errors.js
├── frontend/                # Static website uploaded to S3
│   ├── index.html  student.html  admin.html
│   ├── css/styles.css
│   └── js/ config.js  auth.js  api.js  ui.js  login.js  student.js  admin.js
├── scripts/                 # deploy + create-admin (bash and PowerShell)
└── .vscode/                 # recommended extensions and tasks
```

---

## 1. Prerequisites (one-time)

1. **AWS account** (Free Tier is fine) and an IAM user/role with permissions for CloudFormation, S3, Lambda, API Gateway, DynamoDB, SNS, Cognito and IAM. For a personal learning account, `AdministratorAccess` is simplest.
2. **Install:**
   - [VS Code](https://code.visualstudio.com/)
   - [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
   - [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
   - [Node.js 20+](https://nodejs.org/) (SAM uses it to package the Lambda)
   - Windows only: use **PowerShell** in VS Code. (Git Bash/WSL can use the `.sh` scripts.)
3. Verify in a terminal: `aws --version`, `sam --version`, `node --version`.
4. **Create access keys** (IAM → Users → your user → Security credentials → Create access key → CLI), then run:
   ```
   aws configure
   ```
   Enter the key, secret, default region `ap-south-1` (Mumbai – or any region you prefer; keep it consistent) and output `json`. Check with `aws sts get-caller-identity`.
5. **Account-level S3 Block Public Access:** the website bucket must be publicly readable (the template disables bucket-level blocking). If your account has *account-level* "Block all public access" turned on, switch it off: S3 console → **Block Public Access settings for this account** → Edit → untick → Save. (Not needed if you add CloudFront – see *Production hardening*.)

## 2. Open in VS Code

1. Unzip `campus-complaint-system.zip`.
2. VS Code → **File → Open Folder…** → select the `campus-complaint-system` folder.
3. Accept the *Recommended extensions* prompt (AWS Toolkit, Prettier, ESLint, Live Server).
4. Open a terminal: **Terminal → New Terminal**.

## 3. Deploy to AWS

Run from the project root, using your own email as the admin notification address.

**Windows (PowerShell):**
```powershell
.\scripts\deploy.ps1 -AdminEmail you@example.com -Region ap-south-1
```
If PowerShell blocks scripts: `Set-ExecutionPolicy -Scope Process Bypass`, then retry.

**macOS / Linux / Git Bash / WSL:**
```bash
./scripts/deploy.sh you@example.com ap-south-1
```

The script: (1) `sam build`, (2) `sam deploy` (creates everything via CloudFormation, ~3–5 min), (3) writes your Cognito/API values into `frontend/js/config.js`, (4) uploads the frontend to S3, (5) prints the website URL.

<details><summary>Prefer to run the commands manually?</summary>

```bash
sam build
sam deploy --stack-name campus-complaints --region ap-south-1 --capabilities CAPABILITY_IAM --resolve-s3 --parameter-overrides AdminEmail=you@example.com
# read outputs
aws cloudformation describe-stacks --stack-name campus-complaints --region ap-south-1 --query "Stacks[0].Outputs"
# edit frontend/js/config.js with UserPoolId, UserPoolClientId, ApiUrl, region, then:
aws s3 sync frontend s3://<WebsiteBucket output> --delete
```
</details>

## 4. Post-deploy steps

1. **Confirm the admin SNS subscription.** Check the inbox of the admin email and click *Confirm subscription* in the email from AWS Notifications (check spam). Without this you won't get new-complaint alerts.
2. **Create your first admin user:**
   ```powershell
   .\scripts\create-admin.ps1 -Email you@example.com -Password 'Admin@12345' -Name "Campus Admin"
   ```
   ```bash
   ./scripts/create-admin.sh you@example.com 'Admin@12345' "Campus Admin"
   ```
   (Password needs 8+ chars with upper, lower and a number. Add more admins by repeating with other emails – or in the Cognito console add an existing user to the **Admins** group.)
3. **Open the website URL** printed by the script (format `http://<bucket>.s3-website.<region>.amazonaws.com`).
4. **Test as a student:** *Student sign up* → enter the emailed code → sign in → submit a complaint.
   - The student receives an **SNS subscription confirmation email** the first time they submit a complaint – they must click *Confirm subscription* once to receive status updates. (This is how SNS email works; see *Notification notes*.)
5. **Test as admin:** sign in with the admin account → click the complaint → change status, add a remark → *Save & notify student*. The student gets an email.

## 5. Local preview / editing the frontend

After the first deploy, `frontend/js/config.js` contains your live values, so you can preview locally:
```
npm run preview        # http://localhost:5500  (or use Live Server → Open with Live Server)
```
The API's CORS allows any origin, so local pages work against the deployed backend. After changing frontend files, re-upload without redeploying the backend:
```
aws s3 sync frontend s3://<WebsiteBucket> --delete
```
After changing backend or `template.yaml`, re-run the deploy script.

## 6. Roles and security

- **Identity:** Cognito verifies credentials and issues a signed **ID token**. Admin = member of Cognito group `Admins`; everyone else is a student. Users cannot change their own group.
- **API Gateway JWT authorizer** rejects any request without a valid, unexpired token from this user pool/app client (401) *before* Lambda runs.
- **Lambda enforces roles:**
  - `POST /complaints` – students only; `userId` comes from the token (`sub`), so nobody can file as someone else.
  - `GET /complaints` – students get only items from the `userId` index; admins get all.
  - `GET /complaints/{id}` – owner or admin; other students get `404`.
  - `PUT /complaints/{id}` – admins only.
- All input is validated server-side; all user content is HTML-escaped on render (XSS-safe).
- DynamoDB encrypted at rest; Lambda role is least-privilege (one table, two topics); API throttled (10 req/s, burst 20).
- Frontend role checks are only for convenience; the real checks are in the API.

## 7. Database (DynamoDB) – created automatically by `template.yaml`

Table `campus-complaints-complaints`, provisioned 5 RCU / 5 WCU (inside the always-free 25/25).

| Attribute | Notes |
|---|---|
| `complaintId` (PK) | UUID |
| `userId`, `userEmail`, `userName` | Owner (Cognito `sub`, email, name) |
| `title`, `category`, `priority`, `location`, `description` | Student input |
| `status` | `Pending` \| `In Progress` \| `Resolved` \| `Rejected` |
| `adminRemark` | Latest remark |
| `createdAt`, `updatedAt` | ISO timestamps |
| `history` | List of `{status, remark, by, at}` |

GSI `userId-createdAt-index` (PK `userId`, SK `createdAt`) powers "my complaints". No manual setup or seed data is needed.

## 8. API reference

All routes need `Authorization: Bearer <Cognito ID token>`.

| Method & path | Who | Body | Result |
|---|---|---|---|
| `POST /complaints` | Student | `{title, category, priority, location?, description}` | `201` complaint |
| `GET /complaints[?status=]` | Student (own) / Admin (all) | – | `{items: [...]}` |
| `GET /complaints/{id}` | Owner / Admin | – | complaint |
| `PUT /complaints/{id}` | Admin | `{status?, adminRemark?}` | updated complaint |

## 9. Notification notes

- **Admin alerts:** SNS topic with your admin email subscribed by CloudFormation. To add more admins, add email subscriptions to the `…-admin-alerts` topic in the SNS console.
- **Student alerts:** to stay within SNS only (no SES), the API subscribes each student's email to one topic with a *filter policy* (`recipient = their email`) so they only receive their own updates. Each student confirms once. Emails come from "AWS Notifications" and may land in spam.
- For branded, no-confirmation emails in production, swap `notify.js` to use Amazon SES.

## 10. Cost (Free Tier friendly)

Lambda, API Gateway HTTP API, DynamoDB (provisioned ≤25 units), SNS email (first 1,000/month free), Cognito (first 10,000 MAU free) and S3 (small site) are all inside Free Tier limits for typical campus-pilot usage. Cognito's default email sender is limited to 50 emails/day – configure SES in Cognito for more sign-ups per day. Set a budget alert in **AWS Billing → Budgets** to be safe.

## 11. Production hardening (optional)

- Put **CloudFront** (HTTPS + custom domain via ACM/Route 53) in front of the private bucket – S3 website endpoints are HTTP only.
- Restrict `AllowOrigins` in `template.yaml` to your site's URL.
- Enable Cognito MFA / advanced security; use SES for emails.
- Add a status GSI or pagination if you expect tens of thousands of complaints.

## 12. Clean up (delete everything)

```bash
aws s3 rm s3://<WebsiteBucket> --recursive
aws cloudformation delete-stack --stack-name campus-complaints --region ap-south-1
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "App not configured yet" on login page | `frontend/js/config.js` still has placeholders – run the deploy script |
| `AccessDenied` opening the website | Account-level Block Public Access is on (see Prerequisites step 5) and/or the bucket policy didn't apply; redeploy |
| Login works but API returns 401 | Token expired or wrong region in `config.js`; sign out and in again |
| Student gets 403 on admin page | Expected – only `Admins` group members are admins. Sign out/in after being added to the group so the token has the group |
| No emails | Confirm SNS subscriptions; check spam; check CloudWatch logs for `/aws/lambda/campus-complaints-api` |
| `sam: command not found` | Reopen VS Code after installing SAM CLI |
| Deploy fails with `S3 bucket already exists` | Not applicable – bucket names are auto-generated; check the CloudFormation *Events* tab for the real error |

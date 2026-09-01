# CareFlow

CareFlow is a clinic-scoped questionnaire and intake platform. It imports complex WPForms exports, executes multi-step form rules, stores responses and private documents by clinic, and presents questionnaire data through a Next.js dashboard.

## Product rules

- Repository content, UI copy, API messages, tests, and documentation are English-only.
- Clinics may operate in any country. Regional behaviour is configured per clinic, never hard-coded globally.
- Timestamps are stored in UTC. Clinic timezone and locale settings control presentation.
- Questionnaire submissions are isolated by clinic. Response lists and future document-download endpoints require Sanctum authentication and clinic membership.

## Architecture

The Laravel application is the API and workflow authority. The domain is owned by the Nwidart `Clinic` module:

```text
Modules/Clinic/
├── app/
│   ├── Console/Commands/ImportWpForms.php
│   ├── Http/Controllers/Api/
│   ├── Http/Requests/
│   ├── Http/Resources/
│   ├── Models/
│   └── Services/
├── database/
│   ├── factories/
│   └── migrations/
├── routes/api.php
└── tests/Feature/
```

The Next.js 16 / TailAdmin application lives in `front/`. It consumes the executable schema returned by Laravel and renders page breaks, layouts, conditions, gates, compound inputs, uploads, date pickers, and doctor recommendations.

## Data model

- `clinics`: ownership, branding, locale, timezone, default calling code, and allowed calling codes.
- `clinic_user`: authenticated clinic membership.
- `questionnaires`: clinic-owned form definitions and source metadata.
- `questions`: ordered dynamic fields, source settings, choices, validation, and conditional rules.
- `submissions`: one completed questionnaire response.
- `answers`: values and safe attachment metadata keyed by question.

Uploaded files use Laravel's private local disk and a server-generated path:

```text
clinics/clinic-{clinic_id}/submissions/{submission_uuid}/question-{question_id}/{random_filename}
```

User-controlled names are never used as storage directories. Public response payloads omit the disk and internal storage path.

## Executable questionnaires

`FormSchemaService` converts imported definitions into a versioned execution schema with:

- ordered steps and navigation;
- content and column layouts;
- canonical choice identifiers;
- normalized visibility conditions;
- page eligibility gates;
- typed, allowlisted calculations;
- upload policies and completion workflows.

`FormRuntimeService` is authoritative for visibility, gates, derived age values, and clinician eligibility. Exported PHP or JavaScript formulas are never evaluated.

The imported `appointment-form-main-by-imi-v2` form includes its three-step flow, urgent-care gates, conditional referral upload, age calculation, and single or multiple psychiatrist recommendations.

After a successful submission, CareFlow resolves that questionnaire's own WPForms confirmation. Conditional adult/child confirmations are selected server-side, field placeholders are escaped and interpolated from trusted answers, and confirmation HTML and links are allowlisted before the frontend renders them.

## Clinic regional settings

Regional values are stored in the clinic `settings` JSON. The default calling code must be present in the allowed list.

```json
{
  "locale": "en",
  "timezone": "Europe/Paris",
  "default_calling_code": "+33",
  "allowed_calling_codes": [
    {
      "country": "France",
      "iso": "FR",
      "label": "France (+33)",
      "callingCode": "+33"
    }
  ]
}
```

## API

Public questionnaire discovery, evaluation, and submission:

```text
GET  /api/clinics
GET  /api/clinics/{clinic}/questionnaires
GET  /api/clinics/{clinic}/questionnaires/{questionnaire}
POST /api/clinics/{clinic}/questionnaires/{questionnaire}/evaluate
POST /api/clinics/{clinic}/questionnaires/{questionnaire}/responses
```

Compatibility routes also exist under `/api/questionnaires`. Response listing routes require `auth:sanctum` and clinic membership.

Multipart submissions send answers as a JSON string and files by field key:

```text
answers={"wpforms_47":"Example"}
files[wpforms_7]=referral.pdf
```

## MCP

CareFlow uses Laravel's official `laravel/mcp` package. The authenticated web endpoint is:

```text
/mcp/questionnaires
```

The server can list questionnaires and create clinic-owned draft questionnaires. Drafts remain unpublished until reviewed.

## Local setup

Backend:

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

Frontend:

```bash
cd front
npm install
npm run dev
```

Set MySQL connection values in the uncommitted `.env`. Lock files and environment files are intentionally excluded from this repository.

Import a WPForms export into a clinic:

```bash
php artisan forms:import-wpforms /absolute/path/to/export.json \
  --clinic=empowered-minds-clinic \
  --replace
```

## Verification

```bash
php artisan test --compact
vendor/bin/pint --dirty --format agent
cd front && npm run build
cd front && npm run lint
composer audit
cd front && npm audit --omit=dev
```

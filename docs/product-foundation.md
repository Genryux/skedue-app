# Skedue Product Foundation

This document now follows the same category structure used in InternKonek so we can complete the product foundation one section at a time before implementation.

## 1. Problem

### Core problem

Students manage academic life across disconnected apps for schedules, notes, and tasks.

### Why this is painful

- Class schedules live in one place.
- Notes live in another place.
- Tasks and reminders live somewhere else.
- Students have to rebuild the same subject context across multiple tools.

### What Skedue is trying to solve

Skedue aims to give students one subject-centered workspace where schedules, notes, folders, and to-dos are connected.

## 2. Users

### Primary User: Student

The main user of Skedue is an individual student managing their own academic workload across multiple subjects in one term.

This user is likely to:

- carry 4 to 9 active subjects in a semester,
- check class schedules on mobile throughout the day,
- take notes during or after class,
- track deadlines informally through reminders, chats, or scattered to-do apps,
- and need a fast way to move between schedule, subject context, tasks, and notes.

### Primary User Segments

#### Organized Student

Already uses multiple tools and systems, but wants one cleaner workspace centered on subjects.

Core needs:

- fast schedule checking,
- cleaner note organization,
- and less switching between apps.

#### Overloaded Student

Often forgets deadlines, loses notes, or struggles to keep school materials organized across many subjects.

Core needs:

- clearer daily view,
- subject-based task tracking,
- and a simple structure that reduces mental overhead.

#### Exam-Focused Student

Uses folders and categorized notes heavily around prelim, midterm, finals, quizzes, and projects.

Core needs:

- folders per grading period or topic,
- quick access to review notes,
- and a timetable view that helps plan study time around classes.

### What the Primary User Wants from Skedue

- A single place to check class schedules.
- A subject-based home for notes and tasks.
- Lightweight organization that does not feel complicated.
- Fast note capture during school hours.
- Confidence that important class information is easy to find later.

### Secondary User: Classmate / Shared-Note Recipient

A secondary user is a classmate who receives a shared note from another student.

This user may:

- open a shared note without being an active Skedue power user,
- use the app mainly when shared content is relevant,
- and decide later whether to become a primary user.

Core needs:

- frictionless access to the shared note,
- readable formatting,
- and clear understanding of what was shared and by whom.

### Secondary User Role in MVP

The secondary user exists mainly to support note sharing.

For MVP, this user does not need deep workspace ownership features such as:

- full shared subject spaces,
- collaborative editing,
- or advanced permissions.

### Future User (Optional, Not MVP)

Possible future roles if the product expands:

- study group leader who organizes shared notes for a class,
- tutor who shares structured review material,
- and student organization or academic team members who coordinate notes and schedules together.

These are not core design targets for MVP and should not shape early product complexity.

### User Boundaries for MVP

The MVP is intentionally designed for students only.

It does not currently target:

- teachers,
- school administrators,
- parents,
- or institution-managed academic workflows.

This keeps the first release focused on personal student productivity instead of becoming a school platform too early.

### User Environment Assumptions

For the first release, assume:

- the user is primarily on mobile,
- the user checks the app in short sessions between classes or while commuting,
- the user values speed more than deep customization,
- and the user is managing personal academic information rather than enterprise or school-wide data.

## 3. Terminology

To keep product language consistent:

- `Subject` refers to a class or course the student is taking.
- `Schedule` refers to the recurring class time connected to a subject.
- `Task` refers to a to-do item connected to a subject.
- `Folder` refers to a note grouping inside a subject.
- `Note` refers to rich-text content created either directly under a subject or inside a folder.
- `Timetable` refers to the visual schedule view across days and times.

## 4. Core Flow (High-Level)

### Student Setup

- Open the app for the first time
- Land on a first-use dashboard experience instead of an empty utility screen
- Start immediately without mandatory account creation
- See guided empty states, onboarding cues, and suggested next actions
- Add semester subjects
- Add meeting days and class times
- Land in a subject-centered workspace

### Local-First Use

- Create and edit subjects, notes, folders, and tasks directly on-device
- Use the app fully without depending on internet connectivity
- Keep the phone as the source of truth for daily academic data
- Optionally use backup and restore for data safety

### Backup and Restore Flow

- Create a manual backup of app data
- Save the backup to a user-controlled destination
- Restore backup data on the same device or a new device when needed
- Confirm whether restore should replace or merge local data if that option exists later

### Daily Schedule Check

- Open the app
- View a dashboard that highlights today's classes, upcoming tasks, and useful empty states when data is still limited
- Switch between today's classes and this week's schedule
- Open the relevant subject from the schedule list
- Use the timetable view when a weekly visual overview is more helpful

### Subject Management

- Create a subject
- Edit subject information
- View subject schedule details
- Archive old subjects when a term ends without deleting their notes and tasks

### Notes and Folder Organization

- Create a note directly inside a subject
- Create folders inside a subject
- Organize notes inside folders such as prelim, midterm, or finals
- Customize folder color for visual organization
- Keep some notes uncategorized when folders are unnecessary

### Task Tracking

- Create to-dos inside a subject
- View pending tasks from subject detail
- Use the subject context to connect each task to a class
- Add due date, due time, and priority when needed

### Event Planning

- Create subject-linked or standalone events in future iterations
- Keep the model ready for calendar-style planning beyond recurring class schedules
- Preserve the distinction between recurring class schedules and one-off events

### Note Sharing

- Select a note
- Export it as text or image
- Share the exported output through other apps or device-native sharing options

## 5. Minimum Viable Features (Current Draft)

### MVP Principle

The MVP should solve the everyday student workflow of checking schedules, opening a subject, writing notes, and tracking tasks without trying to become a full collaboration suite too early.

### Schedule

- Show a first-use dashboard with helpful empty states and next-step guidance
- View schedules filtered by today
- View schedules filtered by this week
- View a timetable of subject schedules

### Subjects

- Create subjects
- Edit subject details
- Save recurring schedule information per subject

### Notes

- Create notes directly inside a subject
- Format note content with basic rich text support

### Folders

- Create folders inside a subject
- Customize folder color
- Create notes inside folders

### Tasks

- Create to-dos inside a subject
- View pending tasks from the subject workspace

### Sharing

- Share notes with other users through a simple sharing flow

## 6. Data Model

### Locked Data Model Direction So Far

The MVP data model should be grouped into these core areas:

- Accounts
- Subjects and schedules
- Notes and folders
- Tasks
- Sharing
- Events and timetable rendering

### Locked Model Decisions

- Notes must support both uncategorized storage and folder-based organization.
- Tasks must support due dates, due times, priority, and status in the MVP.
- Timetable views should be derived from schedule entries instead of stored as a separate source of truth.
- The model should still allow future manual calendar-style entries through a dedicated event entity.
- Sharing should support both app-native account-to-account sharing and export-style sharing of note content.

### Core Entities Agreed So Far

#### users

Base user accounts for students using the product.

#### subjects

Subject records containing title, code, instructor, section, and ownership.

#### subject_schedule_entries

Recurring meeting-day and time records connected to a subject.

This is the main source of truth for recurring class timetable rendering.

#### events

User-owned calendar entries that may be linked to a subject or created independently.

This future-proofs the product for:

- manual events,
- non-class academic schedule items,
- and later calendar expansion beyond recurring subject meetings.

#### folders

Subject-level note containers with customizable color.

#### notes

Note records created under a subject, with optional folder assignment.

Notes should support both models:

- uncategorized notes where `folder_id` is nullable,
- and organized notes that belong to a folder.

#### note_contents

Structured or rich-text note body data.

#### tasks

Subject-linked to-do items with status, due date, due time, and priority.

#### note_shares

Share records connecting a note to another user account for in-app access.

This is the app-native sharing path intended to encourage recipient adoption.

#### note_exports

Export records or export metadata for turning a note into externally shareable output such as text or image.

This supports the second sharing path where the recipient does not need to join the app just to consume the content.

### Relationship Direction So Far

- One `user` owns many `subjects`.
- One `user` owns many `events`.
- One `subject` has many `subject_schedule_entries`.
- One `subject` may also have many `events`.
- One `subject` has many `folders`.
- One `subject` has many `notes`.
- One `subject` has many `tasks`.
- One `folder` belongs to one `subject` and has many `notes`.
- One `note` belongs to one `subject` and may optionally belong to one `folder`.
- One `note` has one current `note_content` record, with room for versioning later if needed.
- One `note` can have many `note_shares`.
- One `note` can have many `note_exports`.

### Timetable Modeling Direction

The timetable should be generated from `subject_schedule_entries` for MVP.

This means:

- recurring classes come from subject schedule records,
- timetable rendering should not require a separate manual timetable table,
- and future calendar expansion can merge schedule-derived classes with `events`.

### Finalized Field-Level Schema: Batch 1

#### users

- `id`: uuid, primary key
- `email`: string, unique, required
- `display_name`: string, required
- `share_handle`: string, unique, nullable
- `avatar_url`: string, nullable
- `timezone`: string, required
- `onboarding_completed_at`: timestamp, nullable
- `created_at`: timestamp, required
- `updated_at`: timestamp, required

Notes:

- `share_handle` gives Skedue a cleaner account-to-account sharing path than relying only on email.
- `timezone` matters for due dates, times, and schedule rendering.

#### subjects

- `id`: uuid, primary key
- `user_id`: uuid, foreign key -> `users.id`, required
- `code`: string, required
- `title`: string, required
- `description`: text, nullable
- `instructor_name`: string, nullable
- `section`: string, nullable
- `color_token`: string, nullable
- `term_label`: string, nullable
- `is_archived`: boolean, required, default `false`
- `archived_at`: timestamp, nullable
- `created_at`: timestamp, required
- `updated_at`: timestamp, required

Notes:

- `code` covers short names like `ITIAS`.
- `title` covers the full subject name.
- `term_label` helps preserve old subjects across semesters later.

#### subject_schedule_entries

- `id`: uuid, primary key
- `subject_id`: uuid, foreign key -> `subjects.id`, required
- `day_of_week`: enum/string, required
- `start_time`: time, required
- `end_time`: time, required
- `location`: string, nullable
- `starts_on`: date, nullable
- `ends_on`: date, nullable
- `is_enabled`: boolean, required, default `true`
- `created_at`: timestamp, required
- `updated_at`: timestamp, required

Notes:

- One subject can have many schedule entries to support multiple meeting days.
- `starts_on` and `ends_on` are optional guards if semester-bounded schedule ranges are needed later.

#### events

- `id`: uuid, primary key
- `user_id`: uuid, foreign key -> `users.id`, required
- `subject_id`: uuid, foreign key -> `subjects.id`, nullable
- `title`: string, required
- `description`: text, nullable
- `event_type`: enum/string, required
- `start_at`: timestamp, required
- `end_at`: timestamp, nullable
- `is_all_day`: boolean, required, default `false`
- `location`: string, nullable
- `created_at`: timestamp, required
- `updated_at`: timestamp, required

Notes:

- `subject_id` is nullable so events can be either subject-linked or standalone.
- `event_type` can later separate manual events, deadline events, and reminder-like entries.

#### folders

- `id`: uuid, primary key
- `subject_id`: uuid, foreign key -> `subjects.id`, required
- `name`: string, required
- `color_token`: string, required
- `sort_order`: integer, nullable
- `created_at`: timestamp, required
- `updated_at`: timestamp, required

Notes:

- `color_token` should map to a controlled preset palette instead of arbitrary hex values in MVP.

#### notes

- `id`: uuid, primary key
- `subject_id`: uuid, foreign key -> `subjects.id`, required
- `folder_id`: uuid, foreign key -> `folders.id`, nullable
- `owner_user_id`: uuid, foreign key -> `users.id`, required
- `title`: string, required
- `preview_text`: text, nullable
- `is_pinned`: boolean, required, default `false`
- `last_edited_at`: timestamp, required
- `created_at`: timestamp, required
- `updated_at`: timestamp, required

Notes:

- `folder_id` being nullable is what enables uncategorized notes.
- `preview_text` helps power note cards, search results, and quick previews.

#### note_contents

- `id`: uuid, primary key
- `note_id`: uuid, foreign key -> `notes.id`, unique, required
- `editor_format`: enum/string, required
- `content_json`: json/jsonb, required
- `plain_text_cache`: text, nullable
- `version_number`: integer, required, default `1`
- `created_at`: timestamp, required
- `updated_at`: timestamp, required

Notes:

- `content_json` is the source of truth for rich-text notes.
- `plain_text_cache` helps search, previews, and text export.
- `version_number` leaves room for future revision history without requiring a full versioning system yet.

#### tasks

- `id`: uuid, primary key
- `subject_id`: uuid, foreign key -> `subjects.id`, required
- `user_id`: uuid, foreign key -> `users.id`, required
- `title`: string, required
- `description`: text, nullable
- `status`: enum/string, required
- `priority`: enum/string, required
- `due_date`: date, nullable
- `due_time`: time, nullable
- `completed_at`: timestamp, nullable
- `created_at`: timestamp, required
- `updated_at`: timestamp, required

Notes:

- `status` should start lightweight, for example `pending` and `completed`.
- `priority` can start with `low`, `medium`, and `high`.
- `due_time` stays optional because not every school task is time-specific.

#### note_shares

- `id`: uuid, primary key
- `note_id`: uuid, foreign key -> `notes.id`, required
- `owner_user_id`: uuid, foreign key -> `users.id`, required
- `recipient_user_id`: uuid, foreign key -> `users.id`, required
- `access_role`: enum/string, required
- `share_status`: enum/string, required
- `shared_at`: timestamp, required
- `accepted_at`: timestamp, nullable
- `revoked_at`: timestamp, nullable

Notes:

- MVP should likely use read-only sharing first.
- `share_status` can support flows like `pending`, `accepted`, and `revoked`.

#### note_exports

- `id`: uuid, primary key
- `note_id`: uuid, foreign key -> `notes.id`, required
- `owner_user_id`: uuid, foreign key -> `users.id`, required
- `export_type`: enum/string, required
- `export_payload_ref`: string, nullable
- `plain_text_snapshot`: text, nullable
- `generated_at`: timestamp, required

Notes:

- `export_type` should start with `text` and `image`.
- This entity can be lightweight if Skedue uses device-native share flows and only needs export metadata rather than permanent hosted files.

### Recommended Constraints and Rules

- A `folder.subject_id` must match the `subject_id` of every note assigned to that folder.
- A user should not be able to create duplicate active shares for the same note-recipient pair.
- `subject_schedule_entries.end_time` must be later than `start_time`.
- `events.end_at` should be later than `start_at` when provided.
- `tasks.completed_at` should only be set when `status` is `completed`.
- `note_contents.note_id` should be unique while Skedue stores only the current version in MVP.

### Locked Follow-Up Decisions

- App-external sharing for the first release should stay limited to export-based sharing such as text and image output.
- `events` should exist in the schema now, even if the product surface for events is introduced later.
- Note revision handling should stay lightweight in MVP through the current `version_number` approach, while keeping the model ready for a future `note_content_versions` expansion if needed.

## 7. UI Sketch

The current direction should cover these main screens and UI states.

### Core MVP Screens

- First-use dashboard / home view
- Home / Today view
- This week schedule view
- All subjects view
- Subject creation flow
- Subject edit flow
- Subject detail / workspace view
- Folder list view inside a subject
- Folder creation modal or sheet
- Folder edit modal or sheet
- Note list view
- Note editor view
- Task creation flow
- Task detail or task edit flow
- Timetable view
- Export note flow
- Settings page
- Backup and restore section inside settings

### Important Empty States

- First launch with no subjects yet
- Subject with no schedule entries yet
- Subject with no notes yet
- Subject with no folders yet
- Subject with no tasks yet
- Timetable with no class data yet
- No backup created yet

### Important Interaction States

- Today filter active
- This week filter active
- All subjects filter active
- Folder color picker open
- Note pinned state
- Task priority states
- Task completed state
- Subject archived state

### Future-Ready Screens

- Event creation flow
- Event detail / edit flow
- Calendar-style event view
- Account onboarding flow
- Restore conflict resolution flow
- Device sync or backup history view

### UI Direction Notes

- The app should feel mobile-first, not like a desktop dashboard squeezed into a phone.
- The home experience should feel useful on day one even before the user has filled in much data.
- Subjects should feel like workspaces, not just list items.
- Notes, folders, and tasks should feel tightly connected to subject context.
- The interface should balance clarity and warmth, avoiding generic productivity-app visuals.
- The visual system should follow the shared design guidance in `docs/design-system.md`.

## 8. Technical Decisions

### Frontend

`React Native` should be the frontend foundation for Skedue.

Recommended direction:

- use React Native for the app itself,
- keep the experience mobile-first from the beginning,
- and avoid designing the MVP around desktop or web assumptions.

Why this direction fits:

- Skedue is primarily a phone-based student utility,
- students will check schedules and notes in short sessions throughout the day,
- and a native-feeling mobile experience matters more than cross-platform breadth in the first release.

### Backend

The MVP should avoid a full cloud backend for core note storage and syncing.

Recommended direction:

- keep the product local-first for MVP,
- avoid mandatory user accounts for the first usable version,
- and postpone cloud sync and account-to-account sharing until after the offline product is strong.

Implications:

- the app should be fully usable without an always-online backend,
- export-based note sharing should replace server-dependent sharing in MVP,
- and future backend work can focus first on backup/restore before live sync.

Future-ready backend path:

- Phase 1: no required backend for daily usage
- Phase 1.5: backup/restore support
- Phase 2: optional account system and cloud sync
- Phase 3: account-to-account note sharing and deeper sync features

### Database

The MVP database should be local on-device storage.

Recommended direction:

- use a local relational database on the device,
- store subjects, schedule entries, folders, notes, note contents, tasks, and events locally,
- and design records with stable IDs and timestamps so future sync is still possible.

Minimum record design principles:

- every major record should have a stable UUID,
- every major record should include `created_at` and `updated_at`,
- soft-deletion support such as `deleted_at` should be considered for future sync safety,
- and note content should be stored in structured form with a plain-text cache for preview, search, and export.

This direction allows:

- full offline use,
- near-zero infrastructure cost for MVP,
- and a cleaner upgrade path toward sync later.

### Storage and Sync Strategy

Skedue should be local-first in MVP.

That means:

- on-device storage is the source of truth,
- the app works offline by default,
- and users should not depend on a network connection to create or access notes, tasks, or schedules.

Sync should not be part of MVP.

Instead, the product should introduce:

- manual export of note content,
- and backup/restore of app data as the safer first protection layer before live sync.

### Backup and Restore

Backup and restore should be included in the product foundation now.

Recommended MVP direction:

- let users create a manual backup of their app data,
- let users restore that backup on the same device or a new device,
- and treat backup/restore as the first data portability feature before cloud sync.

Why this matters:

- it reduces user fear of losing notes,
- it gives practical value without server costs,
- and it is much simpler than solving realtime or multi-device sync early.

### Sharing Approach

MVP sharing should stay export-based.

Recommended direction:

- allow note export as text,
- allow note export as image,
- and avoid public web-link sharing in the first release.

This keeps sharing useful while matching the local-first architecture.

### Notifications

The data model should support due dates and due times now, but reminder delivery can stay minimal in MVP.

Recommended direction:

- support task due dates and times in data,
- prefer local notifications later if reminders are added,
- and avoid building push-notification infrastructure in the first release.

### Client Platforms

The MVP client platforms should be:

- `iOS`
- `Android`

Web should not be a first-release requirement.

This keeps the product aligned with actual student behavior and prevents the MVP from becoming too broad too early.

## 9. Edge Cases

### Schedule and Time Conflicts

- Overlapping classes should be allowed in the data model because students may encode real conflicts, makeup classes, or inaccurate initial setup.
- The timetable should visually show overlaps instead of rejecting them silently.
- One subject may have multiple meeting days and multiple schedule entries without being treated as duplicate data.
- Class schedule changes during the semester should be handled by editing or disabling specific schedule entries instead of forcing full subject recreation.
- If a subject has no active schedule entries, it should still exist as a valid subject workspace for notes and tasks.

### Notes and Folder Structure

- Notes without folders must remain first-class supported behavior, not an incomplete state.
- Empty folders should be allowed because students may create structure before adding notes.
- Moving a note between folders should not break its subject relationship.
- A note should never belong to a folder from a different subject.
- Deleting a folder should require a safe outcome for its notes:
  - move notes to uncategorized
  - or require the user to choose what happens before deletion
- Pinned notes should stay pinned even when moved between folders unless the user explicitly changes that state.

### Local-First Storage and Backup

- The app must remain usable without internet connectivity.
- Unsynced local changes are normal behavior in MVP because cloud sync is intentionally out of scope.
- Backup restore must handle duplicate imports carefully so users do not accidentally clone all subjects, notes, and tasks repeatedly.
- If backup data is older than current device data, the restore flow should warn the user before replacing or merging anything.
- If backup restore fails midway, the app should avoid partial destructive replacement of existing local data.
- Exported note text or images should not be treated as restoreable source-of-truth app data.

### Tasks

- Tasks without due dates should still be valid and visible inside their subject.
- Tasks with due dates but no due time should be supported without forcing artificial time values.
- Completed tasks should remain historically viewable until the user clears or archives them.
- Same-day urgent tasks across multiple subjects should still be understandable in list views without losing subject context.
- If a subject is archived, its tasks should not disappear unexpectedly; they should either archive with the subject or remain accessible through history views.

### Sharing

- In MVP, note sharing should be export-based, so there is no live permission revocation problem for exported text or images.
- Once note content is exported, the user should understand that Skedue cannot revoke copies already shared outside the app.
- Editing a note after export should not retroactively update previously exported text or images.
- If account-to-account sharing is introduced later, it must define whether recipients see live updates or a snapshot.

### Events and Timetable Coexistence

- Recurring class timetable entries should come from `subject_schedule_entries`, while manual calendar items should come from `events`.
- Future event support must not distort the meaning of subject schedules as the source of truth for recurring classes.
- A subject-linked event such as an exam or presentation should be allowed even when it falls outside the subject's normal class hours.
- Standalone events should be allowed without requiring a subject link.

### Subject Lifecycle

- Archiving completed subjects should preserve all notes, folders, schedule history, and tasks unless the user explicitly deletes them.
- Preserving notes from past semesters is important because students may revisit old material for board exams, prerequisites, or portfolio use.
- Reusing the same subject code in a different term should be allowed as long as the subject records remain distinct.
- Archiving a subject should not break exported notes or stored backups.
- Deleting a subject should be treated as a higher-risk action than archiving because it may remove notes, folders, tasks, and schedule data together.

## 10. Phase 2 Ideas

- Shared subject spaces for study groups
- Richer note collaboration
- File attachments inside notes
- Reminders and notifications
- Calendar sync
- Cross-subject search
- AI-assisted note organization or summarization

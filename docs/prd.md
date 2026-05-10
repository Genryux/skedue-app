# Product Requirements Document

## 1. Overview

Skedue is a student productivity app centered on subjects. Its first version should help students manage schedules, subject information, tasks, and notes from one mobile-first interface.

## 2. Goals

### Business goal

Build a focused product foundation for a student super app with a clear MVP that can later expand into deeper collaboration and academic productivity features.

### User goals

- View today's and this week's schedule quickly.
- Keep subject details in one place.
- Create notes and tasks within the context of a subject.
- Organize notes into folders.
- Share notes with classmates when needed.

## 3. Non-Goals For MVP

The MVP should not include:
- real-time collaborative editing,
- chat or messaging,
- AI note generation or summarization,
- complex file attachments,
- desktop-first workflows,
- grading analytics,
- or institution-level admin features.

## 4. User Types

### Student

The core end user who creates subjects, schedules, folders, tasks, and notes.

### Shared-note recipient

A student or classmate who receives access to a shared note.

## 5. Core Features

### 5.1 Schedule and subject views

Users can:
- view subjects filtered by today,
- view subjects filtered by this week,
- and view all subjects in a subject list.

Requirements:
- schedule cards must show subject name, section if available, time, and meeting days,
- users must be able to move from a schedule card into a subject detail view,
- and the app must clearly indicate whether the current filter is today or this week.

### 5.2 Subject creation and management

Users can create a subject with:
- subject code or short name,
- subject title or description,
- instructor name,
- meeting days,
- start time,
- end time.

Requirements:
- one subject can have one or more meeting days,
- schedule data must support recurring weekly sessions,
- and subject editing must be supported after creation.

### 5.3 Subject detail workspace

Each subject should have:
- schedule summary,
- instructor information,
- pending tasks section,
- notes area,
- folder area,
- quick actions for creating tasks, notes, and folders.

### 5.4 Tasks inside a subject

Users can:
- create a task from inside a subject,
- assign title, optional description, due date, due time, and priority,
- and mark tasks by status such as pending or completed.

Requirements:
- task cards must be visible inside the related subject,
- priorities should be lightweight, such as low, medium, and high,
- and overdue or upcoming behavior can be added later if not in MVP.

### 5.5 Notes inside a subject

Users can:
- create notes directly under a subject,
- write formatted text,
- pin important notes,
- and view a subject's notes in a browsable list or grid.

Minimum formatting support for MVP:
- headings,
- bold,
- italic,
- bullets,
- numbered lists,
- checklists,
- simple highlight or color if the editor supports it cleanly.

### 5.6 Folders inside a subject

Users can:
- create folders inside a subject,
- rename folders,
- assign a folder color,
- and place notes inside folders.

Requirements:
- folder color should be a simple preset selection,
- uncategorized notes should still be supported outside folders,
- and folders should be optional, not required.

### 5.7 Schedule timetable

Users can view a timetable representation of their class schedule.

Requirements:
- timetable should visualize recurring class sessions across the week,
- and users should be able to understand time conflicts or gaps at a glance.

### 5.8 Note sharing

Users can share an individual note.

Recommended MVP behavior:
- generate a shareable link or invite flow for read-only access,
- and keep sharing scoped to a single note rather than entire subjects at first.

## 6. Primary User Flows

### Flow A: First-time setup

1. Student opens Skedue.
2. Student creates their first subject.
3. Student enters schedule details.
4. Student saves the subject.
5. Student sees the subject appear in schedule and subject views.

### Flow B: Daily schedule check

1. Student opens home.
2. Student views today's classes.
3. Student taps a subject.
4. Student reviews pending tasks and notes for that class.

### Flow C: Organizing notes by academic period

1. Student opens a subject.
2. Student creates folders such as Prelim, Midterm, and Finals.
3. Student selects a folder color.
4. Student creates notes inside the chosen folder.

### Flow D: Creating a task during class

1. Student opens the active subject.
2. Student taps add task.
3. Student enters task details and priority.
4. Student saves.
5. Task appears in that subject's pending task list.

### Flow E: Sharing a note

1. Student opens a note.
2. Student taps share.
3. Student generates a link or sends an invite.
4. Recipient opens the shared note in read-only mode.

## 7. Functional Requirements

### Subject domain

- The system must allow subject creation, editing, and deletion.
- The system must store recurring weekly schedule metadata per subject.
- The system must support multiple meeting days per subject.

### Task domain

- The system must allow task creation under a subject.
- The system must support task status and priority.
- The system must allow filtering or separating pending tasks from completed ones in later iterations.

### Folder domain

- The system must allow folder creation within a subject.
- The system must store a folder color choice.
- The system must allow notes to exist inside or outside folders.

### Note domain

- The system must allow rich-text note creation and editing.
- The system must support note pinning.
- The system must support note sharing for individual notes.

### Schedule domain

- The system must support today and week filtering.
- The system must support a timetable view.

## 8. Non-Functional Requirements

- Mobile-first responsive design.
- Fast load for schedule and subject lists.
- Reliable local state handling for note editing drafts.
- Clean information hierarchy for quick scanning.
- Privacy-first sharing model with explicit user action.

## 9. Risks and Product Decisions To Resolve Early

### Rich-text editor choice

The note editor can heavily affect complexity, mobile usability, and data modeling. This should be chosen before implementation starts.

### Sharing model

Decide whether shared notes require accounts, public links, or invite-only access.

### Offline behavior

If students are expected to use Skedue in class with unstable internet, offline-friendly note drafts should be considered early.

### Subject recurrence model

The data model should support subjects meeting on multiple days without becoming hard to query for today and weekly views.

## 10. MVP Recommendation

The MVP should include:
- subject creation and schedule setup,
- today and this week schedule views,
- subject detail page,
- subject tasks,
- folders with color selection,
- rich-text notes,
- timetable view,
- and basic note sharing.

If scope needs to tighten further, the first feature to defer should be sharing, followed by advanced formatting options.

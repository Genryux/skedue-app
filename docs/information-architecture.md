# Information Architecture

## App Structure

Skedue should be organized around four primary product areas:
- Home
- Subjects
- Timetable
- Profile or Settings

## Recommended Navigation Model

### Bottom navigation

- Home
- Subjects
- Timetable
- Settings

This keeps the core areas visible and matches the mobile direction shown in the mockups.

## Screen Map

### 1. Home

Purpose:
Provide quick access to schedule context for today or this week.

Main content:
- current filter switcher,
- today's or weekly class cards,
- quick access to the next class,
- optional summary of upcoming tasks in a later iteration.

### 2. Subjects list

Purpose:
Show all created subjects and provide subject creation access.

Main content:
- filter or sort controls,
- subject cards,
- add subject action.

### 3. Create subject

Purpose:
Capture subject metadata and recurring schedule information.

Form sections:
- subject information,
- day selection,
- time selection.

### 4. Subject detail

Purpose:
Serve as the main workspace for a single class.

Main content:
- subject title and metadata,
- schedule summary,
- instructor information,
- pending tasks preview,
- quick actions to add task, note, or folder.

### 5. Subject notes space

Purpose:
Allow students to manage folders and uncategorized notes within the subject.

Main content:
- folders section,
- uncategorized notes section,
- add note and add folder actions.

### 6. Folder view

Purpose:
Display notes within a specific folder.

Main content:
- search,
- pinned notes,
- other notes,
- view toggle if needed later.

### 7. Note editor

Purpose:
Create and edit rich-text notes.

Main content:
- note title,
- formatting controls,
- content area,
- share action,
- pin action.

### 8. Task create or edit

Purpose:
Create and maintain subject-linked tasks.

Main content:
- title,
- description,
- due date,
- due time,
- priority,
- status.

### 9. Timetable

Purpose:
Visualize the student's weekly schedule in a time-grid format.

Main content:
- weekday columns,
- time rows,
- subject blocks,
- potential conflict visibility.

## Data Hierarchy

The core content relationship should be:

User
-> Subjects
-> Subject schedules
-> Subject tasks
-> Subject folders
-> Notes

Notes should support two valid locations:
- directly under a subject,
- or inside a subject folder.

## Recommended Core Entities

### User

- id
- displayName
- email
- avatarUrl

### Subject

- id
- code
- title
- description
- instructorName
- color or accent in a later iteration
- createdAt
- updatedAt

### SubjectSchedule

- id
- subjectId
- dayOfWeek
- startTime
- endTime

### Task

- id
- subjectId
- title
- description
- dueAt
- priority
- status

### Folder

- id
- subjectId
- name
- color

### Note

- id
- subjectId
- folderId nullable
- title
- content
- contentFormat
- isPinned
- shareVisibility
- createdAt
- updatedAt

## Recommended Permissions Model For Early Versions

### Owner

Full control over subjects, folders, notes, and tasks.

### Shared note viewer

Read-only access to a single shared note.

This keeps authorization simple for the MVP and avoids overcomplicating subject-level collaboration too early.

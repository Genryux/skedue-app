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

The main user who manages subjects, class schedules, notes, folders, and academic tasks.

### Secondary User: Classmate / Shared-Note Recipient

A student who receives a shared note from another student.

### Future User (Optional, Not MVP)

Possible future roles such as group leaders, tutors, or academic organizations if collaboration expands later.

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

- Create an account
- Add semester subjects
- Add meeting days and class times
- Start using each subject as a workspace

### Daily Schedule Check

- Open the app
- View today's classes or this week's schedule
- Open the relevant subject from the schedule list

### Subject Management

- Create a subject
- Edit subject information
- View subject schedule details

### Notes and Folder Organization

- Create a note directly inside a subject
- Create folders inside a subject
- Organize notes inside folders such as prelim, midterm, or finals
- Customize folder color for visual organization

### Task Tracking

- Create to-dos inside a subject
- View pending tasks from subject detail
- Use the subject context to connect each task to a class

### Note Sharing

- Select a note
- Share it with a classmate
- Let the recipient open the shared note through an accessible share flow

## 5. Minimum Viable Features (Current Draft)

### MVP Principle

The MVP should solve the everyday student workflow of checking schedules, opening a subject, writing notes, and tracking tasks without trying to become a full collaboration suite too early.

### Schedule

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

### Core Entities Agreed So Far

#### users

Base user accounts for students using the product.

#### subjects

Subject records containing title, code, instructor, section, and ownership.

#### subject_schedule_entries

Recurring meeting-day and time records connected to a subject.

#### folders

Subject-level note containers with customizable color.

#### notes

Note records created either directly under a subject or inside a folder.

#### note_contents

Structured or rich-text note body data.

#### tasks

Subject-linked to-do items with status and optional due date or priority.

#### note_shares

Share records connecting a note to recipients or a share link.

### Notes Still Open for Discussion

- Whether notes should support both uncategorized and folder-based storage at launch
- Whether note sharing is account-to-account only or also link-based
- Whether tasks need due dates, priorities, and reminders in the MVP
- Whether timetable data should be derived from schedule entries or stored separately

## 7. UI Sketch

The current direction should cover these main screens:

- Home / Today view
- This week schedule view
- Subject list view
- Add subject flow
- Subject detail view
- Folder list view inside a subject
- Note list and note editor view
- Timetable view
- Note sharing entry point

## 8. Technical Decisions

### Frontend

TBD

### Backend

TBD

### Database

TBD

### Client Platforms

TBD

## 9. Edge Cases

### Schedule and Time Conflicts

- Overlapping classes
- Subjects with multiple meeting days
- Class schedule changes during the semester

### Notes and Folder Structure

- Notes without folders
- Empty folders
- Moving notes between folders

### Tasks

- Tasks without due dates
- Completed versus archived tasks
- Same-day urgent tasks across multiple subjects

### Sharing

- Revoking access to shared notes
- Editing a note after it has been shared
- Recipient access when they do not yet have an account

### Subject Lifecycle

- Archiving completed subjects
- Preserving notes from past semesters
- Reusing the same subject code in a different term

## 10. Phase 2 Ideas

- Shared subject spaces for study groups
- Richer note collaboration
- File attachments inside notes
- Reminders and notifications
- Calendar sync
- Cross-subject search
- AI-assisted note organization or summarization

# Skedue UI Prompt Pack for Google Stitch

Use this document as the shared prompt foundation for generating Skedue screens in Google Stitch.

The goal is to keep all mockups visually consistent while still letting each screen solve a different product problem.

Before generating or refining screens, also refer to `docs/design-system.md` so the palette and component language stay aligned with the app's source-of-truth visual system.

## 1. Master Product Prompt

Product: Skedue, a mobile-first student productivity app for managing subjects, schedules, notes, folders, tasks, and future academic events in one place.

Design style:
- polished modern mobile productivity app
- student-focused, organized, and warm
- refined academic color palette
- light mode only
- strong visual hierarchy
- rounded cards, sheets, and surfaces
- soft borders and subtle depth
- realistic academic labels and data
- avoid generic AI-looking UI
- avoid desktop dashboard patterns forced into mobile
- keep the interface intentional, clean, and slightly premium
- mobile-first responsive layout
- designed primarily for React Native app screens
- use a custom dock-style bottom navigation instead of a traditional mobile tab bar

Product UX direction:
- the experience should feel useful even on first launch
- the app should not feel empty or intimidating when the user has not added much data yet
- subjects are the main organizing unit of the product
- notes, folders, tasks, and schedules should feel tightly connected to each subject
- the app should support local-first usage, so the interface should not depend on cloud or multi-user behavior
- export-based sharing should feel practical and simple

Visual direction:
- use a clean academic aesthetic with strong spacing and careful typography
- use Manrope as the default typeface
- make cards feel tactile and easy to scan
- use color intentionally for folders, schedule states, task priority, and navigation emphasis
- prefer a grounded palette over loud startup colors
- the design should feel custom and product-specific, not template-based
- navigation should feel distinctive, soft, and product-branded rather than system-default

Output:
- produce a polished high-fidelity mobile app mockup
- show realistic sample data
- keep labels specific to student life
- keep spacing, hierarchy, and components consistent with other Skedue screens

## 2. Full Screen Inventory

Lay out these pages and states across the UI exploration:

### Core MVP Screens

- First-use dashboard / home view
- Today schedule view
- This week schedule view
- All subjects view
- Subject creation screen
- Subject edit screen
- Subject detail / workspace screen
- Folder list inside a subject
- Create folder modal or bottom sheet
- Edit folder modal or bottom sheet
- Notes list inside a subject
- Note editor screen
- Create task flow
- Edit task flow
- Timetable view
- Note export / share flow
- Settings screen
- Backup and restore section inside settings
- Archive subject confirmation flow

### Supporting States

- Empty dashboard state
- Empty subject state
- Empty note state
- Empty folder state
- Empty task state
- Empty timetable state
- Backup not yet created state
- Theme preference state
- Export success state

### Future-Ready Exploration Screens

- Event creation screen
- Event detail screen
- Calendar or event planning screen
- Restore conflict warning screen
- Optional future account onboarding screen

## 3. Shared Design Constraints

Apply these constraints to every page prompt:

- mobile portrait layout
- use a custom bottom navigation dock, not a standard iOS or Android tab bar
- minimal but intentional icon usage
- cards should be readable at a glance
- avoid clutter and over-decoration
- every screen should have one clear primary action
- empty states should feel encouraging, not dead
- data density should feel useful but not cramped

### Bottom Navigation Pattern

Use this navigation approach across the app:

- a floating rounded dock near the bottom of the screen
- a soft pill-shaped navigation container
- 3 to 4 main destinations inside the dock
- one active destination shown as a filled pill inside the dock
- a separate prominent action button attached to or slightly offset from the dock
- the action button should feel integrated with the navigation system, not like a generic floating action button
- icons should be simple and clean
- labels may be shown when useful, especially for the active tab

Skedue navigation direction:

- avoid the traditional flat tab bar look
- make the nav feel modern, calm, and premium
- the dock should visually match the rest of the card system
- the primary action button can be used for fast creation, such as add subject, add note, or add task depending on the current screen

## 4. Page Prompts

Use the master product prompt above, then pair it with one of the page prompts below.

### A. First-Use Dashboard / Home View

Page: First-Use Dashboard

Goal:
Design the first-use home screen for Skedue. This screen should feel helpful and motivating even before the student has added much data.

Required sections:
- top header with greeting or dashboard title
- quick summary of today
- empty-state card for no subjects yet
- suggested next actions
- shortcut cards for add subject, create first note, and explore timetable
- custom dock-style bottom navigation

Suggested content:
- friendly onboarding empty state
- short explanation of what Skedue helps manage
- clear add subject primary action
- soft preview cards for schedules, tasks, and notes

UX notes:
- this should not feel like a blank app
- it should gently teach the product structure
- it should balance onboarding and immediate usefulness

Output:
- produce a polished high-fidelity First-Use Dashboard mockup

### B. Today Dashboard

Page: Today Dashboard

Goal:
Design the main daily dashboard for a student who already has subjects and tasks set up.

Required sections:
- top header
- today filter or date switcher
- today's classes list
- upcoming tasks panel
- quick notes or pinned notes preview
- custom dock-style bottom navigation

Suggested content:
- subject cards with time ranges and meeting info
- task cards with due times and priority
- one or two pinned note previews

UX notes:
- this page should feel like the student's daily control center
- it should help the user decide what to do next quickly

Output:
- produce a polished high-fidelity Today Dashboard mockup

### C. This Week Schedule View

Page: This Week Schedule

Goal:
Design a weekly subject schedule screen that helps students scan upcoming classes quickly.

Required sections:
- page header
- filter or segmented control for today / week / all subjects
- weekly class list or grouped daily schedule sections
- obvious entry into timetable view
- custom dock-style bottom navigation

Suggested content:
- grouped schedule cards by weekday
- realistic subject names and times
- clear day separators

UX notes:
- the page should feel structured and easy to scan
- it should complement, not replace, the timetable view

Output:
- produce a polished high-fidelity This Week Schedule mockup

### D. All Subjects View

Page: All Subjects

Goal:
Design a subject browsing screen where the student can view all current subjects and jump into each workspace.

Required sections:
- page header
- subject filter or sort control
- subject cards
- floating action button or primary add action
- custom dock-style bottom navigation

Suggested content:
- subject code
- full subject title
- instructor
- meeting days
- schedule time

UX notes:
- subject cards should feel rich and useful, not generic list rows
- each subject should feel like a workspace the user can enter

Output:
- produce a polished high-fidelity All Subjects mockup

### E. Subject Creation Screen

Page: Add Subject

Goal:
Design a subject creation screen where students can add a class with recurring schedule information.

Required sections:
- page header
- subject information fields
- meeting-day selection
- time range input
- optional instructor and section fields
- clear save action

Suggested content:
- subject code
- full subject title
- instructor
- section
- weekdays
- start and end time

UX notes:
- this should feel fast to complete on mobile
- the layout should reduce form fatigue

Output:
- produce a polished high-fidelity Add Subject screen mockup

### F. Subject Detail / Workspace

Page: Subject Workspace

Goal:
Design the main subject workspace where schedule, tasks, folders, and notes all connect.

Required sections:
- page header with subject title
- subject info summary
- pending tasks section
- folders section
- uncategorized notes section
- primary action for new note, folder, or task
- custom dock-style bottom navigation

Suggested content:
- subject code and full title
- instructor and schedule chips
- task cards with priority
- colorful folder cards
- note preview cards

UX notes:
- this is one of the most important screens in the app
- it should make the subject feel like a command center

Output:
- produce a polished high-fidelity Subject Workspace mockup

### G. Folder List in Subject

Page: Subject Folders

Goal:
Design a folder-focused subject screen that helps students organize notes by exam period, topic, or unit.

Required sections:
- subject context header
- colorful folder cards
- uncategorized notes preview
- add folder action
- custom dock-style bottom navigation

Suggested content:
- folders such as Prelim, Midterm, Finals, Projects
- folder note counts
- preview of uncategorized notes below folders

UX notes:
- folders should feel visual and memorable
- color should help organization without becoming chaotic

Output:
- produce a polished high-fidelity Subject Folders mockup

### H. Create or Edit Folder Sheet

Page: Create Folder

Goal:
Design a compact mobile modal or bottom sheet for creating or editing a folder.

Required sections:
- folder name input
- color selection palette
- primary save action
- optional delete action in edit mode

Suggested content:
- simple preset palette
- short helper text

UX notes:
- this should feel lightweight and fast
- color selection should be visually pleasant and easy to understand

Output:
- produce a polished high-fidelity Create Folder sheet mockup

### I. Notes List View

Page: Notes List

Goal:
Design a subject note browser that supports pinned and regular notes clearly.

Required sections:
- page header
- search field
- pinned notes section
- all other notes section
- add note action

Suggested content:
- note title
- preview text
- small subject or folder tags when relevant
- realistic note snippets

UX notes:
- this should feel like a useful study archive
- prioritize clarity and scanability

Output:
- produce a polished high-fidelity Notes List mockup

### J. Note Editor

Page: Note Editor

Goal:
Design the main note editor for Skedue with lightweight rich text support.

Required sections:
- page header
- note title input
- formatting toolbar
- note body editor
- subject or folder context indicator
- export or share action

Suggested content:
- realistic lecture or review note content
- headings, bullets, emphasis, and checklist examples

UX notes:
- the editor should feel focused and not overwhelming
- it should look better than a plain text field, but not like a heavy desktop document editor

Output:
- produce a polished high-fidelity Note Editor mockup

### K. Task Creation or Edit Flow

Page: Create Task

Goal:
Design a mobile task creation screen inside a subject context.

Required sections:
- page header
- title field
- description field
- due date picker
- due time picker
- priority selector
- status selector if editing
- save action

Suggested content:
- realistic school tasks such as quiz review, lab submission, or project presentation

UX notes:
- the form should feel lightweight and fast
- task priority should be visible but not overly dramatic

Output:
- produce a polished high-fidelity Create Task mockup

### L. Timetable View

Page: Timetable

Goal:
Design a weekly timetable view for recurring class schedules.

Required sections:
- page header
- week context or filter
- timetable grid
- class blocks by time and day
- clear return path to subject or schedule views
- custom dock-style bottom navigation

Suggested content:
- realistic weekday class blocks
- visually distinct subject colors
- readable time labels

UX notes:
- this should feel like a real student timetable, not a generic calendar
- readability is more important than flashy visuals

Output:
- produce a polished high-fidelity Timetable mockup

### M. Note Export or Share Flow

Page: Export Note

Goal:
Design a note export flow for a local-first app that shares content without cloud accounts.

Required sections:
- page header
- selected note preview
- export options for text and image
- destination or share action area
- confirmation state

Suggested content:
- preview of note title and excerpt
- segmented control or card options for export type

UX notes:
- this should feel practical and clean
- the user should understand they are exporting a copy, not sharing a live synced document

Output:
- produce a polished high-fidelity Export Note mockup

### N. Settings Page

Page: Settings

Goal:
Design a polished settings screen for Skedue that contains app-level preferences, data controls, and product information in one organized mobile page.

Required sections:
- page header
- profile or identity area if appropriate for a local-first app
- appearance section with light mode and dark mode options
- backup and restore section
- app preferences section
- about or app information section
- clear destructive or high-risk actions separated visually
- custom dock-style bottom navigation if settings belongs to the main app shell

Suggested content:
- theme mode toggle or selection cards
- backup status or last backup date
- create backup action
- restore backup action
- export or data portability helper copy
- app version
- support or feedback entry

UX notes:
- this page should feel trustworthy, organized, and calm
- backup and restore are high-stakes actions, so they should be visually clear and not buried
- the appearance section should feel polished, not like a developer settings page
- settings should still feel consistent with the rest of the product's card system

Output:
- produce a polished high-fidelity Settings page mockup

### O. Backup and Restore Section Detail

Page: Backup and Restore Detail

Goal:
Design a focused backup and restore section or subpage for Skedue that supports manual data protection in a local-first app.

Required sections:
- section or subpage header
- explanation of what backup includes
- create backup action
- restore backup action
- backup status or last backup information
- restore warning area

Suggested content:
- last backup date and time
- data included in backup such as subjects, notes, tasks, folders, and schedules
- careful copy explaining that restore may replace or merge local data depending on the chosen behavior

UX notes:
- this should feel safe and trustworthy
- clarity is more important than visual complexity
- the user should understand that backup is different from cloud sync

Output:
- produce a polished high-fidelity Backup and Restore detail mockup

## 5. Prompting Strategy

Do not prompt Stitch with every screen at once.

Recommended order:

1. First-Use Dashboard
2. Today Dashboard
3. Subject Workspace
4. Add Subject
5. Subject Folders
6. Notes List
7. Note Editor
8. Create Task
9. Timetable
10. Export Note
11. Settings
12. Backup and Restore section if explored separately

This order helps establish the design language on the highest-value screens first.

## 6. Reusable Navigation Add-On

Append this block to any Stitch page prompt when you want to strongly reinforce the navigation style:

Navigation style:
- use a floating bottom dock navigation inspired by a soft segmented control
- avoid a traditional full-width tab bar
- use a dark or tinted rounded dock with soft depth
- show the active destination inside a highlighted inner pill
- place a separate rounded primary action button beside or partially attached to the dock
- keep the dock compact, premium, and visually calm
- make the navigation feel like a custom product signature element

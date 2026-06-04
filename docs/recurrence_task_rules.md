# Recurring Task Rules

## Core

Each recurring task has:

```text
task
next_occurrence_date
task_completions
```

Only **one actionable occurrence** exists at a time.

Future occurrences are generated only for calendar display.

---

# Overdue

Show when:

```text
next_occurrence_date < today
```

Rules:

* Can be completed.
* Completing inserts completion record.
* Advance to next occurrence.
* Task moves to Today if next occurrence is today, otherwise Future.

Edge case:

```text
Missed 5 days
```

Still show only **one overdue task**, not 5 separate entries.

---

# Today

Show when:

```text
next_occurrence_date = today
AND not completed
```

Rules:

* Can be completed.
* Completing inserts completion record.
* Advance to next occurrence.
* Current occurrence appears in Completed.
* Next occurrence appears in Future.

Edge case:

```text
Due later today (8 PM)
Current time (8 AM)
```

Still belongs to Today.

---

# Future

Show when:

```text
next_occurrence_date > today
```

Rules:

* Read-only.
* Cannot be completed.
* Cannot be checked.
* Automatically moves to Today when date arrives.

---

# Completed

Show from:

```text
task_completions
```

Rules:

* Display completed occurrences.
* Undo only allowed if completion happened today.
* Undo removes completion record.
* Task returns to Today.

No undo after the day changes.

---

# Calendar

Generate occurrences dynamically.

Example:

```text
Daily Task

Jun 4
Jun 5
Jun 6
Jun 7
```

Rules:

* Overdue occurrence → can complete.
* Today's occurrence → can complete.
* Future occurrence → view only, cannot complete.

---

# Completion Flow

When completing:

```text
1. Insert task_completion
2. Calculate next occurrence
3. Update next_occurrence_date
4. Reschedule reminder
```

Example:

```text
Current:
Jun 4

Complete:
Jun 4

Advance:
Jun 5
```

---

# Expected Flow

### Created today

```text
Today
 └ Review Notes
```

Complete:

```text
Completed
 └ Review Notes (Jun 4)

Future
 └ Review Notes (Jun 5)
```

### Missed yesterday

```text
Jun 4 missed
Current date: Jun 5
```

Result:

```text
Overdue
 └ Review Notes
```

Complete:

```text
Completed
 └ Jun 4

Today
 └ Jun 5
```

---

# Validation Checklist

* One actionable occurrence per recurring task.
* Overdue shows once regardless of missed count.
* Future tasks cannot be completed.
* Completing advances `next_occurrence_date`.
* Calendar shows all occurrences.
* Task list never shows generated future occurrences.
* Home, Subject Tasks, and Tasks screens follow the same rules.

```
```

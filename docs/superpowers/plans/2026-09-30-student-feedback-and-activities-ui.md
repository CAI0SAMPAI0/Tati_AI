# Student Feedback Replies & Activities UI Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full feedback cycle (push notification, email with summary, student profile tab for Tatiana's replies) and fix `/activities` topbar stickiness with a scroll-to-top button.

**Architecture:** 
- Backend: Django Ninja endpoint `GET /activities/my-feedbacks` for authenticated students to view their feedback history. In `StudentFeedbackService.update_feedback`, trigger Push (`NotificationDispatcher`), Email (`BrevoEmailService`), and in-app Notification when `teacher_reply` is added/updated.
- Frontend: Add `'feedbacks'` ("Respostas da Tatiana") tab in `/profile` with `?tab=feedbacks` query param support. Fix CSS stacking/clipping context in `/activities` so `MainHeader` stays sticky at top, and add a bottom-right floating scroll-to-top button.
- Verification: Automated Django tests + Playwright script on localhost:3000 / localhost:8000.

**Tech Stack:** Django Ninja, Python, Next.js 14, Tailwind CSS, TypeScript, Playwright.

**Spec:** Conversational design approved by user on 2026-09-30 (Módulo 1).

## Global Constraints
- Do not break existing `/dashboard/feedbacks` staff endpoints.
- Student endpoint `GET /activities/my-feedbacks` must only return feedbacks matching the authenticated user.
- Ensure all notification dispatches handle errors gracefully without failing the PATCH request.
- Keep UI consistent with existing Tailwind design system (rounded-3xl, bg-surface, text-text, primary accents).

## Review Focus
- Unauthenticated access to `my-feedbacks` should return 401 Unauthorized.
- Feedback reply to a student without registered device tokens should still succeed (graceful fallback).
- Tab deep link `/profile?tab=feedbacks` must work on initial load and when navigating from notifications.
- Scroll-to-top button must only show after scrolling down and disappear at the top.

---

### Task 1: Backend `my-feedbacks` Endpoint & Notification Dispatch on Reply

**Files:**
- Modify: `backend/apps/activities/services.py`
- Modify: `backend/apps/activities/api.py`
- Test: `backend/apps/activities/tests_feedback.py`

**Interfaces:**
- Produces: `GET /activities/my-feedbacks` -> `List[StudentFeedbackOut]`
- Produces: `StudentFeedbackService.list_student_feedbacks(username: str) -> List[dict]`
- Modifies: `StudentFeedbackService.update_feedback(feedback_id: str, updates: dict)` to dispatch push, email, and in-app notifications.

- [ ] **Step 1: Write tests for `my-feedbacks` and reply notification dispatch**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement `list_student_feedbacks` and notification dispatch in `services.py` & `api.py`**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit changes**

---

### Task 2: Frontend Profile Page: "Respostas da Tatiana" Tab

**Files:**
- Modify: `frontend/app/(authenticated)/profile/profile-client-page.tsx`

**Interfaces:**
- Consumes: `GET /activities/my-feedbacks`
- Modifies: `TABS` array to include `'feedbacks'`, handles `?tab=feedbacks` URL query parameter.

- [ ] **Step 1: Add `'feedbacks'` tab definition and query param handling**
- [ ] **Step 2: Implement feedback history list with pending/reviewed states and teacher reply card**
- [ ] **Step 3: Verify TypeScript compilation (`npx tsc --noEmit`)**
- [ ] **Step 4: Commit changes**

---

### Task 3: Frontend `/activities` Page: Sticky Topbar & Floating Scroll-to-Top Button

**Files:**
- Modify: `frontend/app/(authenticated)/activities/activities-client-page.tsx`

**Interfaces:**
- Modifies: Layout wrapper to ensure `MainHeader` remains sticky on scroll.
- Produces: Floating scroll-to-top button at `fixed bottom-6 right-6 z-40`.

- [ ] **Step 1: Remove clipping context on parent container to guarantee sticky topbar**
- [ ] **Step 2: Implement floating scroll-to-top button with smooth scroll behavior**
- [ ] **Step 3: Verify TypeScript compilation (`npx tsc --noEmit`)**
- [ ] **Step 4: Commit changes**

---

### Task 4: Playwright End-to-End Verification

**Files:**
- Create: `tests/e2e/test_feedback_and_activities.spec.ts` (or runner script)

- [ ] **Step 1: Create Playwright test script covering sticky topbar, scroll-to-top, and profile feedback tab**
- [ ] **Step 2: Execute Playwright script against running localhost instances**
- [ ] **Step 3: Verify all assertions pass and capture screenshots**
- [ ] **Step 4: Commit test artifacts**

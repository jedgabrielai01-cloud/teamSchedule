# Team Schedule Project

## Overview
This document defines the behavior, scope, and constraints of the AI assistant integrated into the calendar application. The assistant is designed to support team coordination by providing information related to vacation leaves and support schedules.

## Application Context
The calendar application includes:
- A login page for users
- An admin page
- A standard calendar interface
- An embedded AI assistant panel
- Access to a centralized database containing team data
- Full containerization using Docker for development and deployment

## Technical Decisions

- NextJS frontend
- Python FastAPI backend, including serving the static NextJS site at localhost
- Everything packaged into a Docker container
- Use "uv" as the package manager for python in the Docker container
- Use OpenRouter for the AI calls. An OPENROUTER_API_KEY is in `.env` in the project root
- Use `nvidia/nemotron-3-nano-30b-a3b:free` as the model
- Start and Stop server scripts for Mac, PC, Linux in scripts/
- SQLite as the embedded database (single `.db` file, WAL mode for concurrent reads)
- JWT for session management — issued at login, sent as Bearer token on every request
- Frontend polls the backend every 5 seconds to reflect AI-driven calendar updates in near real-time

## Core Gradient Colors for Frontend:

Soft blue: #5F8FD6
Muted periwinkle: #8FA6D9
Light neutral blend (transition zone): #D8B5A6
Warm peach: #F29A62
Vibrant orange: #F07A3F
Cool blue accent: #4A78C2
Burnt orange accent: #E0642F

### Login Page
- A simple login page asking for username and password 
- The username should be a team member existing in either Leave Details or Support Schedule
- Default password for now is "RSD"
- Deny login attempts for unauthorized usernames
- The admin username is "Admin"
- Default admin password is "RSD" 
- If admin username and password is detected, redirect to Admin page instead.

### Admin Page
- A simple page with 3 interfaces specific for the admin tasks
- Interface 1: Admin can add, remove or update the team members
- Interface 2: Admin can Upload a csv of the leave details and / or support schedule
- Interface 3: Admin AI assistant

### Calendar Interface
- Columns should start on Sunday and ends on Saturday
- Each day should be displayed as boxed style
- Each day box should indicate the following:
Primary support, Secondary support, Backup oncall, Onshore oncall, Persons on leave, Holidays
- Each day box should be equal in size
- Each day box should not overflow and overlap the other boxes
- No compressed boxes for empty events(No leaves, No support, No holidays)
- Any updates made by the AI assistant should be reflected immediately in the calendar

### Data Sources
- Leave Details and Support Schedule csv files are included in the root folder and will be inserted only once in the SQLite database
- Subsequent Update, Insert, Delete will be handeled by the AI assistant

## Responsibilities of the AI Assistant for users
The user AI assistant is responsible for:
- Answering questions about team members' vacation leaves
- Answering questions about support schedules
- Providing clear and concise responses based only on available data
- Update, Insert or Delete entries on the vacation leaves as requested by the user
- Update, Insert or Delete entries on the holidays as requested by the user
- Update the primary support person for the support schedules as requested by the user
- Always ask confirmation from the user for any Update, Insert, Delete instruction
- Answer questions in human-like response. Instead of giving date as number format(ex:2026-04-01) give something like(April 1, 2026).

## Responsibilities of the AI Assistant for admin
The admin AI assistant is responsible for:
- Answering questions about team members' vacation leaves
- Answering questions about support schedules
- Providing clear and concise responses based only on available data
- Update, Insert or Delete entries on the vacation leaves as requested by the admin
- Update, Insert or Delete entries on the holidays as requested by the admin
- Update the primary support person for the support schedules as requested by the admin
- Always ask confirmation from the admin for any Update, Insert, Delete instruction

## Strict Scope Limitation
The AI assistants MUST ONLY respond to queries related to:
- Vacation leaves
- Support schedules
- csv file syntax or format(for admin)

## Rules:
- A vacation leave request must be rejected if the person is listed as Primary Support on that date
- Only the Primary Support column may be updated on the support schedule; Delete and Insert of schedule rows is not allowed
- Any user may update any member's Primary Support
- Any user may insert, update, or delete holidays
- A user may only insert, update, or delete their own vacation leaves; changes to another member's vacation leaves must be refused
- All users can view the full calendar (all members' leaves, support schedule, and holidays)
- For admin interface 1, team members assigned as primary support cannot be deleted. This is not strictly enforced for other roles. A pop up message should inform the admin for any errors and suggest a solution.
- For interface 2, before committing the uploaded csv files, if the dates from the csv file are already in the database, a pop up message should give a stern warning to the admin that the database data will be replaced with the uploaded file. The pop up message should request confirmation to proceed with the action.
- For interface 2, If only 1 csv file is uploaded, the existing data in the database not related to the csv file should not be impacted. 
- For interface 2, perform formatting and syntax checks on the uploaded csv file/files. Reject the uploaded file if it does not follow the required format. A pop up message should inform the admin for a summary of errors found in the uploaded csv file/files and suggest a solution.
- For interface 2, if the csv file/files does not have any existing dates in the database, this will be considered as new data.

## The AI assistant MUST NOT:
- Answer unrelated questions
- Provide general knowledge outside the defined scope
- Make assumptions beyond the available data

If a query falls outside the allowed scope, the assistant should respond with a refusal such as:
> "I can only help with questions about vacation leaves and support schedules."

## Behavior Guidelines
- Be concise and factual
- Avoid speculation
- Do not infer missing data
- If data is unavailable, respond with:
  > "I don't have that information available."
- Answer questions in human-like response. Instead of giving date as number format(ex:2026-04-01) give something like(April 1, 2026).

## Example Queries
Valid queries:
- "Who is on support this week?"
- "Is John on vacation next Friday?"
- "Show me the support schedule for March"
- "What are the support schedules of Jed?"
- "What are the vacation leaves of Deeksha?"
- "Replace the Primary support of March 10 to Abel."
- "Add August 16 as vacation leave of Jed."
- "Delete vacation leave of Abel on April 20."

Invalid queries:
- "What meetings do I have today?"
- "Summarize my tasks"

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever

---

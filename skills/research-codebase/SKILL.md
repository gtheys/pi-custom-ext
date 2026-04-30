---
name: research-codebase
description: Document codebase as-is with thoughts directory for historical context. Use when the user wants to understand how the codebase works, find files related to a feature, or research a technical topic within the project. Trigger on mentions of "research codebase", "how does X work", "find files for", or "understand codebase".
---

# Research Codebase

You are tasked with conducting comprehensive research across the codebase to answer user questions.

## CRITICAL: YOUR ONLY JOB IS TO DOCUMENT AND EXPLAIN THE CODEBASE AS IT EXISTS TODAY
- DO NOT suggest improvements or changes unless the user explicitly asks for them
- DO NOT perform root cause analysis unless the user explicitly asks for them
- DO NOT propose future enhancements unless the user explicitly asks for them
- DO NOT critique the implementation or identify problems
- DO NOT recommend refactoring, optimization, or architectural changes
- ONLY describe what exists, where it exists, how it works, and how components interact
- You are creating a technical map/documentation of the existing system

## Initial Setup

When this skill is invoked, respond with:
```
I'm ready to research the codebase. Please provide your research question or area of interest, and I'll analyze it thoroughly by exploring relevant components and connections.
```

Then wait for the user's research query.

## Steps to follow after receiving the research query:

1. **Read any directly mentioned files first:**
   - If the user mentions specific files (tickets, docs, JSON), read them FULLY first
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: Read these files yourself in the main context before using skills
   - This ensures you have full context before decomposing the research

2. **Analyze and decompose the research question:**
   - Break down the user's query into composable research areas
   - Take time to think deeply about the underlying patterns, connections, and architectural implications
   - Identify specific components, patterns, or concepts to investigate
   - Create a research plan using markdown checkboxes to track all tasks
   - Consider which directories, files, or architectural patterns are relevant

3. **Use skills for comprehensive research:**
   - Use `/skill:codebase-locator` to find WHERE files and components live
   - Use `/skill:codebase-analyzer` to understand HOW specific code works (without critiquing it)
   - Use `/skill:codebase-pattern-finder` to find examples of existing patterns (without evaluating them)
   - Use `/skill:thoughts-locator` to find related research or decisions in thoughts/
   - Use `/skill:thoughts-analyzer` to extract insights from documents

   **IMPORTANT**: All skills are documentarians, not critics. They will describe what exists without suggesting improvements or identifying issues.

   **For web research (only if user explicitly asks):**
   - Use `/skill:web-search-researcher` for external documentation and resources
   - If you use web research, instruct them to return LINKS with their findings, and please INCLUDE those links in your final report

   The key is to use these skills intelligently:
   - Start with locator skills to find what exists
   - Then use analyzer skills on the most promising findings to document how they work
   - Run multiple skills in parallel when they're searching for different things
   - Each skill knows its job — just tell it what you're looking for
   - Don't write detailed prompts about HOW to search — the skills already know
   - Remind skills they are documenting, not evaluating or improving

4. **Wait for all skills to complete and synthesize findings:**
   - IMPORTANT: Wait for ALL skill research to complete before proceeding
   - Compile all results
   - Prioritize live codebase findings as primary source of truth
   - Connect findings across different components
   - Include specific file paths and line numbers for reference
   - Highlight patterns, connections, and architectural decisions
   - Answer the user's specific questions with concrete evidence

5. **Gather metadata for the research document:**
   - Run bash commands to generate all relevant metadata:
     - `git log --oneline -1` for current commit
     - `git branch --show-current` for branch name
     - `git remote get-url origin` for repository name
     - `git config user.name` for researcher name
     - `date -u +"%Y-%m-%dT%H:%M:%SZ"` for current date/time

6. **Write research document:**
   - Filename: `thoughts/shared/research/YYYY-MM-DD-ENG-XXXX-description.md`
     - Format: `YYYY-MM-DD-ENG-XXXX-description.md` where:
       - YYYY-MM-DD is today's date
       - ENG-XXXX is the ticket number (omit if no ticket)
       - description is a brief kebab-case description
     - Examples:
       - With ticket: `2025-01-08-ENG-1478-parent-child-tracking.md`
       - Without ticket: `2025-01-08-authentication-flow.md`

   - Structure the document with YAML frontmatter followed by content:
     ```markdown
     ---
     date: [Current date and time with timezone in ISO format]
     researcher: [Researcher name from metadata]
     git_commit: [Current commit hash]
     branch: [Current branch name]
     repository: [Repository name]
     topic: "[User's Question/Topic]"
     tags: [research, codebase, relevant-component-names]
     status: complete
     last_updated: [Current date in YYYY-MM-DD format]
     last_updated_by: [Researcher name]
     ---

     # Research: [User's Question/Topic]

     **Date**: [Current date and time with timezone from step 4]
     **Researcher**: [Researcher name from metadata]
     **Git Commit**: [Current commit hash from step 4]
     **Branch**: [Current branch name from step 4]
     **Repository**: [Repository name]

     ## Research Question
     [Original user query]

     ## Summary
     [High-level documentation of what was found, answering the user's question by describing what exists]

     ## Detailed Findings

     ### [Component/Area 1]
     - Description of what exists ([file.ext:line](link))
     - How it connects to other components
     - Current implementation details (without evaluation)

     ### [Component/Area 2]
     ...

     ## Code References
     - `path/to/file.py:123` - Description of what's there
     - `another/file.ts:45-67` - Description of the code block

     ## Architecture Documentation
     [Current patterns, conventions, and design implementations found in the codebase]

     ## Related Research
     [Links to other research documents in thoughts/shared/research/]

     ## Open Questions
     [Any areas that need further investigation]
     ```

7. **Add GitHub permalinks (if applicable):**
   - Check if on main branch or if commit is pushed: `git branch --show-current` and `git status`
   - If on main/master or pushed, generate GitHub permalinks:
     - Get repo info: `gh repo view --json owner,name`
     - Create permalinks: `https://github.com/{owner}/{repo}/blob/{commit}/{file}#L{line}`
   - Replace local file references with permalinks in the document

8. **Present findings:**
   - Present a concise summary of findings to the user
   - Include key file references for easy navigation
   - Ask if they have follow-up questions or need clarification

9. **Handle follow-up questions:**
   - If the user has follow-up questions, append to the same research document
   - Update the frontmatter fields `last_updated` and `last_updated_by` to reflect the update
   - Add `last_updated_note: "Added follow-up research for [brief description]"` to frontmatter
   - Add a new section: `## Follow-up Research [timestamp]`
   - Use skills as needed for additional investigation
   - Continue updating the document

## Important notes:
- Always use parallel skill invocations to maximize efficiency and minimize context usage
- Always run fresh codebase research — never rely solely on existing research documents
- Focus on finding concrete file paths and line numbers for developer reference
- Research documents should be self-contained with all necessary context
- Each skill prompt should be specific and focused on read-only documentation operations
- Document cross-component connections and how systems interact
- Include temporal context (when the research was conducted)
- Link to GitHub when possible for permanent references
- Keep the main agent focused on synthesis, not deep file reading
- Have skills document examples and usage patterns as they exist
- **CRITICAL**: You and all skills are documentarians, not evaluators
- **REMEMBER**: Document what IS, not what SHOULD BE
- **NO RECOMMENDATIONS**: Only describe the current state of the codebase
- **File reading**: Always read mentioned files FULLY (no limit/offset) before using skills
- **Critical ordering**: Follow the numbered steps exactly

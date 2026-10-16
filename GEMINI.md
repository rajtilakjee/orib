# Project Guidelines

## Git Commit & Push Instructions

Whenever asked to commit and push changes to GitHub:
- Always use the **Conventional Commits** specification.
- Format: `<type>(<optional scope>): <description>` (or `<type>: <description>` if scope is omitted).
- Common types:
  - `feat`: A new feature
  - `fix`: A bug fix
  - `docs`: Documentation only changes
  - `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
  - `refactor`: A code change that neither fixes a bug nor adds a feature
  - `perf`: A code change that improves performance
  - `test`: Adding missing tests or correcting existing tests
  - `build`: Changes that affect the build system or external dependencies
  - `ci`: Changes to CI configuration files and scripts
  - `chore`: Other changes that don't modify src or test files
- Write commit descriptions in the imperative mood, concise, and clear (e.g., `feat: add user authentication flow`).


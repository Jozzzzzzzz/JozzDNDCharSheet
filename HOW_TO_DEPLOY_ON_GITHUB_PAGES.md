# How To Deploy On GitHub Pages

## 1. Create a GitHub repo
- Create a new repository (public recommended for free Pages).
- Copy all files from this `dnd-sheet-modular` folder into the repo root.

## 2. Commit and push
- Commit all files and push to `main` (or your default branch).

## 3. Enable GitHub Pages
- Go to repository `Settings`.
- Open `Pages`.
- Under **Build and deployment**:
  - Source: `Deploy from a branch`
  - Branch: `main`
  - Folder: `/ (root)`
- Save.

## 4. Open deployed site
- Wait 1-3 minutes.
- GitHub will provide a URL like:
  - `https://<your-username>.github.io/<repo-name>/`

## 5. Verify routing files
These files are included for direct links:
- `home.html`
- `stats.html`
- `background.html`
- `spells.html`
- `inventory.html`
- `notes.html`

Each redirects to `index.html#<tab>`.

## 6. Important Firebase note
If you use Firebase auth/Firestore rules tied to domains:
- Add your GitHub Pages domain to Firebase authorized domains.
- Example: `<your-username>.github.io`.

## 7. Update workflow
- Edit files locally.
- Commit + push.
- GitHub Pages auto-redeploys.

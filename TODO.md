# D&D Character Sheet Fixes

## Issues to Fix
1. **Google Sign-In Not Working**: No popup appears when clicking "Google Sign In Sync"
2. **Character Creation Keeps Old Data**: New characters retain data from previous characters

## Tasks
- [x] Add error handling and logging to Google sign-in function
- [x] Fix loadData function to clear all form fields before loading new character data
- [x] Test fixes and provide Firebase Console instructions

## Firebase Console Setup (Manual)
- Go to Firebase Console > Authentication > Sign-in method > Authorized domains
- Add your new domain (e.g., your GitHub Pages domain)
- Ensure Google provider is enabled

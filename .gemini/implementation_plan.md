# Admin Panel Complete Overhaul - Implementation Plan

## 1. Login.tsx - Player vs Guest Registration
- Add "Register as Player" vs "Continue as Guest" choice
- Player path: School → Tournament → Squad selection → Submit request
- Guest path: No approval needed, skip straight to home

## 2. AdminUsers.tsx - Separated User Lists & Player Requests  
- Tab system: Normal Users | Players | Sub-Admin Management
- Sub-admin can only see users from their managed schools
- Super admin sees everything

## 3. AdminLayout.tsx - Navigation Updates
- Add "Player Approvals" link for all admins
- Hide "Settings" countdown section from sub-admins
- Hide "Users & Claims" from sub-admins if needed

## 4. AdminSettings.tsx - Countdown Only for Super Admin
- Countdown popup section only visible to super_admin
- Sub-admin password reset by super admin

## 5. Security Hardening
- batchcrick@gmail.com hardcoded protection
- Sub-admin isolation enforced at service level
- Admin panel route protection

## 6. Password Reset for Sub-Admins (via sendPasswordResetEmail)
- Super admin can send password reset email
- Use Firebase's built-in sendPasswordResetEmail

## 7. Public UI School Filters  
- Tournaments, Squads, Players, Rankings, Champions pages
- Filter by school with auto-suggest

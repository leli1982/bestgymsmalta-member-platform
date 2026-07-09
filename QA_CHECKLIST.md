# BestGymsMalta Member App QA Checklist

## Admin / Members

- [ ] Open `/bgm-admin`
- [ ] Unlock admin with PIN
- [ ] Export members CSV
- [ ] Check exported dates are `dd/mm/yyyy`
- [ ] Import the same CSV back in
- [ ] Confirm safety warning appears
- [ ] Confirm import history updates
- [ ] Remove one test member from CSV and import again
- [ ] Confirm warning shows the member will be removed
- [ ] Cancel import once
- [ ] Import again and confirm
- [ ] Confirm deleted member disappears
- [ ] Search members by name
- [ ] Search members by member number
- [ ] Filter Active
- [ ] Filter Inactive
- [ ] Filter App active
- [ ] Filter Not activated
- [ ] Edit a member
- [ ] Reset app login
- [ ] Delete a test member

## Member Login / Account

- [ ] Open `/member-login`
- [ ] Activate a test member using member number + email
- [ ] Log out
- [ ] Log back in
- [ ] Forgot password flow sends email
- [ ] Reset password link works
- [ ] Account page shows correct member number
- [ ] Membership expiry displays correctly

## Gyms

- [ ] Open `/gyms`
- [ ] Gym cards load
- [ ] Gym logos are large and not boxed
- [ ] Search/filter gyms
- [ ] Open each gym detail page
- [ ] Check map/directions button
- [ ] Check 3D virtual tour where available
- [ ] Check coming soon gyms display correctly

## QR Check-ins / Passport

- [ ] Open `/scan-gym-qr`
- [ ] Scan or open a gym QR check-in URL
- [ ] Check-in succeeds for logged-in member
- [ ] Duplicate check-in within 2 hours is handled clearly
- [ ] Success screen shows gym logo/name
- [ ] Success screen shows passport progress
- [ ] Open `/passport`
- [ ] Passport stamp appears
- [ ] Recent check-in appears
- [ ] Admin QR Codes tab shows the check-in
- [ ] Export visible check-ins works

## Trainer

- [ ] Open `/trainer`
- [ ] Generate workout plan
- [ ] Plan displays as training days, not JSON
- [ ] Change days per week from 1 to 7
- [ ] Save plan
- [ ] Refresh page and confirm plan remains

## Progress

- [ ] Open `/progress`
- [ ] Upload progress photo
- [ ] Add weight/view/notes
- [ ] Confirm progress timeline updates
- [ ] Refresh and confirm photo remains

## Story Creator

- [ ] Open `/story`
- [ ] Upload image
- [ ] Add BGM logo
- [ ] Add TSM logo
- [ ] Add gym logo
- [ ] Drag sticker
- [ ] Resize sticker
- [ ] Rotate sticker
- [ ] Remove sticker
- [ ] Export story image

## First-time Onboarding

- [ ] New logged-in member sees onboarding
- [ ] Onboarding explains membership card
- [ ] Onboarding explains passport stamps
- [ ] Onboarding explains trainer/progress/story
- [ ] Finish button hides onboarding
- [ ] Onboarding does not show again after finish

## Mobile QA

- [ ] Test on iPhone Safari
- [ ] Test on Android Chrome
- [ ] Add to Home Screen / PWA
- [ ] Bottom nav is not cut off
- [ ] Buttons are easy to tap
- [ ] Inputs do not zoom on mobile
- [ ] Story creator works on mobile
- [ ] Check-in QR flow works on mobile

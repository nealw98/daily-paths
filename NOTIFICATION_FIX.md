# Daily Reminder Notification Fix

## Problem
The daily reminder notifications were not working correctly:
1. **Immediate firing**: When enabling the reminder or changing the time, a notification would fire immediately
2. **No daily repeat**: The notification wouldn't fire at the scheduled time on subsequent days
3. **Timezone issues**: Notifications were not respecting local timezone

## Root Cause
The original implementation used a simple CalendarTrigger with just `{ hour, minute, repeats: true }`. This has several issues:

1. **Timezone handling**: The simple trigger doesn't properly specify timezone context
2. **Immediate firing**: If the specified time has already passed today, iOS/Android may fire the notification immediately
3. **No daily repeat verification**: The repeat mechanism wasn't reliable

## Solution Implemented

### 1. Explicit Timezone Handling
Now uses `SchedulableTriggerInputTypes.CALENDAR` to ensure proper local timezone handling:

```typescript
trigger: {
  type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
  repeats: true,
  hour: hour,
  minute: minute,
}
```

### 2. Smart Scheduling Logic
- Checks if the scheduled time has already passed today
- If yes, logs that it will schedule for tomorrow
- Provides clear console feedback about when the notification is scheduled

### 3. Enhanced Debug Logging
Added comprehensive logging:
- When notifications are scheduled (with timestamp)
- Whether scheduling for today or tomorrow
- Notification ID returned
- Total scheduled notifications count
- Next trigger details

### 4. Verification After Scheduling
After scheduling, the code now queries and logs:
- Total number of scheduled notifications
- Details of the next trigger

## Files Modified
- `utils/dailyReminder.ts` - Fixed timezone handling and added extensive logging
- `components/ReminderModal.tsx` - Updated title to "Al-Anon Daily Paths Reminder"

## Testing the Fix

### Watch the console logs when setting a reminder:

Expected output:
```
[Reminder] Cancelling 0 scheduled notification(s)
[Reminder] Scheduling daily notification for 12/13/2025, 8:00:00 AM
[Reminder] Notification scheduled with ID: ABC-123-XYZ
[Reminder] Total scheduled notifications: 1
[Reminder] Next trigger: {type: "calendar", repeats: true, hour: 8, minute: 0}
```

If the time has passed:
```
[Reminder] Time 8:00 has passed today, scheduling for tomorrow
[Reminder] Scheduling daily notification for 12/14/2025, 8:00:00 AM
```

### To test:
1. Set a reminder for 2-3 minutes in the future
2. Watch console logs to confirm scheduling
3. Put app in background
4. Wait for the scheduled time
5. Notification should appear at exactly the scheduled time

## Known Behavior

- **Local timezone**: All times are now in the device's local timezone
- **No immediate notification**: Setting a time that's already passed won't trigger immediately
- **Daily repeat**: Uses iOS/Android calendar-based repeating trigger
- **Survives app restart**: Notifications persist even if app is closed


// utils/dateUtils.js
/**
 * Utility functions for handling dates and time zones
 * 
 * This file provides consistent date and time handling across the application,
 * with proper time zone conversion and formatting.
 */

// Get time zone from environment variable or default to Eastern Time
const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_TIMEZONE_DISPLAY = 'ET';

/**
 * Convert a local date (MM-DD-YY) and time (HH:MM) to a Date object
 * correctly adjusted for the specified time zone
 * 
 * @param {string} dateInput - Date in MM-DD-YY format
 * @param {string} timeInput - Time in HH:MM format (24-hour)
 * @param {Object} guildConfig - Optional guild configuration with timezone settings
 * @returns {Date} - Date object in UTC
 */
function parseUserDateTime(dateInput, timeInput, guildConfig = null) {
  // Get timezone from guild config or use default
  const timezone = guildConfig?.display?.timezone || DEFAULT_TIMEZONE;
  const tzDisplay = guildConfig?.display?.timezoneDisplay || DEFAULT_TIMEZONE_DISPLAY;
  
  console.log(`[DATE UTILS] Parsing date: ${dateInput}, time: ${timeInput}`);
  console.log(`[DATE UTILS] Using timezone: ${timezone}, display: ${tzDisplay}`);
  
  // Parse date parts
  const dateParts = dateInput.split('-');
  if (dateParts.length !== 3) {
    throw new Error('Invalid date format. Expected MM-DD-YY.');
  }
  
  let [month, day, year] = dateParts.map(Number);
  
  // Adjust year for 2-digit format
  if (year < 100) {
    year += year < 50 ? 2000 : 1900;
  }
  
  // Parse time parts
  const timeParts = timeInput.split(':');
  if (timeParts.length !== 2) {
    throw new Error('Invalid time format. Expected HH:MM.');
  }
  
  const [hours, minutes] = timeParts.map(Number);
  
  // IMPROVED APPROACH: Create a date object in UTC, then adjust for timezone
  // Step 1: Create a date string for the user's local date/time
  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  
  console.log(`[DATE UTILS] Date components - Year: ${year}, Month: ${month}, Day: ${day}, Hours: ${hours}, Minutes: ${minutes}`);

  // Step 2: Get the timezone offset for the specified datetime
  const isDstActive = isInDST(new Date(year, month-1, day));
  const offsetMinutes = getManualTimezoneOffset(timezone, new Date(year, month-1, day));
  
  // Step 3: Create a UTC date by adjusting for the timezone
  // For example, 8:15 PM ET (UTC-4) should be stored as 00:15 UTC (next day)
  // So we need to subtract the offsetMinutes (which is negative for western hemispheres)
  
  // Create a base date with local components first
  const localDate = new Date(Date.UTC(year, month-1, day, hours, minutes, 0));
  
  // Then adjust to UTC by subtracting the offset minutes
  // For example, if offset is -240 (ET during DST, UTC-4), we'll subtract -240 minutes (i.e., add 4 hours)
  const utcDate = new Date(localDate.getTime() - (offsetMinutes * 60 * 1000));
  
  console.log(`[DATE UTILS] Original time: ${dateString}T${timeString} ${timezone}`);
  console.log(`[DATE UTILS] DST active: ${isDstActive}, Offset: ${offsetMinutes} minutes`);
  console.log(`[DATE UTILS] Final UTC date for storage: ${utcDate.toISOString()}`);
  
  return utcDate;
}

/**
 * Manual calculation of timezone offset in minutes for common timezones
 * Positive values mean hours AHEAD of UTC (e.g., UTC+8)
 * Negative values mean hours BEHIND UTC (e.g., UTC-5)
 * 
 * @param {string} timezone - Timezone name
 * @param {Date} date - Date to check for DST
 * @returns {number} - Offset in minutes
 */
function getManualTimezoneOffset(timezone, date = new Date()) {
  // Check if the date is in DST for the US
  const isDstActive = isInDST(date);
  
  // Define offsets in minutes (negative values for timezones west of UTC)
  const timezoneOffsets = {
    'America/New_York': isDstActive ? -240 : -300,      // ET: UTC-4/UTC-5
    'America/Chicago': isDstActive ? -300 : -360,       // CT: UTC-5/UTC-6
    'America/Denver': isDstActive ? -360 : -420,        // MT: UTC-6/UTC-7
    'America/Los_Angeles': isDstActive ? -420 : -480,   // PT: UTC-7/UTC-8
    'America/Anchorage': isDstActive ? -480 : -540,     // AKT: UTC-8/UTC-9
    'Pacific/Honolulu': -600,                          // HST: UTC-10 (no DST)
    'Europe/London': isDstActive ? 60 : 0,              // GMT/BST: UTC+0/UTC+1
    'Europe/Paris': isDstActive ? 120 : 60,             // CET/CEST: UTC+1/UTC+2
    'Europe/Helsinki': isDstActive ? 180 : 120,         // EET/EEST: UTC+2/UTC+3
    'Asia/Tokyo': 540,                                  // JST: UTC+9 (no DST)
    'Australia/Sydney': isDstActive ? 660 : 600,        // AEST/AEDT: UTC+10/UTC+11
    'Pacific/Auckland': isDstActive ? 780 : 720         // NZST/NZDT: UTC+12/UTC+13
  };
  
  // Get the offset or default to Eastern Time
  const offsetMinutes = timezoneOffsets[timezone] || timezoneOffsets['America/New_York'];
  
  console.log(`[DATE UTILS] Manual timezone offset for ${timezone}: ${offsetMinutes} minutes, DST active: ${isDstActive}`);
  
  return offsetMinutes;
}

/**
 * Check if the date is in Daylight Saving Time for the US
 * 
 * @param {Date} date - Date to check
 * @returns {boolean} - True if DST is in effect
 */
function isInDST(date) {
  // US DST rules (second Sunday in March to first Sunday in November)
  const year = date.getFullYear();
  
  // DST starts on the second Sunday in March at 2 AM
  const dstStart = new Date(year, 2, 1); // March 1
  dstStart.setDate(dstStart.getDate() + (7 - dstStart.getDay()) + 7); // Second Sunday
  dstStart.setHours(2, 0, 0, 0); // 2:00 AM
  
  // DST ends on the first Sunday in November at 2 AM
  const dstEnd = new Date(year, 10, 1); // November 1
  dstEnd.setDate(dstEnd.getDate() + (7 - dstEnd.getDay()) % 7); // First Sunday
  dstEnd.setHours(2, 0, 0, 0); // 2:00 AM
  
  // Check if the date is between start and end
  const isDstActive = date >= dstStart && date < dstEnd;
  
  console.log(`[DATE UTILS] DST check - Start: ${dstStart.toISOString()}, End: ${dstEnd.toISOString()}, Result: ${isDstActive}`);
  
  return isDstActive;
}

/**
 * Format a date for display in the configured time zone
 * 
 * @param {Date} date - Date object (stored in UTC)
 * @param {Object} guildConfig - Optional guild configuration with timezone settings
 * @returns {Object} - Formatted date information
 */
function formatDateForDisplay(date, guildConfig = null) {
  // Get timezone from guild config or use default
  const timezone = guildConfig?.display?.timezone || DEFAULT_TIMEZONE;
  const tzDisplay = guildConfig?.display?.timezoneDisplay || DEFAULT_TIMEZONE_DISPLAY;
  
  console.log(`[DATE UTILS] Formatting date for display: ${date.toISOString()}`);
  console.log(`[DATE UTILS] Using timezone: ${timezone}, display: ${tzDisplay}`);
  
  try {
    // BEST APPROACH: Use the browser-built Intl formatter when available
    const options = {
      timeZone: timezone,
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    
    // Get all formatted parts
    const formattedParts = formatter.formatToParts(date);
    
    // Create a parts map
    const parts = {};
    formattedParts.forEach(part => {
      parts[part.type] = part.value;
    });
    
    console.log(`[DATE UTILS] Formatted parts: ${JSON.stringify(parts)}`);
    
    // Build formatted strings
    const dayOfWeek = parts.weekday;
    const month = parseInt(parts.month, 10);
    const day = parseInt(parts.day, 10);
    const year = parseInt(parts.year, 10);
    
    // Create time string with AM/PM and timezone
    let formattedTime = `${parts.hour}:${parts.minute} ${parts.dayPeriod} ${tzDisplay}`;
    
    console.log(`[DATE UTILS] Formatted using Intl.DateTimeFormat: ${dayOfWeek} ${month}/${day}/${year} at ${formattedTime}`);
    
    return {
      dayOfWeek,
      month,
      day,
      year,
      hours: parts.hour,
      minutes: parts.minute,
      ampm: parts.dayPeriod,
      formattedTime,
      fullDate: `${month}/${day}`,
      timezoneName: tzDisplay
    };
  } catch (error) {
    console.error(`[DATE UTILS] Error formatting with Intl: ${error.message}`);
    console.log('[DATE UTILS] Falling back to manual timezone formatting');
    
    // MANUAL FALLBACK APPROACH: Calculate the display date manually
    // Get the timezone offset
    const offsetMinutes = getManualTimezoneOffset(timezone, date);
    
    // Create a display date by applying the reverse offset to UTC
    // Since UTC - (-offsetMinutes) = UTC + offsetMinutes
    const displayDate = new Date(date.getTime() + (offsetMinutes * 60 * 1000));
    
    console.log(`[DATE UTILS] Manual offset: ${offsetMinutes} minutes (${offsetMinutes/60} hours)`);
    console.log(`[DATE UTILS] Manual adjusted display date: ${displayDate.toISOString()}`);
    
    // Format date with day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = dayNames[displayDate.getUTCDay()];
    
    // Format date parts (using UTC methods to avoid local timezone interference)
    const month = displayDate.getUTCMonth() + 1;
    const day = displayDate.getUTCDate();
    const year = displayDate.getUTCFullYear();
    
    // Format time (using UTC methods to avoid local timezone interference)
    let hours = displayDate.getUTCHours();
    const minutes = String(displayDate.getUTCMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Convert to 12-hour format
    
    const formattedTime = `${hours}:${minutes} ${ampm} ${tzDisplay}`;
    
    console.log(`[DATE UTILS] Manual formatted: ${dayOfWeek} ${month}/${day}/${year} at ${formattedTime}`);
    
    return {
      dayOfWeek,
      month,
      day,
      year,
      hours,
      minutes,
      ampm,
      formattedTime,
      fullDate: `${month}/${day}`,
      timezoneName: tzDisplay
    };
  }
}

/**
 * Calculate time until a future date/time
 * 
 * @param {Date} futureDate - The future date/time
 * @returns {string} - Formatted time until string
 */
function getTimeUntil(futureDate) {
  const now = new Date();
  const timeUntil = futureDate - now;
  
  if (timeUntil < 0) {
    return "It already started!";
  }
  
  const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m from now`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m from now`;
  } else {
    return `${minutes}m left - hurry up!`;
  }
}

module.exports = {
  DEFAULT_TIMEZONE,
  DEFAULT_TIMEZONE_DISPLAY,
  parseUserDateTime,
  formatDateForDisplay,
  getTimeUntil
};
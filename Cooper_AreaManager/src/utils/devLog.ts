// No-ops in a production release build — the offline queue/sync/location
// code logs on essentially every user action (every save, accept, start,
// complete, upload attempt), so left as plain console.log this was running
// unconditionally even in production: a little wasted CPU/bridge traffic on
// every single one of those actions, and — for the location logs
// specifically — printing the phone's own GPS coordinates into the
// device's system log, readable by anything else with log-reading
// permissions. __DEV__ is true only in a development build/Metro session.
export const devLog: (...args: any[]) => void = __DEV__ ? console.log.bind(console) : () => {};

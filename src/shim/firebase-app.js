// بديل firebase/app
const _app = { name: "wavelift-sheets" };
export function initializeApp() { return _app; }
export function getApps() { return [_app]; }
export function getApp() { return _app; }

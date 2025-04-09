// Simple shim for node:events that re-exports the browser-compatible events module
import Events from 'events';
export default Events;
export const EventEmitter = Events; 
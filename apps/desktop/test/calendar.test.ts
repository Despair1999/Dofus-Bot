import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekDates,monthDates,shiftDate,todayISO} from '../src/v2/almanax/calendar';
test('week follows ISO Monday through Sunday across DST',()=>{assert.deepEqual(weekDates('2026-10-25'),['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25']);assert.equal(shiftDate('2026-10-25',1),'2026-10-26');});
test('month grid covers actual complete weeks and leap day',()=>{const dates=monthDates('2028-02-10');assert.ok(dates.includes('2028-02-29'));assert.equal(dates.length%7,0);assert.equal(new Date(`${dates[0]}T12:00Z`).getUTCDay(),1);});
test('today uses Berlin rather than server timezone',()=>assert.equal(todayISO(new Date('2026-10-20T23:30:00Z')),'2026-10-21'));

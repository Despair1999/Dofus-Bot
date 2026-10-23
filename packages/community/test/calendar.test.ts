import {test} from "node:test";
import assert from "node:assert/strict";
import {calendarDays,zonedInstant,dayKey} from "../src/calendar";
test("calendar crosses years and starts on Monday without skipping DST days",()=>{
  const days=calendarDays(new Date(2026,2,29,12),"month");
  assert.equal(days.length,42);assert.equal(days[0].getDay(),1);
  assert.equal(new Set(days.map(d=>dayKey(d,"Europe/Berlin"))).size,42);
  const week=calendarDays(new Date(2027,0,1,12),"week");assert.equal(week[0].getFullYear(),2026);assert.equal(week.length,7);
});
test("event timezone converts wall time and rejects nonexistent DST times",()=>{
  assert.equal(zonedInstant("2026-07-20T20:00","Europe/Berlin"),"2026-07-20T18:00:00.000Z");
  assert.equal(zonedInstant("2026-01-20T20:00","America/New_York"),"2026-01-21T01:00:00.000Z");
  assert.throws(()=>zonedInstant("2026-03-29T02:30","Europe/Berlin"),/existiert/);
  assert.equal(zonedInstant("2026-10-25T02:30","Europe/Berlin"),"2026-10-25T00:30:00.000Z");
});
